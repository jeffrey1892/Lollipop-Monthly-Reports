import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

/** Send status for the admin page. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const rows = await sql<{ id: string; kind: string; status: string; attempts: number; sent_at: Date | null; error: string | null; name: string; email: string | null }[]>`
    select s.id, s.kind, s.status, s.attempts, s.sent_at, s.error, p.name, p.email
    from summaries s join participants p on p.id = s.participant_id
    where s.event_id = ${viewer.event.id}
    order by p.name, s.kind desc`;
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
});
