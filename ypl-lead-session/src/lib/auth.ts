import { NextResponse } from "next/server";
import { isAdminEmail } from "./env";
import { getEventBySlug, getParticipant } from "./repo";
import { readSession } from "./session";
import type { EventRow, ParticipantRow } from "./types";

export interface Viewer {
  event: EventRow;
  participant: ParticipantRow | null;
  email: string;
  isAdminEmail: boolean;
  isAdmin: boolean; // admin email AND PIN entered
  participantId: string | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The signed-in viewer for this event, or null if not signed in to it. */
export async function getViewer(slug: string): Promise<Viewer | null> {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  const session = await readSession();
  if (!session || session.eid !== event.id) return null;
  const participant = session.pid ? await getParticipant(session.pid) : null;
  if (session.pid && (!participant || participant.event_id !== event.id)) return null;
  const adminEmail = isAdminEmail(session.email);
  return {
    event,
    participant,
    email: session.email,
    isAdminEmail: adminEmail,
    isAdmin: adminEmail && session.pin,
    participantId: participant?.id ?? null,
  };
}

export async function requireViewer(slug: string): Promise<Viewer> {
  const event = await getEventBySlug(slug);
  if (!event) throw new HttpError(404, "Event not found");
  const viewer = await getViewer(slug);
  if (!viewer) throw new HttpError(401, "Please sign in");
  return viewer;
}

export async function requireAdmin(slug: string): Promise<Viewer> {
  const viewer = await requireViewer(slug);
  if (!viewer.isAdmin) throw new HttpError(403, "Facilitator access only");
  return viewer;
}

export function viewerSummary(v: Viewer) {
  return {
    participantId: v.participantId,
    name: v.participant?.name ?? v.email,
    email: v.email,
    isAdmin: v.isAdmin,
    isAdminEmail: v.isAdminEmail,
  };
}

/** Wraps an API handler: turns HttpError and validation failures into JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
