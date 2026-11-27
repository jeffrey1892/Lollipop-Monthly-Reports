// Lead writes. One row per (need, giver): an owner check and a giver offer merge into the same row.
import { sql } from "./db";
import type { LeadRow } from "./types";

type Source = "owner" | "giver" | "facilitator";

async function history(lead: Pick<LeadRow, "id" | "need_id" | "giver_participant_id" | "strength" | "giver_note"> | null, needId: string, giverId: string, action: string, changedBy: string | null) {
  await sql`
    insert into lead_history (lead_id, need_id, giver_participant_id, action, strength, giver_note, changed_by)
    values (${lead?.id ?? null}, ${needId}, ${giverId}, ${action}, ${lead?.strength ?? null}, ${lead?.giver_note ?? null}, ${changedBy})`;
}

/** Owner (or facilitator) checks a giver and optionally rates them. */
export async function setLeadByOwner(needId: string, giverId: string, strength: number | null, recordedBy: string | null, source: Source): Promise<LeadRow> {
  const rows = await sql<LeadRow[]>`
    insert into leads (need_id, giver_participant_id, strength, source, recorded_by)
    values (${needId}, ${giverId}, ${strength}, ${source}, ${recordedBy})
    on conflict (need_id, giver_participant_id) do update
      set strength = coalesce(excluded.strength, leads.strength),
          recorded_by = excluded.recorded_by,
          updated_at = now()
    returning *`;
  await history(rows[0], needId, giverId, strength === null ? "checked" : "rated", recordedBy);
  return rows[0];
}

/** Explicitly change a rating (including clearing it back to unrated). */
export async function rateLead(needId: string, giverId: string, strength: number | null, recordedBy: string | null): Promise<LeadRow | null> {
  const rows = await sql<LeadRow[]>`
    update leads set strength = ${strength}, recorded_by = ${recordedBy}, updated_at = now()
    where need_id = ${needId} and giver_participant_id = ${giverId}
    returning *`;
  if (rows[0]) await history(rows[0], needId, giverId, "rated", recordedBy);
  return rows[0] ?? null;
}

export async function removeLead(needId: string, giverId: string, changedBy: string | null): Promise<void> {
  const rows = await sql<LeadRow[]>`
    delete from leads where need_id = ${needId} and giver_participant_id = ${giverId} returning *`;
  if (rows[0]) await history(rows[0], needId, giverId, "removed", changedBy);
}

/** Giver checks "I have a lead for you". If the owner already checked them, only the note changes. */
export async function offerLead(needId: string, giverId: string, note: string | undefined): Promise<LeadRow> {
  const rows = await sql<LeadRow[]>`
    insert into leads (need_id, giver_participant_id, strength, source, giver_note, recorded_by)
    values (${needId}, ${giverId}, null, 'giver', ${note ?? ""}, ${giverId})
    on conflict (need_id, giver_participant_id) do update
      set giver_note = case when ${note === undefined} then leads.giver_note else excluded.giver_note end,
          updated_at = now()
    returning *`;
  await history(rows[0], needId, giverId, "offered", giverId);
  return rows[0];
}

/** Giver withdraws their offer. Only removes it while it is still unrated. Returns false if it was already rated. */
export async function withdrawOffer(needId: string, giverId: string, force = false): Promise<boolean> {
  const rows = force
    ? await sql<LeadRow[]>`delete from leads where need_id = ${needId} and giver_participant_id = ${giverId} returning *`
    : await sql<LeadRow[]>`
        delete from leads where need_id = ${needId} and giver_participant_id = ${giverId} and strength is null returning *`;
  if (rows[0]) {
    await history(rows[0], needId, giverId, "withdrawn", giverId);
    return true;
  }
  return false;
}

export async function saveDraft(leadId: string, subject: string, body: string): Promise<void> {
  await sql`update leads set outreach_subject = ${subject}, outreach_body = ${body}, updated_at = now() where id = ${leadId}`;
}

/** Sort for display: strongest first, unrated last. */
export function sortLeads<T extends { strength: number | null }>(leads: T[]): T[] {
  return [...leads].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0));
}
