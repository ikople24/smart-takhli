import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/m10-ingest/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 60000, // mongodb-memory-server first run downloads a binary
  },
});
