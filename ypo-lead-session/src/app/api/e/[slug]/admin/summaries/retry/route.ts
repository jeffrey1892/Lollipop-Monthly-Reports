import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { processSummary } from "@/lib/summaries";

type Ctx = { params: Promise<{ slug: string }> };

/** Retry one failed email. Sent emails are never re-sent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = z.object({ id: z.uuid() }).safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid input");
  const [row] = await sql<{ status: string }[]>`select status from summaries where id = ${parsed.data.id} and event_id = ${viewer.event.id}`;
  if (!row) throw new HttpError(404, "Not found");
  if (row.status !== "failed") throw new HttpError(409, row.status === "sent" ? "Already sent" : "Still in progress");
  await processSummary(parsed.data.id, { manual: true });
  const [after] = await sql<{ status: string; error: string | null }[]>`select status, error from summaries where id = ${parsed.data.id}`;
  return NextResponse.json({ ok: after.status === "sent", status: after.status, error: after.error });
});
