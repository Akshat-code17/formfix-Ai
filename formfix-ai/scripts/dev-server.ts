// Local synthetic-data demo: real HTTP, parser, Mongo replica set and one worker.
// Temporary database is intentionally removed on graceful shutdown. Compose is durable.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { Store } from '../apps/api/src/repositories/store.js';
import { createApp } from '../apps/api/src/routes/app.js';
import { FixtureProvider } from '../apps/api/src/providers/ai.js';
import { processJob } from '../apps/api/src/jobs/worker.js';
import { cleanup, deleteSession } from '../apps/api/src/services/lifecycle.js';
import { cancelDocument } from '../apps/api/src/providers/document.js';
import type { Settings } from '../apps/api/src/config.js';

const probe = createServer();
await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
const docPort = (probe.address() as { port: number }).port;
await new Promise<void>(r => probe.close(() => r()));
const uploadDir = await fs.mkdtemp(path.resolve('work/dev-uploads-'));
const c: Settings = {
  DEMO_MODE: 'true', AI_PROVIDER: 'fixture', AI_MODEL: 'gemini-2.5-flash',
  DOCUMENT_SERVICE_URL: `http://127.0.0.1:${docPort}`,
  DOCUMENT_SERVICE_TOKEN: randomBytes(32).toString('hex'),
  SESSION_SECRET: randomBytes(32).toString('hex'), MONGODB_URI: '', UPLOAD_DIR: uploadDir,
  RETENTION_HOURS: 24, APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  PORT: Number(process.env.DEV_API_PORT ?? 8080), AI_CONCURRENCY: 2,
  AI_SESSION_BUDGET: 200, UPLOAD_SESSION_BUDGET: 20, TRUST_PROXY: 'false',
  IP_REQUESTS_PER_MINUTE: 600,
};
const doc = spawn(process.env.PYTHON ?? 'python', ['-m', 'uvicorn', 'main:app', '--host',
  '127.0.0.1', '--port', String(docPort), '--no-access-log'], {
  cwd: 'services/document', env: { ...process.env, DOCUMENT_SERVICE_TOKEN: c.DOCUMENT_SERVICE_TOKEN },
  windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] });
doc.on('error', () => console.error('Python failed to start; set PYTHON to your virtual environment interpreter.'));
let mongo: MongoMemoryReplSet | undefined;
let client: MongoClient | undefined;
let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
let worker: Promise<void> | undefined;
let stop = false;
let finish!: () => void;
const stopped = new Promise<void>(r => { finish = r; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, finish);
process.on('message', message => { if (message === 'stop') finish(); });
process.on('disconnect', finish);
try {
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(c.DOCUMENT_SERVICE_URL + '/health')).ok) { healthy = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!healthy) throw new Error('FastAPI did not start. Install services/document/requirements.lock and set PYTHON.');
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', downloadDir: 'work/mongodb-binaries' }, replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri('formfix_demo')).connect();
  const store = new Store(client);
  await store.indexes();
  const provider = new FixtureProvider();
  server = createApp(store, c, provider).listen(c.PORT, '127.0.0.1');
  await new Promise<void>((r, reject) => { server!.once('listening', r); server!.once('error', reject); });
  worker = (async () => {
    let nextCleanup = 0;
    while (!stop) {
      if (Date.now() >= nextCleanup) {
        await cleanup(store, c.UPLOAD_DIR, p => cancelDocument(p, c));
        nextCleanup = Date.now() + 30000;
      }
      const job = await store.claim();
      if (job) await processJob(store, c, provider, job);
      else await new Promise(r => setTimeout(r, 100));
    }
  })();
  worker.catch(() => { console.error('Demo worker stopped unexpectedly.'); finish(); });
  console.log(`Backend ready at http://127.0.0.1:${c.PORT}. Recorded AI; temporary database.`);
  process.send?.('ready');
  await stopped;
  stop = true;
  await worker;
  await new Promise<void>(r => server!.close(() => r()));
  server = undefined;
  for (const guest of await store.sessions.find().toArray())
    await deleteSession(store, guest._id, c.UPLOAD_DIR, p => cancelDocument(p, c));
} finally {
  stop = true;
  await worker?.catch(() => {});
  server?.close();
  await client?.close();
  await mongo?.stop();
  doc.kill();
  await fs.rmdir(uploadDir).catch(() => {});
  if (process.connected) process.disconnect();
}
