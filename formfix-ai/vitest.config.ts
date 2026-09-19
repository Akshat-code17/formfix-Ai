import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 180000,
    reporters: ["default", "json"],
    outputFile: { json: "work/test-results.json" },
  },
});
