import fs from "node:fs/promises";
import { MongoClient } from "mongodb";
import { settings } from "../config.js";
import { Store } from "../repositories/store.js";
import { createProvider } from "../providers/ai.js";
import { processJob } from "./worker.js";
import { cleanup } from "../services/lifecycle.js";
import { cancelDocument } from "../providers/document.js";
const c = settings();
await fs.mkdir(c.UPLOAD_DIR, { recursive: true, mode: 0o700 });
const client = new MongoClient(c.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
await client.connect();
const store = new Store(client);
await store.indexes();
const provider = createProvider(c);
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
let lastCleanup = 0;
while (!stop) {
  try {
    await store.recover();
    if (Date.now() - lastCleanup > 30000) {
      await cleanup(store, c.UPLOAD_DIR, (path) => cancelDocument(path, c));
      lastCleanup = Date.now();
    }
    const job = await store.claim();
    await store.db
      .collection("workerHealth")
      .updateOne(
        { _id: "single-worker" as any },
        { $set: { at: new Date() } },
        { upsert: true },
      );
    if (job) await processJob(store, c, provider, job);
    else await new Promise((r) => setTimeout(r, 500));
  } catch {
    console.error(
      JSON.stringify({ operation: "worker_loop", code: "DEPENDENCY_FAILURE" }),
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await client.close();
