import fs from "node:fs/promises";
import path from "node:path";
import type { Store } from "../repositories/store.js";
import { AppError } from "../security/errors.js";
export async function deleteSession(
  store: Store,
  owner: string,
  uploadDir: string,
  cancelDocument?: (path: string) => Promise<void>,
) {
  // Tombstone first; all worker commits and application mutations contend on this record.
  await store.transaction(async (s) => {
    await store.sessions.updateOne(
      { _id: owner },
      { $set: { deleting: true }, $inc: { fence: 1 } },
      { session: s },
    );
  });
  const owned = await store.forms.find({ owner }).toArray();
  if (cancelDocument) for (const f of owned) await cancelDocument(f.path);
  try {
    for (const f of owned) {
      const resolved = path.resolve(f.path);
      if (path.dirname(resolved) !== path.resolve(uploadDir))
        throw new Error("Invalid storage path");
      await fs.rm(resolved, { force: true });
    }
  } catch {
    throw new AppError(
      503,
      "CLEANUP_FAILED",
      "Session is inaccessible; file cleanup must be retried.",
      true,
    );
  }
  await store.transaction(async (s) => {
    await store.forms.deleteMany({ owner }, { session: s });
    await store.jobs.deleteMany({ owner }, { session: s });
    await store.db
      .collection("explanations")
      .deleteMany({ owner }, { session: s });
    await store.sessions.deleteOne(
      { _id: owner, deleting: true },
      { session: s },
    );
  });
}
export async function cleanup(
  store: Store,
  uploadDir: string,
  cancelDocument?: (path: string) => Promise<void>,
) {
  for (const g of await store.sessions
    .find({ $or: [{ expiresAt: { $lte: new Date() } }, { deleting: true }] })
    .limit(100)
    .toArray())
    await deleteSession(store, g._id, uploadDir, cancelDocument);
  await store.db
    .collection("explanations")
    .deleteMany({ expiresAt: { $lte: new Date() } });
  // Crash between temporary file creation and DB commit: remove unowned files after 10 minutes.
  for (const name of await fs.readdir(uploadDir)) {
    if (!/^[a-f0-9-]+\.pdf$/.test(name)) continue;
    const p = path.join(uploadDir, name);
    const stat = await fs.stat(p).catch(() => null);
    if (
      stat &&
      stat.mtimeMs < Date.now() - 600000 &&
      !(await store.forms.findOne({ path: p }))
    )
      await fs.rm(p, { force: true });
  }
}
