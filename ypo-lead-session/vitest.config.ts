import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ypo_test",
      AI_MOCK: "1",
      EMAIL_MOCK: "1",
      ADMIN_EMAILS: "facilitator@example.com",
    },
    globalSetup: ["tests/unit/global-setup.ts"],
  },
});
