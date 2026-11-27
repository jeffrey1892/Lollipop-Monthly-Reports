import { NextResponse } from "next/server";
import { canOfferOn, canWithdrawOffer } from "@/lib/access";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { offerLead, withdrawOffer } from "@/lib/leads";
import { broadcastChange } from "@/lib/realtime";
import { getLeadByPair, getNeed } from "@/lib/repo";
import { firstError, offerSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** "I have a lead for you": any participant offers (or withdraws) a lead on someone else's need. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  if (!viewer.participantId) throw new HttpError(403, "Register first to offer leads");
  const parsed = offerSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const { needId, checked, note } = parsed.data;

  const need = await getNeed(needId);
  if (!need || need.event_id !== viewer.event.id) throw new HttpError(404, "Need not found");
  if (!canOfferOn(viewer, need, viewer.event)) {
    throw new HttpError(403, need.participant_id === viewer.participantId ? "You can't offer a lead on your own need" : "Summaries have gone out, so leads are final.");
  }

  if (checked) {
    await offerLead(needId, viewer.participantId, note);
  } else {
    const lead = await getLeadByPair(needId, viewer.participantId);
    if (lead) {
      if (!canWithdrawOffer(viewer, lead, need, viewer.event)) {
        throw new HttpError(409, "This lead has already been rated, so only the person you offered it to can remove it.");
      }
      await withdrawOffer(needId, viewer.participantId, viewer.isAdmin);
    }
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
