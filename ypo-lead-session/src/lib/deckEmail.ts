// Emails the PowerPoint to the facilitator(s) before the session (30 minutes before by default).
import { sql } from "./db";
import { env } from "./env";
import { sendEmail } from "./email/send";
import { escapeHtml, eventWhenWhere, formatTime, tzAbbrev } from "./format";
import { buildDeck, deckFileName, slideData } from "./pptx";
import { loadEventData } from "./summaries";
import type { EventRow } from "./types";

/** Build the deck from current data and email it as an attachment. */
export async function emailDeck(event: EventRow, to: string[], now = new Date()): Promise<number> {
  const data = await loadEventData(event.id);
  const deck = await buildDeck(event, data);
  const slides = slideData(data).length;
  const filename = deckFileName(event);
  const when = `${formatTime(now, event.timezone)} ${tzAbbrev(now, event.timezone)}`;
  const adminUrl = `${env.appBaseUrl}/e/${event.slug}/admin`;
  const subject = `PowerPoint for today's Needs & Leads session (${slides} slide${slides === 1 ? "" : "s"})`;
  const text = [
    `${event.title}`,
    eventWhenWhere({ startsAt: event.starts_at, endsAt: event.ends_at, timezone: event.timezone, location: event.location }),
    "",
    `Attached is the PowerPoint, generated at ${when} with ${slides} slide${slides === 1 ? "" : "s"}: one per person, with their name and need.`,
    `If anyone edits their need after this, click Generate PowerPoint on the admin page for the latest version: ${adminUrl}`,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937;max-width:560px">
<p style="font-weight:700;color:#A51C30;margin:0">${escapeHtml(event.title)}</p>
<p style="margin:4px 0 16px;color:#4b5563;font-size:14px">${escapeHtml(eventWhenWhere({ startsAt: event.starts_at, endsAt: event.ends_at, timezone: event.timezone, location: event.location }))}</p>
<p>Attached is the PowerPoint, generated at ${escapeHtml(when)} with <b>${slides} slide${slides === 1 ? "" : "s"}</b>: one per person, with their name and need.</p>
<p>If anyone edits their need after this, click <b>Generate PowerPoint</b> on the <a href="${escapeHtml(adminUrl)}" style="color:#A51C30">admin page</a> for the latest version.</p>
</div>`;
  for (const addr of to) {
    await sendEmail({ to: addr, subject, html, text, kind: "deck", eventId: event.id, attachments: [{ filename, content: deck }] });
  }
  return to.length;
}

/** Scheduler step: send each upcoming event's deck once, `deck_minutes_before` minutes before it starts. */
export async function sendDueDecks(now: Date): Promise<void> {
  if (!env.adminEmails.length) return;
  const due = await sql<EventRow[]>`
    update events set deck_sent_at = ${now}
    where deck_sent_at is null and slug <> 'demo'
      and starts_at - make_interval(mins => deck_minutes_before) <= ${now}
      and starts_at + interval '2 hours' > ${now}
    returning *`;
  for (const event of due) {
    try {
      await emailDeck(event, env.adminEmails, now);
    } catch (err) {
      console.error(`PowerPoint email for ${event.slug} failed; will retry`, err);
      await sql`update events set deck_sent_at = null where id = ${event.id}`;
    }
  }
}
