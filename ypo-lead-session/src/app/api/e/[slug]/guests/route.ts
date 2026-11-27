import { NextResponse } from "next/server";
import { canManageLeadsOn } from "@/lib/access";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { sql } from "@/lib/db";
import { setLeadByOwner } from "@/lib/leads";
import { broadcastChange } from "@/lib/realtime";
import { getNeed, getParticipantByEmail } from "@/lib/repo";
import { firstError, guestSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** "Add someone not on the list": a guest who raised their hand but never registered. They cannot sign in. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  const parsed = guestSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;

  const need = d.needId ? await getNeed(d.needId) : null;
  if (d.needId && (!need || need.event_id !== viewer.event.id)) throw new HttpError(404, "Need not found");
  if (need && !canManageLeadsOn(viewer, need, viewer.event)) throw new HttpError(403, "You can only add leads to your own need");
  if (!need && !viewer.isAdmin) throw new HttpError(403, "Facilitator access only");

  const email = d.email ? d.email : null;
  let guestId: string;
  const existing = email ? await getParticipantByEmail(viewer.event.id, email) : null;
  if (existing) {
    guestId = existing.id;
  } else {
    const [row] = await sql<{ id: string }[]>`
      insert into participants (event_id, name, email, chapter, role, presentation_order)
      values (${viewer.event.id}, ${d.name}, ${email}, ${d.chapter ?? ""}, 'guest', 0)
      returning id`;
    guestId = row.id;
  }
  if (need) {
    if (guestId === need.participant_id) throw new HttpError(400, "You can't be a lead for your own need");
    await setLeadByOwner(need.id, guestId, d.strength ?? null, viewer.participantId, viewer.participantId === need.participant_id ? "owner" : "facilitator");
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true, participantId: guestId });
});
