import { NextResponse } from "next/server";
import { canEditNeed } from "@/lib/access";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { getNeedByParticipant, getParticipant } from "@/lib/repo";
import { firstError, needUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Edit a need (autosaved from My Need). Owners until the session closes; facilitators any time. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  const parsed = needUpdateSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;
  const participantId = d.participantId ?? viewer.participantId;
  if (!participantId) throw new HttpError(400, "No participant");
  const participant = await getParticipant(participantId);
  if (!participant || participant.event_id !== viewer.event.id) throw new HttpError(404, "Participant not found");
  if (!canEditNeed(viewer, { participant_id: participantId }, viewer.event)) {
    throw new HttpError(403, viewer.event.status === "closed" ? "The session is closed, so needs can no longer be edited." : "You can only edit your own need");
  }
  const existing = await getNeedByParticipant(participantId);
  await sql`
    insert into needs (participant_id, event_id, category, title, description)
    values (${participantId}, ${viewer.event.id}, ${d.category}, ${d.title}, ${d.description})
    on conflict (participant_id) do update
      set category = excluded.category, title = excluded.title, description = excluded.description, updated_at = now()`;
  await broadcastChange(slug);
  return NextResponse.json({ ok: true, created: !existing });
});
