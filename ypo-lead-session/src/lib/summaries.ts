// Post-session summaries: assembly, automatic scheduling and idempotent sending.
import { sql } from "./db";
import { env } from "./env";
import { draftOutreachEmail, generateDigestOverview, generateSummaryText, type SummaryAi } from "./ai";
import { sendEmail } from "./email/send";
import {
  renderDigestEmail,
  renderPersonalEmail,
  type DigestContent,
  type EventInfo,
  type PersonalSummaryContent,
} from "./email/templates";
import { sortLeads } from "./leads";
import { listLeads, listNeeds, listNotes, listParticipants, presenters } from "./repo";
import type { EventRow, LeadRow, NeedRow, NoteRow, ParticipantRow } from "./types";
import { categoryLabel } from "./types";

const MAX_AUTO_ATTEMPTS = 3;
const CONCURRENCY = 5;

export function eventInfo(event: EventRow): EventInfo {
  return {
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    location: event.location,
    appUrl: `${env.appBaseUrl}/e/${event.slug}/me`,
  };
}

export interface EventData {
  participants: ParticipantRow[];
  needs: NeedRow[];
  leads: LeadRow[];
  notes: NoteRow[];
}

export async function loadEventData(eventId: string): Promise<EventData> {
  const [participants, needs, leads, notes] = await Promise.all([
    listParticipants(eventId),
    listNeeds(eventId),
    listLeads(eventId),
    listNotes(eventId),
  ]);
  return { participants, needs, leads, notes };
}

/** Facts for one person's summary, straight from the database (no AI). */
export function collectPersonalFacts(participant: ParticipantRow, data: EventData) {
  const byId = new Map(data.participants.map((p) => [p.id, p]));
  const needById = new Map(data.needs.map((n) => [n.id, n]));
  const need = data.needs.find((n) => n.participant_id === participant.id) ?? null;
  const received = need ? sortLeads(data.leads.filter((l) => l.need_id === need.id)) : [];
  const offered = data.leads.filter((l) => l.giver_participant_id === participant.id);
  const notesAboutMyNeed = need
    ? data.notes.filter((n) => n.need_id === need.id && n.visibility === "shared" && n.author_participant_id !== participant.id && n.body.trim())
    : [];
  const myNotes = data.notes.filter((n) => n.author_participant_id === participant.id && n.body.trim());
  return { need, received, offered, notesAboutMyNeed, myNotes, byId, needById };
}

/** Merge database facts with AI-written text. Facts (names, emails, ratings) always come from the database. */
export function assemblePersonalContent(
  participant: ParticipantRow,
  data: EventData,
  ai: SummaryAi,
  drafts: Map<string, { subject: string; body: string }>,
): PersonalSummaryContent {
  const f = collectPersonalFacts(participant, data);
  const ownerOf = (needId: string) => {
    const n = f.needById.get(needId);
    return n ? f.byId.get(n.participant_id) : undefined;
  };
  return {
    name: participant.name,
    chapter: participant.chapter,
    needTitle: f.need?.title ?? "",
    needDescription: f.need?.description ?? "",
    needRecap: ai.need_recap,
    leads: f.received.map((l, i) => {
      const giver = f.byId.get(l.giver_participant_id);
      const draft = drafts.get(l.id) ?? { subject: l.outreach_subject ?? "", body: l.outreach_body ?? "" };
      return {
        giverName: giver?.name ?? "A member",
        giverEmail: giver?.email ?? null,
        chapter: giver?.chapter ?? "",
        strength: l.strength,
        giverNote: l.giver_note,
        suggestedNextStep: ai.lead_next_steps[i]?.suggested_next_step ?? "Reach out this week to set up a short call.",
        outreachSubject: draft.subject,
        outreachBody: draft.body,
      };
    }),
    leadsOffered: f.offered.map((l, i) => {
      const owner = ownerOf(l.need_id);
      return {
        name: owner?.name ?? "A member",
        needTitle: f.needById.get(l.need_id)?.title ?? "",
        note: l.giver_note,
        reminder: ai.offered_follow_ups[i]?.reminder ?? "Follow through on the lead you offered.",
      };
    }),
    notesAboutMyNeed: f.notesAboutMyNeed.map((n) => ({ author: f.byId.get(n.author_participant_id)?.name ?? "A member", body: n.body })),
    myNotes: f.myNotes.map((n) => ({
      onWhoseNeed: ownerOf(n.need_id)?.name ?? "someone",
      body: n.body,
      visibility: n.visibility,
    })),
    top3Actions: ai.top_3_actions.slice(0, 3),
  };
}

/** Build one person's summary content, writing any missing outreach drafts and saving them. */
export async function buildPersonalSummary(participant: ParticipantRow, data: EventData): Promise<PersonalSummaryContent> {
  const f = collectPersonalFacts(participant, data);
  const drafts = new Map<string, { subject: string; body: string }>();
  for (const l of f.received) {
    if (l.outreach_subject && l.outreach_body) continue;
    const giver = f.byId.get(l.giver_participant_id);
    const d = await draftOutreachEmail({
      senderName: participant.name,
      senderChapter: participant.chapter,
      needTitle: f.need?.title ?? "",
      needDescription: f.need?.description ?? "",
      leadName: giver?.name ?? "there",
      leadChapter: giver?.chapter ?? "",
      leadNote: l.giver_note,
    });
    drafts.set(l.id, d);
    await sql`update leads set outreach_subject = ${d.subject}, outreach_body = ${d.body} where id = ${l.id} and outreach_body is null`;
  }
  const ai = await generateSummaryText({
    name: participant.name,
    chapter: participant.chapter,
    needTitle: f.need?.title ?? "",
    needDescription: f.need?.description ?? "",
    leads: f.received.map((l) => {
      const g = f.byId.get(l.giver_participant_id);
      return { giverName: g?.name ?? "A member", giverChapter: g?.chapter ?? "", giverNote: l.giver_note, rated: l.strength ? `${l.strength}/5` : "not rated" };
    }),
    offered: f.offered.map((l) => {
      const n = f.needById.get(l.need_id);
      return { toName: (n && f.byId.get(n.participant_id)?.name) || "A member", needTitle: n?.title ?? "", note: l.giver_note };
    }),
    sharedNotes: f.notesAboutMyNeed.map((n) => n.body),
  });
  return assemblePersonalContent(participant, data, ai, drafts);
}

export function collectDigestFacts(data: EventData) {
  const byId = new Map(data.participants.map((p) => [p.id, p]));
  const people = presenters(data.participants, data.needs).map((p) => {
    const need = data.needs.find((n) => n.participant_id === p.id)!;
    const leads = data.leads.filter((l) => l.need_id === need.id);
    return {
      name: p.name,
      chapter: p.chapter,
      category: need.category,
      needTitle: need.title,
      needDescription: need.description,
      leadCount: leads.length,
      leadGivers: leads.map((l) => byId.get(l.giver_participant_id)?.name ?? "A member"),
    };
  });
  return { people, totalLeads: data.leads.length };
}

export async function buildDigest(event: EventRow, data: EventData): Promise<DigestContent> {
  const { people, totalLeads } = collectDigestFacts(data);
  const overview = await generateDigestOverview({
    eventTitle: event.title,
    people: people.length,
    totalLeads,
    lines: people.map((p) => `- ${categoryLabel(p.category)}: ${p.needTitle}`),
  });
  return { overview, totalLeads, people };
}

/** The digest is written once per event and reused for every recipient. */
async function ensureDigest(event: EventRow, data?: EventData): Promise<DigestContent> {
  const [fresh] = await sql<{ digest_json: DigestContent | null }[]>`select digest_json from events where id = ${event.id}`;
  if (fresh?.digest_json) return fresh.digest_json;
  const digest = await buildDigest(event, data ?? (await loadEventData(event.id)));
  const saved = await sql<{ digest_json: DigestContent }[]>`
    update events set digest_json = ${sql.json(JSON.parse(JSON.stringify(digest)))}
    where id = ${event.id} and digest_json is null returning digest_json`;
  if (saved[0]) return saved[0].digest_json;
  const [again] = await sql<{ digest_json: DigestContent }[]>`select digest_json from events where id = ${event.id}`;
  return again.digest_json;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Close events whose backstop time has passed: end time, or 6:00 PM local on the event day if no end time. */
async function autoClose(now: Date) {
  await sql`
    update events set
      status = 'closed',
      closed_at = b.backstop,
      send_due_at = coalesce(events.summaries_send_at, b.backstop + make_interval(mins => events.send_delay_minutes)),
      updated_at = now()
    from (
      select id, coalesce(ends_at, (((starts_at at time zone timezone)::date + time '18:00') at time zone timezone)) as backstop
      from events
    ) b
    where b.id = events.id and events.status <> 'closed' and b.backstop <= ${now} and events.slug <> 'demo'`;
}

/** Start every closed event whose send time has arrived: freeze leads, write the digest, queue one row per email. */
async function startDueEvents(now: Date) {
  const due = await sql<EventRow[]>`
    update events set summaries_started_at = ${now}, updated_at = now()
    where status = 'closed' and send_due_at <= ${now} and summaries_started_at is null
    returning *`;
  for (const event of due) {
    const data = await loadEventData(event.id);
    const withNeed = new Set(data.needs.map((n) => n.participant_id));
    for (const p of data.participants) {
      if (p.role === "guest" || !p.email) continue;
      if (withNeed.has(p.id)) {
        await sql`insert into summaries (participant_id, event_id, kind) values (${p.id}, ${event.id}, 'personal') on conflict do nothing`;
      }
      await sql`insert into summaries (participant_id, event_id, kind) values (${p.id}, ${event.id}, 'digest') on conflict do nothing`;
    }
    try {
      await ensureDigest(event, data);
    } catch (err) {
      console.error("digest generation failed; will retry when sending", err);
    }
  }
}

interface SummaryJob {
  id: string;
  participant_id: string;
  event_id: string;
  kind: "personal" | "digest";
}

/** Claim, build, send and record one email. Never sends the same row twice. */
export async function processSummary(jobId: string, opts: { manual?: boolean } = {}): Promise<void> {
  const claimed = await sql<(SummaryJob & { content_json: unknown })[]>`
    update summaries set status = 'sending', attempts = attempts + 1, updated_at = now(), error = null
    where id = ${jobId} and status in ('pending', 'failed') ${opts.manual ? sql`` : sql`and attempts < ${MAX_AUTO_ATTEMPTS}`}
    returning id, participant_id, event_id, kind, content_json`;
  const job = claimed[0];
  if (!job) return; // already sent, being sent elsewhere, or out of retries

  try {
    const [event] = await sql<EventRow[]>`select * from events where id = ${job.event_id}`;
    const [participant] = await sql<ParticipantRow[]>`select * from participants where id = ${job.participant_id}`;
    if (!event || !participant?.email) throw new Error("Participant has no email address");
    const info = eventInfo(event);

    let rendered: { subject: string; html: string; text: string };
    let content: unknown = job.content_json;
    if (job.kind === "personal") {
      if (!content) {
        content = await buildPersonalSummary(participant, await loadEventData(event.id));
        await sql`update summaries set content_json = ${sql.json(JSON.parse(JSON.stringify(content)))} where id = ${job.id}`;
      }
      rendered = renderPersonalEmail(info, content as PersonalSummaryContent);
    } else {
      rendered = renderDigestEmail(info, await ensureDigest(event));
    }

    await sendEmail({ to: participant.email, ...rendered, kind: job.kind, eventId: event.id, participantId: participant.id });
    await sql`update summaries set status = 'sent', sent_at = now(), html = ${rendered.html}, updated_at = now() where id = ${job.id}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`summary ${job.id} failed:`, message);
    await sql`update summaries set status = 'failed', error = ${message.slice(0, 500)}, updated_at = now() where id = ${job.id}`;
  }
}

async function markFinishedEvents() {
  await sql`
    update events set summaries_sent_at = now(), updated_at = now()
    where summaries_started_at is not null and summaries_sent_at is null
      and not exists (select 1 from summaries s where s.event_id = events.id and s.status <> 'sent')`;
}

/**
 * The scheduler. Runs from the cron endpoint every few minutes, and opportunistically while people use the app.
 * Safe to run concurrently: every step is guarded by an atomic UPDATE.
 */
export async function runScheduler(now = new Date(), budgetMs = 240_000): Promise<{ processed: number }> {
  const started = Date.now();
  await autoClose(now);
  await startDueEvents(now);

  // A row stuck in "sending" for 10+ minutes was interrupted; flag it for a manual retry rather than risk a double send.
  await sql`
    update summaries set status = 'failed', attempts = ${MAX_AUTO_ATTEMPTS}, error = 'Interrupted while sending. Use Retry if this person did not receive it.'
    where status = 'sending' and updated_at < now() - interval '10 minutes'`;

  const jobs = await sql<{ id: string }[]>`
    select id from summaries
    where status = 'pending' or (status = 'failed' and attempts < ${MAX_AUTO_ATTEMPTS})
    order by kind desc, updated_at asc
    limit 200`;
  let processed = 0;
  await pool(jobs, CONCURRENCY, async (j) => {
    if (Date.now() - started > budgetMs) return; // leave the rest for the next run
    await processSummary(j.id);
    processed++;
  });
  await markFinishedEvents();
  return { processed };
}

let lastOpportunisticRun = 0;
/** Cheap check used by normal page traffic, so sending still happens if cron is not set up. */
export async function maybeRunScheduler(): Promise<void> {
  if (Date.now() - lastOpportunisticRun < 60_000) return;
  lastOpportunisticRun = Date.now();
  try {
    await runScheduler(new Date(), 50_000);
  } catch (err) {
    console.error("scheduler error", err);
  }
}

/** Send the facilitator a sample summary, built from the demo event (or this event if no demo data). */
export async function sendTestSummary(event: EventRow, toEmail: string): Promise<string> {
  const [demo] = await sql<EventRow[]>`select * from events where slug = 'demo'`;
  for (const source of [demo, event].filter(Boolean) as EventRow[]) {
    const data = await loadEventData(source.id);
    const subject = presenters(data.participants, data.needs)[0];
    if (!subject) continue;
    const content = await buildPersonalSummary(subject, data);
    const rendered = renderPersonalEmail(eventInfo(event), content);
    await sendEmail({ to: toEmail, subject: `[TEST] ${rendered.subject}`, html: rendered.html, text: rendered.text, kind: "test", eventId: event.id });
    return `Test summary for ${subject.name} sent to ${toEmail}.`;
  }
  throw new Error("No participants with a need yet. Run the seed script to create demo data.");
}
