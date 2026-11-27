// Fresh database for every end-to-end run (runs before the test server starts).
import { execSync } from "node:child_process";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL!;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema public cascade; create schema public;");
  await sql.end();
  execSync("npx tsx scripts/migrate.ts", { env: process.env, stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
