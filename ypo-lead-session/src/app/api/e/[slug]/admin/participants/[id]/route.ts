import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { getParticipant, getParticipantByEmail } from "@/lib/repo";
import { adminParticipantSchema, firstError } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const viewer = await requireAdmin(slug);
  const p = await getParticipant(id);
  if (!p || p.event_id !== viewer.event.id) throw new HttpError(404, "Participant not found");
  const parsed = adminParticipantSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;
  const email = d.email || null;
  if (email && email !== p.email) {
    const clash = await getParticipantByEmail(viewer.event.id, email);
    if (clash && clash.id !== id) throw new HttpError(409, "Someone else already uses that email");
  }
  await sql`update participants set name = ${d.name}, email = ${email}, chapter = ${d.chapter}, updated_at = now() where id = ${id}`;
  if (d.title) {
    await sql`
      insert into needs (participant_id, event_id, category, title, description)
      values (${id}, ${viewer.event.id}, ${d.category ?? "other"}, ${d.title}, ${d.description ?? ""})
      on conflict (participant_id) do update
        set category = excluded.category, title = excluded.title, description = excluded.description, updated_at = now()`;
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const viewer = await requireAdmin(slug);
  const p = await getParticipant(id);
  if (!p || p.event_id !== viewer.event.id) throw new HttpError(404, "Participant not found");
  await sql`delete from participants where id = ${id}`;
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
