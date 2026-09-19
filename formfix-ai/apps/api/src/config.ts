import "dotenv/config";
import { z } from "zod";
import path from "node:path";
const Env = z.object({
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  AI_PROVIDER: z.enum(["fixture", "gemini"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  DOCUMENT_SERVICE_URL: z.string().url(),
  DOCUMENT_SERVICE_TOKEN: z.string().min(32),
  MONGODB_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  UPLOAD_DIR: z.string().min(1),
  RETENTION_HOURS: z.coerce.number().positive().max(168).default(24),
  APP_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
  AI_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  AI_SESSION_BUDGET: z.coerce.number().int().positive().default(60),
  UPLOAD_SESSION_BUDGET: z.coerce.number().int().positive().default(10),
  IP_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(10000).default(120),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export type Settings = z.infer<typeof Env>;
export function settings(): Settings {
  const c = Env.parse(process.env);
  if (c.AI_PROVIDER === "fixture" && c.DEMO_MODE !== "true")
    throw new Error("Fixture provider requires explicit DEMO_MODE=true.");
  if (c.DEMO_MODE === "true" && c.AI_PROVIDER !== "fixture")
    throw new Error("Use DEMO_MODE=false with Gemini.");
  if (c.AI_PROVIDER === "gemini" && !c.GEMINI_API_KEY)
    throw new Error(
      "Live mode requires GEMINI_API_KEY. Set DEMO_MODE=true and AI_PROVIDER=fixture for labelled offline mode.",
    );
  const u = new URL(c.DOCUMENT_SERVICE_URL);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Invalid document service URL");
  return { ...c, UPLOAD_DIR: path.resolve(c.UPLOAD_DIR) };
}
