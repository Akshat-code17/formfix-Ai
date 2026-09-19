import fs from "node:fs";
import path from "node:path";
import { Extraction, SessionState } from "../packages/contracts/index.js";
import { matchTemplate } from "../apps/api/src/services/template.js";
import { capabilities } from "../apps/api/src/routes/app.js";
import type { Settings } from "../apps/api/src/config.js";
export const config: Settings = {
  DEMO_MODE: "true",
  AI_PROVIDER: "fixture",
  AI_MODEL: "gemini-2.5-flash",
  DOCUMENT_SERVICE_URL:
    process.env.TEST_DOCUMENT_URL ?? "http://127.0.0.1:8000",
  DOCUMENT_SERVICE_TOKEN: "test-only-document-token-32-characters",
  MONGODB_URI: "",
  SESSION_SECRET: "test-only-session-secret-32-characters",
  UPLOAD_DIR: path.resolve("work/test-uploads"),
  RETENTION_HOURS: 24,
  APP_ORIGIN: "http://localhost:8080",
  PORT: 3000,
  AI_CONCURRENCY: 2,
  AI_SESSION_BUDGET: 100,
  UPLOAD_SESSION_BUDGET: 50,
  IP_REQUESTS_PER_MINUTE: 120,
  TRUST_PROXY: "false",
};
export const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(`fixtures/demo/${name}.json`, "utf8"));
export const extraction = () =>
  Extraction.parse(JSON.parse(fs.readFileSync("work/extraction.json", "utf8")));
export function state(name = "clean") {
  return SessionState.parse({
    form: matchTemplate(extraction(), "test-form"),
    language: "en",
    revision: 0,
    ...fixture(name),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    capabilities: capabilities(config, true),
  });
}
