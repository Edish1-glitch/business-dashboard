import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests only (pure logic, no DB/network/DOM). E2E lives in ./e2e (Playwright).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
