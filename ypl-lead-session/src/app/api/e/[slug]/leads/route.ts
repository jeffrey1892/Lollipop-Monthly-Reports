import { NextResponse } from "next/server";
import { canManageLeadsOn } from "@/lib/access";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { rateLead, removeLead, setLeadByOwner } from "@/lib/leads";
import { broadcastChange } from "@/lib/realtime";
import { getLeadByPair, getNeed, getParticipant } from "@/lib/repo";
import { firstError, leadSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** "Check your leads": the need's owner (or a facilitator) checks, rates or removes a lead. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  const parsed = leadSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const { needId, giverId, strength, remove } = parsed.data;

  const need = await getNeed(needId);
  if (!need || need.event_id !== viewer.event.id) throw new HttpError(404, "Need not found");
  if (!canManageLeadsOn(viewer, need, viewer.event)) {
    throw new HttpError(403, viewer.event.summaries_started_at ? "Summaries have gone out, so leads are final." : "You can only check leads on your own need");
  }
  const giver = await getParticipant(giverId);
  if (!giver || giver.event_id !== viewer.event.id) throw new HttpError(404, "Person not found");
  if (giver.id === need.participant_id) throw new HttpError(400, "You can't be a lead for your own need");

  const actor = viewer.participantId;
  const source = viewer.participantId === need.participant_id ? "owner" : "facilitator";
  if (remove) {
    await removeLead(needId, giverId, actor);
  } else if (await getLeadByPair(needId, giverId)) {
    await rateLead(needId, giverId, strength, actor);
  } else {
    await setLeadByOwner(needId, giverId, strength, actor, source);
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
