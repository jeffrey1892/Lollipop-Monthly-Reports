import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { getParticipantByEmail, nextPresentationOrder } from "@/lib/repo";
import { adminParticipantSchema, firstError } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Add a participant (walk-ins after registration is locked). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = adminParticipantSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;
  const email = d.email || null;
  if (email && (await getParticipantByEmail(viewer.event.id, email))) throw new HttpError(409, "Someone with that email is already registered");
  const order = await nextPresentationOrder(viewer.event.id);
  const [row] = await sql<{ id: string }[]>`
    insert into participants (event_id, name, email, chapter, role, presentation_order)
    values (${viewer.event.id}, ${d.name}, ${email}, ${d.chapter}, 'participant', ${order})
    returning id`;
  if (d.title) {
    await sql`
      insert into needs (participant_id, event_id, category, title, description)
      values (${row.id}, ${viewer.event.id}, ${d.category ?? "other"}, ${d.title}, ${d.description ?? ""})`;
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true, participantId: row.id });
});
