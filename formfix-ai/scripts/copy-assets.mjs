import fs from "node:fs";
fs.cpSync("fixtures", "dist/fixtures", { recursive: true });
