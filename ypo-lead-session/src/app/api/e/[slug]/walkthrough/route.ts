import { NextResponse } from "next/server";
import { handle, requireViewer } from "@/lib/auth";
import { sql } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

/** Remember that this person has seen the walkthrough, so it doesn't open automatically again. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  if (viewer.participantId) {
    await sql`update participants set walkthrough_seen_at = coalesce(walkthrough_seen_at, now()) where id = ${viewer.participantId}`;
  }
  return NextResponse.json({ ok: true });
});
