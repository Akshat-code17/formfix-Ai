// Ephemeral local harness: real MongoDB, Express HTTP, FastAPI HTTP and parser child; fixture AI.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import { Store } from "../apps/api/src/repositories/store.js";
import { createApp } from "../apps/api/src/routes/app.js";
import { FixtureProvider } from "../apps/api/src/providers/ai.js";
import { processJob } from "../apps/api/src/jobs/worker.js";
import { config } from "../tests/helpers.js";
const portServer = createServer();
await new Promise<void>((r) => portServer.listen(0, "127.0.0.1", r));
const docPort = (portServer.address() as any).port;
await new Promise<void>((r) => portServer.close(() => r()));
const doc = spawn(
  process.env.PYTHON ?? "python",
  [
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(docPort),
    "--no-access-log",
  ],
  {
    cwd: "services/document",
    env: {
      ...process.env,
      DOCUMENT_SERVICE_TOKEN: config.DOCUMENT_SERVICE_TOKEN,
    },
    windowsHide: true,
    stdio: "ignore",
  },
);
let mongo: MongoMemoryReplSet | undefined;
let client: MongoClient | undefined;
let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
let stop = false;
let worker: Promise<void> | undefined;
try {
  const c = { ...config, DOCUMENT_SERVICE_URL: `http://127.0.0.1:${docPort}` };
  let healthy = false;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(c.DOCUMENT_SERVICE_URL + "/health");
      if (r.ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!healthy)
    throw new Error(
      "FastAPI did not start. Set PYTHON to an interpreter with requirements.lock installed.",
    );
  mongo = await MongoMemoryReplSet.create({
    binary: { version: "7.0.24", downloadDir: "work/mongodb-binaries" },
    replSet: { count: 1 },
  });
  client = await new MongoClient(mongo.getUri("e2e")).connect();
  const store = new Store(client);
  await store.indexes();
  await fs.mkdir(c.UPLOAD_DIR, { recursive: true });
  const provider = new FixtureProvider();
  server = createApp(store, c, provider).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server!.once("listening", r));
  c.APP_ORIGIN = `http://127.0.0.1:${(server.address() as any).port}`;
  process.env.APP_ORIGIN = c.APP_ORIGIN;
  worker = (async () => {
    while (!stop) {
      const job = await store.claim();
      if (job) await processJob(store, c, provider, job);
      else await new Promise((r) => setTimeout(r, 50));
    }
  })();
  await import("./smoke.js");
} finally {
  stop = true;
  await worker;
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  await client?.close();
  await mongo?.stop();
  doc.kill();
}
