import { NextResponse } from "next/server";
import { canRegister } from "@/lib/access";
import { handle, HttpError } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isAdminEmail } from "@/lib/env";
import { broadcastChange } from "@/lib/realtime";
import { getEventBySlug, getParticipantByEmail, nextPresentationOrder, signInEndsAt } from "@/lib/repo";
import { firstError, registerSchema } from "@/lib/schemas";
import { readSession, sessionExpiry, writeSession } from "@/lib/session";

type Ctx = { params: Promise<{ slug: string }> };

/** Register (or update an existing registration for the same email) and sign in. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) throw new HttpError(404, "Event not found");
  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;

  const existing = await getParticipantByEmail(event.id, d.email);
  if (existing && event.status === "closed") throw new HttpError(409, "The session is closed, so needs can no longer be edited.");
  if (existing && existing.role === "guest") {
    // A guest added during the session is registering properly: upgrade them.
    await sql`update participants set role = 'participant', name = ${d.name}, chapter = ${d.chapter}, updated_at = now() where id = ${existing.id}`;
  }
  if (!existing && !canRegister(event)) {
    throw new HttpError(409, "Registration is closed. Please see the facilitator to be added.");
  }

  let participantId: string;
  if (existing) {
    participantId = existing.id;
    await sql`update participants set name = ${d.name}, chapter = ${d.chapter}, updated_at = now() where id = ${participantId}`;
  } else {
    const order = await nextPresentationOrder(event.id);
    const role = isAdminEmail(d.email) ? "facilitator" : "participant";
    const [row] = await sql<{ id: string }[]>`
      insert into participants (event_id, name, email, chapter, role, presentation_order)
      values (${event.id}, ${d.name}, ${d.email}, ${d.chapter}, ${role}, ${order})
      returning id`;
    participantId = row.id;
  }
  await sql`
    insert into needs (participant_id, event_id, category, title, description)
    values (${participantId}, ${event.id}, ${d.category}, ${d.title}, ${d.description})
    on conflict (participant_id) do update
      set category = excluded.category, title = excluded.title, description = excluded.description, updated_at = now()`;

  const prev = await readSession();
  const keepPin = !!prev && prev.eid === event.id && prev.email === d.email && prev.pin;
  await writeSession({ eid: event.id, pid: participantId, email: d.email, pin: keepPin }, sessionExpiry(await signInEndsAt(event.id)));
  await broadcastChange(slug);
  return NextResponse.json({ ok: true, updated: !!existing, participantId });
});
