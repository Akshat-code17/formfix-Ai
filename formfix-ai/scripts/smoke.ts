import fs from "node:fs/promises";
import assert from "node:assert/strict";
import * as C from "../packages/contracts/index.js";
const origin = process.env.APP_ORIGIN ?? "http://localhost:8080";
const started = performance.now();
const create = await fetch(origin + "/api/sessions", {
  method: "POST",
  headers: { Origin: origin },
});
assert.equal(create.status, 201);
const session = C.SessionResult.parse(await create.json());
const cookie = create.headers.getSetCookie()[0].split(";")[0];
async function call(route: string, method = "GET", body?: unknown) {
  const r = await fetch(origin + route, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "X-CSRF-Token": session.csrfToken,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
try {
  const formData = new FormData();
  formData.set("language", "en");
  formData.set(
    "file",
    new Blob(
      [
        new Uint8Array(
          await fs.readFile("fixtures/demo/sample-student-support.pdf"),
        ),
      ],
      { type: "application/pdf" },
    ),
    "sample.pdf",
  );
  const upload = await fetch(origin + "/api/forms/analyze", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "X-CSRF-Token": session.csrfToken,
    },
    body: formData,
  });
  assert.equal(upload.status, 202);
  const ids = C.AnalyzeResult.parse(await upload.json());
  const uploadAt = performance.now();
  let ready = false;
  for (let i = 0; i < 240; i++) {
    const job = C.JobResult.parse(await call("/api/jobs/" + ids.jobId));
    if (job.status === "failed") throw new Error(JSON.stringify(job.error));
    if (job.status === "ready") {
      ready = true;
      break;
    }
    if (job.status === "needs_review")
      throw new Error("Demo template unexpectedly needs review");
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Processing timed out");
  const uploadToReadyMs = Math.round(performance.now() - uploadAt);
  const base = "/api/forms/" + ids.formId;
  const state = C.SessionState.parse(await call(base));
  assert.equal(state.form.fields.length, 14);
  assert.equal(state.form.documentRequirements.length, 3);
  const explanation = C.Explanation.parse(
    await call(base + "/fields/pin/explanation?language=hi"),
  );
  assert.ok(explanation.sources.length);
  const chat = C.ChatAnswer.parse(
    await call(base + "/ask", "POST", {
      question: "How many digits should PIN have?",
      language: "en",
    }),
  );
  assert.equal(chat.status, "answered");
  const bad = JSON.parse(
    await fs.readFile("fixtures/demo/seeded-errors.json", "utf8"),
  );
  let saved = C.SavedAnswers.parse(
    await call(base + "/answers", "PATCH", {
      baseRevision: 0,
      changes: bad.answers,
    }),
  );
  let docs = C.SavedDocuments.parse(
    await call(base + "/documents", "PATCH", {
      baseRevision: saved.revision,
      changes: bad.documentReadiness,
    }),
  );
  const report = C.ValidationReport.parse(
    await call(base + "/validate", "POST", { revision: docs.revision }),
  );
  assert.equal(report.issues.length, 3);
  saved = C.SavedAnswers.parse(
    await call(base + "/answers", "PATCH", {
      baseRevision: docs.revision,
      changes: { pin: "012345", support_number: "SD-000123" },
    }),
  );
  docs = C.SavedDocuments.parse(
    await call(base + "/documents", "PATCH", {
      baseRevision: saved.revision,
      changes: { support_record: "ready" },
    }),
  );
  const clean = C.ValidationReport.parse(
    await call(base + "/validate", "POST", { revision: docs.revision }),
  );
  assert.equal(clean.issues.length, 0);
  const summary = C.ExportSummary.parse(
    await call(base + "/export?format=json"),
  );
  assert.equal(summary.validationCurrent, true);
  await fs.mkdir("work", { recursive: true });
  await fs.writeFile(
    "work/smoke-result.json",
    JSON.stringify(
      {
        mode: state.capabilities.mode,
        fieldCount: state.form.fields.length,
        requirementCount: state.form.documentRequirements.length,
        seededIssues: report.issues.map((i) => i.id),
        correctedIssues: clean.issues.length,
        uploadToReadyMs,
        totalMs: Math.round(performance.now() - started),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real HTTP upload, extraction, explanation, grounded question, 3 seeded issues, corrections, clean validation and authorized export.",
  );
} finally {
  await call("/api/sessions/current", "DELETE");
}
