import { sql } from "./db";
import type { EventRow, LeadRow, NeedRow, NoteRow, ParticipantRow, Snapshot } from "./types";
import { leadsLocked, noteVisibleTo, canSeeDrafts } from "./access";

// sign_in_until comes back as a plain YYYY-MM-DD string.
const EVENT_COLS = sql`*, to_char(sign_in_until, 'YYYY-MM-DD') as sign_in_until`;

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const rows = await sql<EventRow[]>`select ${EVENT_COLS} from events where slug = ${slug}`;
  return rows[0] ?? null;
}

/** End of the event's "signed in through" date, in the event's time zone. */
export async function signInEndsAt(eventId: string): Promise<Date | null> {
  const rows = await sql<{ ends: Date | null }[]>`
    select ((sign_in_until + 1)::timestamp at time zone timezone) as ends from events where id = ${eventId}`;
  return rows[0]?.ends ?? null;
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const rows = await sql<EventRow[]>`select ${EVENT_COLS} from events where id = ${id}`;
  return rows[0] ?? null;
}

export async function listEvents(): Promise<EventRow[]> {
  return sql<EventRow[]>`select ${EVENT_COLS} from events where slug <> 'demo' order by starts_at desc`;
}

export async function getParticipant(id: string): Promise<ParticipantRow | null> {
  const rows = await sql<ParticipantRow[]>`select * from participants where id = ${id}`;
  return rows[0] ?? null;
}

export async function getParticipantByEmail(eventId: string, email: string): Promise<ParticipantRow | null> {
  const rows = await sql<ParticipantRow[]>`
    select * from participants where event_id = ${eventId} and email = ${email.toLowerCase()}`;
  return rows[0] ?? null;
}

export async function listParticipants(eventId: string): Promise<ParticipantRow[]> {
  return sql<ParticipantRow[]>`
    select * from participants where event_id = ${eventId}
    order by presentation_order asc, created_at asc`;
}

export async function listNeeds(eventId: string): Promise<NeedRow[]> {
  return sql<NeedRow[]>`select * from needs where event_id = ${eventId}`;
}

export async function getNeed(id: string): Promise<NeedRow | null> {
  const rows = await sql<NeedRow[]>`select * from needs where id = ${id}`;
  return rows[0] ?? null;
}

export async function getNeedByParticipant(participantId: string): Promise<NeedRow | null> {
  const rows = await sql<NeedRow[]>`select * from needs where participant_id = ${participantId}`;
  return rows[0] ?? null;
}

export async function listLeads(eventId: string): Promise<LeadRow[]> {
  return sql<LeadRow[]>`
    select l.* from leads l join needs n on n.id = l.need_id
    where n.event_id = ${eventId}`;
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const rows = await sql<LeadRow[]>`select * from leads where id = ${id}`;
  return rows[0] ?? null;
}

export async function getLeadByPair(needId: string, giverId: string): Promise<LeadRow | null> {
  const rows = await sql<LeadRow[]>`select * from leads where need_id = ${needId} and giver_participant_id = ${giverId}`;
  return rows[0] ?? null;
}

export async function listNotes(eventId: string): Promise<NoteRow[]> {
  return sql<NoteRow[]>`
    select t.* from notes t join needs n on n.id = t.need_id
    where n.event_id = ${eventId}`;
}

export async function nextPresentationOrder(eventId: string): Promise<number> {
  const rows = await sql<{ next: number }[]>`
    select coalesce(max(presentation_order), 0) + 1 as next from participants where event_id = ${eventId}`;
  return Number(rows[0]?.next ?? 1);
}

/** Participants who have a need, in speaking order. */
export function presenters(participants: ParticipantRow[], needs: NeedRow[]): ParticipantRow[] {
  const withNeed = new Set(needs.map((n) => n.participant_id));
  return participants
    .filter((p) => withNeed.has(p.id) && p.role !== "guest")
    .sort((a, b) => a.presentation_order - b.presentation_order || +a.created_at - +b.created_at);
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function buildSnapshot(
  event: EventRow,
  viewer: Snapshot["viewer"],
): Promise<Snapshot> {
  const [participants, needs, leads, notes] = await Promise.all([
    listParticipants(event.id),
    listNeeds(event.id),
    listLeads(event.id),
    listNotes(event.id),
  ]);
  const needById = new Map(needs.map((n) => [n.id, n]));
  const nameById = new Map(participants.map((p) => [p.id, p.name]));
  const v = { participantId: viewer.participantId, isAdmin: viewer.isAdmin };

  return {
    viewer,
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      location: event.location,
      startsAt: iso(event.starts_at)!,
      endsAt: iso(event.ends_at),
      timezone: event.timezone,
      status: event.status,
      currentPresenterId: event.current_presenter_id,
      sendDelayMinutes: event.send_delay_minutes,
      sendDueAt: iso(event.send_due_at),
      summariesStartedAt: iso(event.summaries_started_at),
      summariesSentAt: iso(event.summaries_sent_at),
      leadsLocked: leadsLocked(event),
      signInUntil: event.sign_in_until,
      summariesSendAt: iso(event.summaries_send_at),
      deckEmailAt: new Date(new Date(event.starts_at).getTime() - event.deck_minutes_before * 60_000).toISOString(),
      deckSentAt: iso(event.deck_sent_at),
    },
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      chapter: p.chapter,
      role: p.role,
      presentationOrder: p.presentation_order,
    })),
    needs: needs.map((n) => ({
      id: n.id,
      participantId: n.participant_id,
      category: n.category,
      title: n.title,
      description: n.description,
      updatedAt: iso(n.updated_at)!,
    })),
    leads: leads.map((l) => {
      const need = needById.get(l.need_id);
      const drafts = need ? canSeeDrafts(v, need) : false;
      return {
        id: l.id,
        needId: l.need_id,
        giverId: l.giver_participant_id,
        strength: l.strength,
        source: l.source,
        giverNote: l.giver_note,
        outreachSubject: drafts ? l.outreach_subject : null,
        outreachBody: drafts ? l.outreach_body : null,
      };
    }),
    notes: notes
      .filter((n) => noteVisibleTo(n, viewer.participantId))
      .map((n) => ({
        id: n.id,
        needId: n.need_id,
        authorId: n.author_participant_id,
        authorName: nameById.get(n.author_participant_id) ?? "Someone",
        body: n.body,
        visibility: n.visibility,
        updatedAt: iso(n.updated_at)!,
      })),
  };
}
