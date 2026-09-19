import fs from "node:fs";
import crypto from "node:crypto";
if (fs.existsSync(".env")) {
  console.error(".env already exists; no changes made.");
  process.exit(1);
}
let text = fs.readFileSync(".env.example", "utf8");
text = text
  .replace(
    "replace-with-random-at-least-32-characters",
    crypto.randomBytes(32).toString("hex"),
  )
  .replace(
    "replace-with-another-random-32-character-secret",
    crypto.randomBytes(32).toString("hex"),
  );
fs.writeFileSync(".env", text, { mode: 0o600 });
console.log(
  "Created .env for explicit offline demo mode. Secrets were not printed.",
);
