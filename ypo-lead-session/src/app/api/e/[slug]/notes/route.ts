import { NextResponse } from "next/server";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { getNeed } from "@/lib/repo";
import { firstError, noteSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Autosaved notes: one note per person per need. Private by default. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  if (!viewer.participantId) throw new HttpError(403, "Register first to take notes");
  const parsed = noteSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const { needId, body, visibility } = parsed.data;
  const need = await getNeed(needId);
  if (!need || need.event_id !== viewer.event.id) throw new HttpError(404, "Need not found");

  const [row] = await sql<{ id: string; updated_at: Date }[]>`
    insert into notes (need_id, author_participant_id, body, visibility)
    values (${needId}, ${viewer.participantId}, ${body}, ${visibility})
    on conflict (need_id, author_participant_id) do update
      set body = excluded.body, visibility = excluded.visibility, updated_at = now()
    returning id, updated_at`;
  if (visibility === "shared") await broadcastChange(slug);
  return NextResponse.json({ ok: true, id: row.id, updatedAt: row.updated_at });
});
