import postgres from "postgres";
import { env } from "./env";

declare global {
  var __ypoSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is not set");
  return postgres(env.databaseUrl, {
    max: 5,
    idle_timeout: 20,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !env.databaseUrl.includes(":6543"),
    onnotice: () => {},
  });
}

// Reuse one pool across hot reloads and warm serverless invocations.
export const sql: ReturnType<typeof postgres> = globalThis.__ypoSql ?? (globalThis.__ypoSql = create());
