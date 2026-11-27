import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { getParticipant } from "@/lib/repo";
import { presenterSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** The facilitator moves the room to the next presenter; follow mode on every phone tracks this. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = presenterSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid input");
  const id = parsed.data.participantId;
  if (id) {
    const p = await getParticipant(id);
    if (!p || p.event_id !== viewer.event.id) throw new HttpError(404, "Participant not found");
  }
  await sql`update events set current_presenter_id = ${id}, updated_at = now() where id = ${viewer.event.id}`;
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
