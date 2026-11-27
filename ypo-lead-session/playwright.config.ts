import { defineConfig, devices } from "@playwright/test";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ypo_e2e";
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: {
    // Run `npm run build` first. The server runs with Claude and email in mock mode.
    command: `npx tsx e2e/reset-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/e/ypo-week-2-lead-session/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: DB,
      APP_BASE_URL: `http://localhost:${PORT}`,
      AI_MOCK: "1",
      EMAIL_MOCK: "1",
      ADMIN_EMAILS: "facilitator@example.com",
      ADMIN_PIN: "2468",
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret",
      CRON_SECRET: "e2e-cron",
      ALLOW_TEST_CLOCK: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
