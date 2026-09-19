import fs from "node:fs/promises";
import { MongoClient } from "mongodb";
import { settings } from "./config.js";
import { Store } from "./repositories/store.js";
import { createProvider, GeminiProvider } from "./providers/ai.js";
import { createApp } from "./routes/app.js";
const c = settings();
await fs.mkdir(c.UPLOAD_DIR, { recursive: true, mode: 0o700 });
const client = new MongoClient(c.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
});
await client.connect();
const store = new Store(client);
await store.indexes();
const provider = createProvider(c);
if (provider instanceof GeminiProvider) await provider.probe();
const server = createApp(store, c, provider).listen(c.PORT, () =>
  console.info(
    JSON.stringify({ operation: "listen", port: c.PORT, mode: c.AI_PROVIDER }),
  ),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await client.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
