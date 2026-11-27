import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";
import { getEventBySlug, getParticipantByEmail, signInEndsAt } from "@/lib/repo";
import { firstError, loginSchema } from "@/lib/schemas";
import { readSession, sessionExpiry, writeSession } from "@/lib/session";

type Ctx = { params: Promise<{ slug: string }> };

/** Email-only sign in. Registered participants are signed in immediately; facilitators may sign in without registering. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) throw new HttpError(404, "Event not found");
  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const { email } = parsed.data;

  const participant = await getParticipantByEmail(event.id, email);
  if (participant && participant.role !== "guest") {
    const prev = await readSession();
    const keepPin = !!prev && prev.eid === event.id && prev.email === email && prev.pin;
    await writeSession({ eid: event.id, pid: participant.id, email, pin: keepPin }, sessionExpiry(await signInEndsAt(event.id)));
    return NextResponse.json({ ok: true, next: isAdminEmail(email) && !keepPin ? `/e/${slug}/admin` : `/e/${slug}/live` });
  }
  if (isAdminEmail(email)) {
    await writeSession({ eid: event.id, pid: null, email, pin: false }, sessionExpiry(await signInEndsAt(event.id)));
    return NextResponse.json({ ok: true, next: `/e/${slug}/admin` });
  }
  return NextResponse.json({ ok: false, notRegistered: true, next: `/e/${slug}/register?email=${encodeURIComponent(email)}` });
});
