import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import * as C from "../../../../packages/contracts/index.js";
import type { Store } from "../repositories/store.js";
import type { Settings } from "../config.js";
import type { AiProvider } from "../providers/ai.js";
import { AppError, errors } from "../security/errors.js";
import {
  auth,
  cookieOwner,
  ipLimit,
  requestLog,
  signed,
  safeEqual,
} from "../security/middleware.js";
import { deleteSession } from "../services/lifecycle.js";
import { explain, ask } from "../services/explanations.js";
import { validate } from "../validation/validate.js";
import { cancelDocument } from "../providers/document.js";
export function capabilities(c: Settings, verified = false) {
  return C.Capabilities.parse({
    typedAnswers: true,
    groundedChat: true,
    deterministicValidation: true,
    jsonExport: true,
    officialPdfFilling: false,
    autoSubmission: false,
    documentVerification: false,
    mode: c.DEMO_MODE === "true" ? "fixture" : "live",
    templateVerified: verified,
  });
}
export function createApp(
  store: Store,
  c: Settings,
  provider: AiProvider,
  cancel = (path: string) => cancelDocument(path, c),
) {
  const app = express();
  if (c.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet(),
    requestLog,
    cookieParser(),
    express.json({ limit: "32kb" }),
  );
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready", async (_req, res) => {
    await store.db.command({ ping: 1 });
    const r = await fetch(c.DOCUMENT_SERVICE_URL + "/health", {
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok)
      throw new AppError(
        503,
        "DOCUMENT_UNAVAILABLE",
        "Document service unavailable.",
        true,
      );
    res.json({ ok: true });
  });
  app.use(
    "/api",
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    ipLimit(store, c),
  );
  app.get("/api/config", (_req, res) =>
    res.json(
      C.Config.parse({
        limits: {
          maxBytes: 10485760,
          maxPages: 10,
          retentionHours: c.RETENTION_HOURS,
        },
        supportedLanguages: ["en", "hi", "te", "mr"],
        capabilities: capabilities(c),
        mode: capabilities(c).mode,
      }),
    ),
  );
  app.post("/api/sessions", async (req, res) => {
    if (req.get("origin") !== c.APP_ORIGIN)
      throw new AppError(
        403,
        "ORIGIN_REJECTED",
        "Same-origin session creation is required.",
      );
    const existing = cookieOwner(req.cookies?.ff_session, c);
    if (existing) {
      const g = await store.sessions.findOne({
        _id: existing,
        deleting: false,
        expiresAt: { $gt: new Date() },
      });
      if (g) {
        res.json(
          C.SessionResult.parse({
            csrfToken: g.csrf,
            expiresAt: g.expiresAt.toISOString(),
          }),
        );
        return;
      }
    }
    const id = randomUUID(),
      csrf = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + c.RETENTION_HOURS * 3600000);
    await store.sessions.insertOne({
      _id: id,
      csrf,
      expiresAt,
      deleting: false,
      fence: 0,
      aiUsed: 0,
      uploadsUsed: 0,
    });
    res
      .cookie("ff_session", signed(id, c), {
        httpOnly: true,
        sameSite: "strict",
        secure: c.APP_ORIGIN.startsWith("https://"),
        expires: expiresAt,
        path: "/api",
      })
      .status(201)
      .json(
        C.SessionResult.parse({
          csrfToken: csrf,
          expiresAt: expiresAt.toISOString(),
        }),
      );
  });
  // Deletion can be retried even after a cleanup failure has tombstoned the guest.
  app.delete("/api/sessions/current", async (req, res) => {
    const owner = cookieOwner(req.cookies?.ff_session, c);
    const g = owner ? await store.sessions.findOne({ _id: owner }) : null;
    if (req.get("origin") !== c.APP_ORIGIN || !owner)
      throw new AppError(
        403,
        "CSRF_REJECTED",
        "Valid session and origin required.",
      );
    if (g && !safeEqual(req.get("x-csrf-token") ?? "", g.csrf))
      throw new AppError(403, "CSRF_REJECTED", "CSRF token required.");
    if (g) await deleteSession(store, owner, c.UPLOAD_DIR, cancel);
    res.clearCookie("ff_session", { path: "/api" }).status(204).end();
  });
  app.use("/api", auth(store, c));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10485760,
      files: 1,
      fields: 1,
      parts: 3,
      fieldSize: 10,
    },
    fileFilter: (_req, file, cb) => {
      if (
        file.mimetype !== "application/pdf" ||
        !file.originalname.toLowerCase().endsWith(".pdf")
      )
        cb(
          new AppError(
            415,
            "UNSUPPORTED_TYPE",
            "Upload a PDF with application/pdf MIME type.",
          ),
        );
      else cb(null, true);
    },
  });
  let activeUploads = 0;
  app.post(
    "/api/forms/analyze",
    async (req, res, next) => {
      if (activeUploads >= 2)
        throw new AppError(
          429,
          "UPLOAD_BUSY",
          "Upload concurrency limit reached.",
          true,
        );
      await store.budget(
        res.locals.owner,
        "uploadsUsed",
        c.UPLOAD_SESSION_BUDGET,
      );
      activeUploads++;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          activeUploads--;
        }
      };
      res.once("finish", release);
      res.once("close", release);
      upload.single("file")(req, res, next);
    },
    async (req, res) => {
      const language = C.Language.parse(req.body.language);
      if (!req.file)
        throw new AppError(422, "FILE_REQUIRED", "Multipart file is required.");
      if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-")
        throw new AppError(415, "INVALID_PDF", "PDF signature is missing.");
      const formId = randomUUID(),
        jobId = randomUUID(),
        owner = res.locals.owner;
      const filePath = path.join(c.UPLOAD_DIR, randomUUID() + ".pdf");
      await fs.writeFile(filePath, req.file.buffer, {
        flag: "wx",
        mode: 0o600,
      });
      try {
        await store.transaction(async (s) => {
          await store.fence(owner, s);
          const g = await store.guest(owner, s);
          await store.forms.insertOne(
            { _id: formId, owner, path: filePath, expiresAt: g.expiresAt },
            { session: s },
          );
          await store.jobs.insertOne(
            {
              _id: jobId,
              owner,
              formId,
              language,
              status: "queued",
              stage: "queued",
              expiresAt: g.expiresAt,
              leaseUntil: new Date(0),
              leaseToken: "",
              attempts: 0,
            },
            { session: s },
          );
        });
      } catch (e) {
        await fs.rm(filePath, { force: true });
        throw e;
      }
      res
        .status(202)
        .json(C.AnalyzeResult.parse({ formId, jobId, status: "queued" }));
    },
  );
  app.get("/api/jobs/:jobId", async (req, res) => {
    const j = await store.jobs.findOne({
      _id: C.Id.parse(req.params.jobId),
      owner: res.locals.owner,
      expiresAt: { $gt: new Date() },
    });
    if (!j) throw new AppError(404, "NOT_FOUND", "Job not found.");
    res.json(
      C.JobResult.parse({
        status: j.status,
        stage: j.stage,
        formId: j.formId,
        ...(j.error ? { error: j.error } : {}),
      }),
    );
  });
  async function form(req: express.Request, res: express.Response) {
    return store.form(res.locals.owner, C.Id.parse(req.params.formId));
  }
  async function state(req: express.Request, res: express.Response) {
    const f = await form(req, res);
    if (!f.state)
      throw new AppError(409, "NOT_READY", "Form is still processing.");
    return C.SessionState.parse(f.state);
  }
  app.get("/api/forms/:formId", async (req, res) =>
    res.json(await state(req, res)),
  );
  app.get("/api/forms/:formId/sources", async (req, res) => {
    const f = await form(req, res);
    if (!f.extraction)
      throw new AppError(409, "NOT_READY", "Extraction is not ready.");
    res.json(C.Extraction.parse(f.extraction));
  });
  app.get("/api/forms/:formId/document", async (req, res) => {
    const f = await form(req, res);
    res
      .type("application/pdf")
      .set("Content-Disposition", 'inline; filename="uploaded-form.pdf"')
      .set("Content-Security-Policy", "sandbox; default-src 'none'")
      .sendFile(f.path);
  });
  app.patch("/api/forms/:formId/answers", async (req, res) => {
    const input = C.AnswerPatch.parse(req.body);
    const s = await store.edit(
      res.locals.owner,
      C.Id.parse(req.params.formId),
      input.baseRevision,
      (state) => {
        for (const [id, value] of Object.entries(input.changes)) {
          const f = state.form.fields.find((f) => f.id === id);
          if (!f)
            throw new AppError(
              422,
              "UNKNOWN_FIELD",
              "Answer references an unknown field.",
            );
          if (
            value !== null &&
            ((f.type === "boolean" && typeof value !== "boolean") ||
              (f.type !== "boolean" && typeof value !== "string"))
          )
            throw new AppError(
              422,
              "ANSWER_TYPE",
              "Answer value does not match the field type.",
            );
          state.answers[id] = value;
          (state.answerSkipped ??= {})[id] = input.skipped?.[id] ?? false;
        }
        if (Object.keys(input.skipped ?? {}).some(id => !(id in input.changes)))
          throw new AppError(422, "UNKNOWN_FIELD", "Skip metadata must accompany an answer change.");
      },
    );
    res.json(
      C.SavedAnswers.parse({ revision: s.revision, answers: s.answers }),
    );
  });
  app.patch("/api/forms/:formId/documents", async (req, res) => {
    const input = C.DocumentPatch.parse(req.body);
    const s = await store.edit(
      res.locals.owner,
      C.Id.parse(req.params.formId),
      input.baseRevision,
      (state) => {
        for (const [id, value] of Object.entries(input.changes)) {
          if (!state.form.documentRequirements.some((d) => d.id === id))
            throw new AppError(
              422,
              "UNKNOWN_REQUIREMENT",
              "Unknown document requirement.",
            );
          state.documentReadiness[id] = value;
        }
      },
    );
    res.json(
      C.SavedDocuments.parse({
        revision: s.revision,
        documentReadiness: s.documentReadiness,
      }),
    );
  });
  app.post("/api/forms/:formId/language", async (req, res) => {
    const { language } = C.LanguageInput.parse(req.body);
    await store.transaction(async (tx) => {
      await store.fence(res.locals.owner, tx);
      await store.form(res.locals.owner, C.Id.parse(req.params.formId), tx);
      await store.forms.updateOne(
        {
          _id: req.params.formId,
          owner: res.locals.owner,
          state: { $exists: true },
        },
        {
          $set: {
            "state.language": language,
            "state.updatedAt": new Date().toISOString(),
          },
        },
        { session: tx },
      );
    });
    res.json(await state(req, res));
  });
  app.get(
    "/api/forms/:formId/fields/:fieldId/explanation",
    async (req, res) => {
      const s = await state(req, res);
      const language = C.Language.parse(req.query.language ?? s.language);
      await store.budget(res.locals.owner, "aiUsed", c.AI_SESSION_BUDGET);
      res.json(
        await explain(
          store,
          provider,
          s,
          C.Id.parse(req.params.fieldId),
          language,
        ),
      );
    },
  );
  app.post("/api/forms/:formId/ask", async (req, res) => {
    const input = C.Ask.parse(req.body);
    const s = await state(req, res);
    await store.budget(res.locals.owner, "aiUsed", c.AI_SESSION_BUDGET);
    res.json(
      await ask(provider, s, input.question, input.language, input.fieldId),
    );
  });
  app.post("/api/forms/:formId/validate", async (req, res) => {
    const { revision } = C.ValidateInput.parse(req.body);
    const report = await store.transaction(async (tx) => {
      await store.fence(res.locals.owner, tx);
      const f = await store.form(
        res.locals.owner,
        C.Id.parse(req.params.formId),
        tx,
      );
      if (!f.state || f.state.revision !== revision)
        throw new AppError(
          409,
          "REVISION_CONFLICT",
          "Validate the current persisted revision.",
        );
      const report = validate(f.state);
      await store.forms.updateOne(
        { _id: f._id, owner: f.owner },
        { $set: { report } },
        { session: tx },
      );
      return report;
    });
    res.json(report);
  });
  app.get("/api/forms/:formId/export", async (req, res) => {
    if (req.query.format !== "json")
      throw new AppError(
        422,
        "EXPORT_FORMAT",
        "Only format=json is supported.",
      );
    const f = await form(req, res);
    if (!f.state)
      throw new AppError(409, "NOT_READY", "Form is still processing.");
    const current = !!f.report && f.report.revision === f.state.revision;
    const summary = C.ExportSummary.parse({
      kind: "review_summary_not_official_form",
      exportedAt: new Date().toISOString(),
      state: f.state,
      latestValidation: f.report ?? null,
      validationCurrent: current,
      unresolvedChecks: current ? f.report!.issues : [],
      notes: [
        current
          ? "Validation is current."
          : "Validation is absent or stale; unresolved checks have not been determined.",
        "Readiness is self-reported; no documents or signatures verified.",
        "This review summary is not a filled official form.",
      ],
    });
    res
      .attachment("formfix-review.json")
      .type("application/json")
      .send(JSON.stringify(summary, null, 2));
  });
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Route not found.")),
  );
  app.use(errors);
  return app;
}
