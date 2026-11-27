// Central place for configuration. Optional services fall back to safe local behaviour.
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM || "YPL Lead Session <onboarding@resend.dev>",
  appBaseUrl: (process.env.APP_BASE_URL || "http://localhost:3100").replace(/\/$/, ""),
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  adminPin: process.env.ADMIN_PIN ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  aiMock: process.env.AI_MOCK === "1" || !process.env.ANTHROPIC_API_KEY,
  emailMock: process.env.EMAIL_MOCK === "1" || !process.env.RESEND_API_KEY,
  allowTestClock: process.env.ALLOW_TEST_CLOCK === "1",
};

export const DEFAULT_EVENT_SLUG = "ypl-week-2-lead-session";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && env.adminEmails.includes(email.trim().toLowerCase());
}
