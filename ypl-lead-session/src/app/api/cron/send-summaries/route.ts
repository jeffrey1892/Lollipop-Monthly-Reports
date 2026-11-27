import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runScheduler } from "@/lib/summaries";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Called every 5 minutes by Vercel Cron (or Supabase pg_cron). Closes overdue sessions and sends due summaries. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const nowParam = new URL(req.url).searchParams.get("now");
  const now = env.allowTestClock && nowParam ? new Date(nowParam) : new Date();
  const result = await runScheduler(now);
  return NextResponse.json({ ok: true, ...result, now: now.toISOString() });
}
