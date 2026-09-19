import { MongoClient, type ClientSession, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type {
  SessionState,
  Extraction,
  ValidationReport,
} from "../../../../packages/contracts/index.js";
import { AppError } from "../security/errors.js";
export type Guest = {
  _id: string;
  csrf: string;
  expiresAt: Date;
  deleting: boolean;
  fence: number;
  aiUsed: number;
  uploadsUsed: number;
};
export type StoredForm = {
  _id: string;
  owner: string;
  state?: SessionState;
  path: string;
  expiresAt: Date;
  report?: ValidationReport;
  extraction?: Extraction;
};
export type Job = {
  _id: string;
  owner: string;
  formId: string;
  language: "en" | "hi" | "te" | "mr";
  status: "queued" | "running" | "ready" | "needs_review" | "failed";
  stage: "queued" | "extracting" | "matching" | "complete" | "failed";
  expiresAt: Date;
  leaseUntil: Date;
  leaseToken: string;
  attempts: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
};
export class Store {
  db: Db;
  constructor(public client: MongoClient) {
    this.db = client.db();
  }
  get sessions() {
    return this.db.collection<Guest>("sessions");
  }
  get forms() {
    return this.db.collection<StoredForm>("forms");
  }
  get jobs() {
    return this.db.collection<Job>("jobs");
  }
  async indexes() {
    await Promise.all([
      this.sessions.createIndex({ expiresAt: 1 }),
      this.forms.createIndex({ owner: 1 }),
      this.jobs.createIndex({ status: 1, leaseUntil: 1 }),
      this.jobs.createIndex({ owner: 1 }),
      this.db
        .collection("explanations")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.db
        .collection("limits")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    // Sessions deliberately do NOT use TTL: cleanup must remove files before deleting ownership records.
  }
  async transaction<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
    const s = this.client.startSession();
    try {
      return (await s.withTransaction(() => fn(s)))!;
    } finally {
      await s.endSession();
    }
  }
  async guest(owner: string, s?: ClientSession) {
    const g = await this.sessions.findOne(
      { _id: owner, deleting: false, expiresAt: { $gt: new Date() } },
      { session: s },
    );
    if (!g)
      throw new AppError(401, "SESSION_EXPIRED", "Create a new guest session.");
    return g;
  }
  async fence(owner: string, s: ClientSession) {
    const r = await this.sessions.updateOne(
      { _id: owner, deleting: false, expiresAt: { $gt: new Date() } },
      { $inc: { fence: 1 } },
      { session: s },
    );
    if (!r.matchedCount)
      throw new AppError(
        401,
        "SESSION_EXPIRED",
        "Session is deleted or expired.",
      );
  }
  async form(owner: string, id: string, s?: ClientSession) {
    await this.guest(owner, s);
    const f = await this.forms.findOne(
      { _id: id, owner, expiresAt: { $gt: new Date() } },
      { session: s },
    );
    if (!f) throw new AppError(404, "NOT_FOUND", "Form not found.");
    return f;
  }
  async edit(
    owner: string,
    id: string,
    baseRevision: number,
    mutate: (state: SessionState) => void,
  ) {
    return this.transaction(async (s) => {
      await this.fence(owner, s);
      const f = await this.form(owner, id, s);
      if (!f.state)
        throw new AppError(409, "NOT_READY", "Form is still processing.");
      if (f.state.revision !== baseRevision)
        throw new AppError(
          409,
          "REVISION_CONFLICT",
          "Reload saved state before applying changes.",
        );
      mutate(f.state);
      f.state.revision++;
      f.state.updatedAt = new Date().toISOString();
      await this.forms.updateOne(
        { _id: id, owner, "state.revision": baseRevision },
        { $set: { state: f.state }, $unset: { report: "" } },
        { session: s },
      );
      return f.state;
    });
  }
  async budget(owner: string, kind: "aiUsed" | "uploadsUsed", limit: number) {
    const r = await this.sessions.updateOne(
      {
        _id: owner,
        deleting: false,
        expiresAt: { $gt: new Date() },
        [kind]: { $lt: limit },
      },
      { $inc: { [kind]: 1 } },
    );
    if (!r.matchedCount)
      throw new AppError(
        429,
        "SESSION_BUDGET",
        "Session request budget exhausted.",
        true,
      );
  }
  async claim() {
    return this.jobs.findOneAndUpdate(
      { status: "queued", expiresAt: { $gt: new Date() } },
      {
        $set: {
          status: "running",
          stage: "extracting",
          leaseUntil: new Date(Date.now() + 120000),
          leaseToken: randomUUID(),
        },
        $inc: { attempts: 1 },
      },
      { sort: { _id: 1 }, returnDocument: "after" },
    );
  }
  async recover() {
    await this.jobs.updateMany(
      {
        status: "running",
        leaseUntil: { $lt: new Date() },
        attempts: { $lt: 2 },
      },
      { $set: { status: "queued", stage: "queued" } },
    );
    await this.jobs.updateMany(
      {
        status: "running",
        leaseUntil: { $lt: new Date() },
        attempts: { $gte: 2 },
      },
      {
        $set: {
          status: "failed",
          stage: "failed",
          error: {
            code: "LEASE_EXPIRED",
            message: "Processing stopped twice; upload again.",
            retryable: true,
            requestId: randomUUID(),
          },
        },
      },
    );
  }
  async commit(job: Job, state: SessionState, extraction: Extraction) {
    return this.transaction(async (s) => {
      await this.fence(job.owner, s);
      const r = await this.jobs.updateOne(
        {
          _id: job._id,
          owner: job.owner,
          status: "running",
          leaseToken: job.leaseToken,
          leaseUntil: { $gt: new Date() },
        },
        {
          $set: {
            status: state.form.templateId ? "ready" : "needs_review",
            stage: "complete",
          },
        },
        { session: s },
      );
      if (!r.matchedCount)
        throw new AppError(
          409,
          "LEASE_LOST",
          "Worker no longer owns this job.",
        );
      const f = await this.forms.updateOne(
        { _id: job.formId, owner: job.owner },
        { $set: { state, extraction } },
        { session: s },
      );
      if (!f.matchedCount)
        throw new AppError(404, "NOT_FOUND", "Form was deleted.");
    });
  }
}
