import { beforeAll, afterAll, it, expect } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import fs from "node:fs/promises";
import { Store } from "../apps/api/src/repositories/store.js";
import { createApp } from "../apps/api/src/routes/app.js";
import { FixtureProvider } from "../apps/api/src/providers/ai.js";
import { processJob } from "../apps/api/src/jobs/worker.js";
import { cleanup, deleteSession } from "../apps/api/src/services/lifecycle.js";
import { config, extraction, fixture } from "./helpers.js";
import { SessionState, ExportSummary } from "../packages/contracts/index.js";
let mongo: MongoMemoryReplSet,
  client: MongoClient,
  store: Store,
  app: ReturnType<typeof createApp>;
beforeAll(async () => {
  await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
  mongo = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24", downloadDir: "work/mongodb-binaries" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  client = await new MongoClient(mongo.getUri("formfix")).connect();
  store = new Store(client);
  await store.indexes();
  app = createApp(store, config, new FixtureProvider(), async () => {});
});
afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});
async function guest() {
  const r = await request(app)
    .post("/api/sessions")
    .set("Origin", config.APP_ORIGIN);
  expect(r.status).toBe(201);
  return {
    cookie: r.headers["set-cookie"][0].split(";")[0],
    csrf: r.body.csrfToken,
  };
}
function headers(g: Awaited<ReturnType<typeof guest>>) {
  return {
    Cookie: g.cookie,
    Origin: config.APP_ORIGIN,
    "X-CSRF-Token": g.csrf,
  };
}
async function upload(g: Awaited<ReturnType<typeof guest>>) {
  const r = await request(app)
    .post("/api/forms/analyze")
    .set(headers(g))
    .field("language", "en")
    .attach("file", "fixtures/demo/sample-student-support.pdf");
  expect(r.status).toBe(202);
  return r.body as { formId: string; jobId: string };
}
async function ready(g: Awaited<ReturnType<typeof guest>>) {
  const ids = await upload(g);
  const job = await store.claim();
  expect(job?._id).toBe(ids.jobId);
  await processJob(store, config, new FixtureProvider(), job!, async () =>
    extraction(),
  );
  return ids;
}
it("frontend-compatible flow: upload, poll, explain, save, detect 3 errors, correct, revalidate, export", async () => {
  const g = await guest();
  const ids = await ready(g);
  const base = "/api/forms/" + ids.formId;
  const poll = await request(app)
    .get("/api/jobs/" + ids.jobId)
    .set(headers(g));
  expect(poll.body.status).toBe("ready");
  const get = await request(app).get(base).set(headers(g));
  expect(SessionState.parse(get.body).form.fields).toHaveLength(14);
  expect(get.body.form.fields.find((f: any) => f.id === 'travel_reason').condition)
    .toEqual({ fieldId: 'support_type', op: 'equals', value: 'travel' });
  const explanation = await request(app)
    .get(base + "/fields/pin/explanation?language=hi")
    .set(headers(g));
  expect(explanation.body.language).toBe("hi");
  expect(explanation.body.sources.length).toBeGreaterThan(0);
  let r = await request(app)
    .patch(base + "/answers")
    .set(headers(g))
    .send({ baseRevision: 0, changes: fixture("seeded-errors").answers, skipped: { contact: true } });
  expect(r.status).toBe(200);
  expect(r.body.answers.student_id).toBe("000042");
  expect((await request(app).get(base).set(headers(g))).body.answerSkipped.contact).toBe(true);
  r = await request(app)
    .patch(base + "/documents")
    .set(headers(g))
    .send({
      baseRevision: 1,
      changes: fixture("seeded-errors").documentReadiness,
    });
  expect(r.body.revision).toBe(2);
  r = await request(app)
    .post(base + "/validate")
    .set(headers(g))
    .send({ revision: 2 });
  expect(r.body.issues.map((i: any) => i.id).sort()).toEqual(
    fixture("expected-validation")["seeded-errors"].sort(),
  );
  expect(
    (
      await request(app)
        .post(base + "/validate")
        .set(headers(g))
        .send({ revision: 1 })
    ).status,
  ).toBe(409);
  await request(app)
    .patch(base + "/answers")
    .set(headers(g))
    .send({
      baseRevision: 2,
      changes: { pin: "012345", support_number: "SD-000123" },
    });
  expect(
    (
      await request(app)
        .get(base + "/export?format=json")
        .set(headers(g))
    ).body.validationCurrent,
  ).toBe(false);
  await request(app)
    .patch(base + "/documents")
    .set(headers(g))
    .send({ baseRevision: 3, changes: { support_record: "ready" } });
  r = await request(app)
    .post(base + "/validate")
    .set(headers(g))
    .send({ revision: 4 });
  expect(r.body.issues).toEqual([]);
  r = await request(app)
    .get(base + "/export?format=json")
    .set(headers(g));
  expect(ExportSummary.parse(r.body).validationCurrent).toBe(true);
  expect(r.headers["content-disposition"]).toContain("attachment");
  const doc = await request(app)
    .get(base + "/document")
    .set(headers(g));
  expect(doc.headers["content-type"]).toContain("application/pdf");
  await request(app)
    .delete("/api/sessions/current")
    .set(headers(g))
    .expect(204);
});
it("concurrent edits accept one and conflict the other without losing the accepted value", async () => {
  const g = await guest();
  const { formId } = await ready(g);
  const rs = await Promise.all(
    ["Alpha", "Beta"].map((name) =>
      request(app)
        .patch(`/api/forms/${formId}/answers`)
        .set(headers(g))
        .send({ baseRevision: 0, changes: { full_name: name } }),
    ),
  );
  expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
  const current = await request(app)
    .get(`/api/forms/${formId}`)
    .set(headers(g));
  expect(current.body.answers.full_name).toBe(
    rs.find((r) => r.status === 200)!.body.answers.full_name,
  );
  await request(app).delete("/api/sessions/current").set(headers(g));
});
it("cross-session reads, document, edit, export and job access are denied; deletion only deletes caller", async () => {
  const a = await guest(),
    b = await guest();
  const ids = await ready(a);
  const base = "/api/forms/" + ids.formId;
  for (const url of [
    base,
    base + "/document",
    base + "/export?format=json",
    "/api/jobs/" + ids.jobId,
  ])
    expect((await request(app).get(url).set(headers(b))).status).toBe(404);
  expect(
    (
      await request(app)
        .patch(base + "/answers")
        .set(headers(b))
        .send({ baseRevision: 0, changes: { full_name: "attack" } })
    ).status,
  ).toBe(404);
  await request(app).delete("/api/sessions/current").set(headers(b));
  expect((await request(app).get(base).set(headers(a))).status).toBe(200);
  await request(app).delete("/api/sessions/current").set(headers(a));
});
it("rejects missing CSRF, wrong MIME, wrong magic, oversized upload and wrong answer types", async () => {
  const g = await guest();
  expect(
    (await request(app).post("/api/forms/analyze").set("Cookie", g.cookie))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post("/api/forms/analyze")
        .set(headers(g))
        .field("language", "en")
        .attach("file", Buffer.from("test"), {
          filename: "bad.txt",
          contentType: "text/plain",
        })
    ).status,
  ).toBe(415);
  expect(
    (
      await request(app)
        .post("/api/forms/analyze")
        .set(headers(g))
        .field("language", "en")
        .attach("file", Buffer.from("test"), {
          filename: "bad.pdf",
          contentType: "application/pdf",
        })
    ).status,
  ).toBe(415);
  expect(
    (
      await request(app)
        .post("/api/forms/analyze")
        .set(headers(g))
        .field("language", "en")
        .attach("file", Buffer.alloc(10485761), {
          filename: "big.pdf",
          contentType: "application/pdf",
        })
    ).status,
  ).toBe(413);
  const { formId } = await ready(g);
  expect(
    (
      await request(app)
        .patch(`/api/forms/${formId}/answers`)
        .set(headers(g))
        .send({ baseRevision: 0, changes: { pin: 123456 } })
    ).status,
  ).toBe(422);
  await request(app).delete("/api/sessions/current").set(headers(g));
});
it("deletion during active extraction removes files and prevents late commit resurrection", async () => {
  const g = await guest();
  const { formId } = await upload(g);
  const job = (await store.claim())!;
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const waiting = new Promise<void>((r) => {
    release = r;
  });
  const work = processJob(
    store,
    config,
    new FixtureProvider(),
    job,
    async () => {
      entered();
      await waiting;
      return extraction();
    },
  );
  await started;
  const f = (await store.forms.findOne({ _id: formId }))!;
  await request(app)
    .delete("/api/sessions/current")
    .set(headers(g))
    .expect(204);
  release();
  await work;
  expect(await store.forms.findOne({ _id: formId })).toBeNull();
  expect(await store.jobs.findOne({ _id: job._id })).toBeNull();
  await expect(fs.access(f.path)).rejects.toThrow();
});
it("expiry denies reads immediately and cleanup removes owned files, records and caches", async () => {
  const g = await guest();
  const { formId } = await ready(g);
  const f = (await store.forms.findOne({ _id: formId }))!;
  await store.sessions.updateOne(
    { _id: f.owner },
    { $set: { expiresAt: new Date(0) } },
  );
  expect(
    (
      await request(app)
        .get("/api/forms/" + formId)
        .set(headers(g))
    ).status,
  ).toBe(401);
  await cleanup(store, config.UPLOAD_DIR);
  expect(await store.forms.findOne({ _id: formId })).toBeNull();
  await expect(fs.access(f.path)).rejects.toThrow();
});
it("recovers one expired lease and fails repeated expirations", async () => {
  const g = await guest();
  const ids = await upload(g);
  const first = (await store.claim())!;
  await store.jobs.updateOne(
    { _id: ids.jobId },
    { $set: { leaseUntil: new Date(0) } },
  );
  await store.recover();
  const second = (await store.claim())!;
  expect(second.attempts).toBe(2);
  expect(second.leaseToken).not.toBe(first.leaseToken);
  await store.jobs.updateOne(
    { _id: ids.jobId },
    { $set: { leaseUntil: new Date(0) } },
  );
  await store.recover();
  expect((await store.jobs.findOne({ _id: ids.jobId }))!.status).toBe("failed");
  await deleteSession(store, first.owner, config.UPLOAD_DIR);
});
it("wrong template is needs_review rather than a processing failure", async () => {
  const g = await guest();
  const ids = await upload(g);
  const job = (await store.claim())!;
  const ex = extraction();
  ex.blocks[0].quote = "Different form";
  ex.blocks = ex.blocks.filter((b) => !b.quote.includes("FF-DEMO"));
  await processJob(store, config, new FixtureProvider(), job, async () => ex);
  expect((await store.jobs.findOne({ _id: ids.jobId }))!.status).toBe(
    "needs_review",
  );
  const f = (await store.forms.findOne({ _id: ids.formId }))!;
  expect(f.state!.form.templateId).toBeUndefined();
  await deleteSession(store, job.owner, config.UPLOAD_DIR);
});
it("per-session AI budget returns a consistent 429", async () => {
  const g = await guest();
  const { formId } = await ready(g);
  const f = (await store.forms.findOne({ _id: formId }))!;
  await store.sessions.updateOne(
    { _id: f.owner },
    { $set: { aiUsed: config.AI_SESSION_BUDGET } },
  );
  const r = await request(app)
    .post(`/api/forms/${formId}/ask`)
    .set(headers(g))
    .send({ question: "PIN?", language: "en" });
  expect(r.status).toBe(429);
  expect(r.body.error.code).toBe("SESSION_BUDGET");
  await deleteSession(store, f.owner, config.UPLOAD_DIR);
});
it("cleanup failure stays retryable and inaccessible until successful retry", async () => {
  const g = await guest();
  const { formId } = await ready(g);
  const failing = createApp(store, config, new FixtureProvider(), async () => {
    throw new Error("synthetic service failure");
  });
  expect(
    (await request(failing).delete("/api/sessions/current").set(headers(g)))
      .status,
  ).toBe(503);
  expect(
    (
      await request(app)
        .get("/api/forms/" + formId)
        .set(headers(g))
    ).status,
  ).toBe(401);
  await request(app)
    .delete("/api/sessions/current")
    .set(headers(g))
    .expect(204);
});
it("translation failure reports English language and explicit fallback metadata", async () => {
  const g = await guest();
  const { formId } = await ready(g);
  const p = new FixtureProvider();
  const original = p.explainField.bind(p);
  p.explainField = async (c, l) => {
    if (l === "te") throw new Error("translation unavailable");
    return original(c, l);
  };
  const fallbackApp = createApp(store, config, p, async () => {});
  const r = await request(fallbackApp)
    .get(`/api/forms/${formId}/fields/student_id/explanation?language=te`)
    .set(headers(g));
  expect(r.body.language).toBe("en");
  expect(r.body.fallback).toEqual({
    requestedLanguage: "te",
    reason: "translation_unavailable",
  });
  await request(app).delete("/api/sessions/current").set(headers(g));
});
