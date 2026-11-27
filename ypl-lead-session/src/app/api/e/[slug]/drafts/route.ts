import { NextResponse } from "next/server";
import { canSeeDrafts } from "@/lib/access";
import { draftOutreachEmail } from "@/lib/ai";
import { AiRefusalError } from "@/lib/ai/client";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { saveDraft } from "@/lib/leads";
import { getLead, getNeed, getParticipant } from "@/lib/repo";
import { draftSchema, firstError } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Cut-and-paste outreach drafts. The app never sends these; the person copies them into their own email. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  const parsed = draftSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;

  const lead = await getLead(d.leadId);
  const need = lead ? await getNeed(lead.need_id) : null;
  if (!lead || !need || need.event_id !== viewer.event.id) throw new HttpError(404, "Lead not found");
  if (!canSeeDrafts(viewer, need)) throw new HttpError(403, "You can only draft emails for your own leads");

  if (d.action === "save") {
    await saveDraft(lead.id, d.subject, d.body);
    return NextResponse.json({ ok: true, subject: d.subject, body: d.body });
  }

  const [sender, giver] = await Promise.all([getParticipant(need.participant_id), getParticipant(lead.giver_participant_id)]);
  try {
    const draft = await draftOutreachEmail({
      senderName: sender?.name ?? "",
      senderChapter: sender?.chapter ?? "",
      needTitle: need.title,
      needDescription: need.description,
      leadName: giver?.name ?? "there",
      leadChapter: giver?.chapter ?? "",
      leadNote: lead.giver_note,
    });
    await saveDraft(lead.id, draft.subject, draft.body);
    return NextResponse.json({ ok: true, ...draft });
  } catch (err) {
    if (err instanceof AiRefusalError) throw new HttpError(422, err.message);
    console.error(err);
    throw new HttpError(503, "Couldn't write a draft right now. Please try again in a minute.");
  }
});
