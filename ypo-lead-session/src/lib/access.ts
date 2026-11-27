// Pure access rules, shared by API routes and unit tests.
import type { EventRow, LeadRow, NeedRow, NoteRow } from "./types";

export interface ViewerLike {
  participantId: string | null;
  isAdmin: boolean;
}

/** Leads freeze once summary generation has started. */
export function leadsLocked(event: Pick<EventRow, "summaries_started_at">): boolean {
  return event.summaries_started_at !== null;
}

/** Rate, change or remove a lead on a need: only the owner, or a facilitator. */
export function canManageLeadsOn(
  viewer: ViewerLike,
  need: Pick<NeedRow, "participant_id">,
  event: Pick<EventRow, "summaries_started_at">,
): boolean {
  if (viewer.isAdmin) return true;
  if (leadsLocked(event)) return false;
  return viewer.participantId !== null && viewer.participantId === need.participant_id;
}

/** Offer "I have a lead for you": anyone signed in, never on their own need. */
export function canOfferOn(
  viewer: ViewerLike,
  need: Pick<NeedRow, "participant_id">,
  event: Pick<EventRow, "summaries_started_at">,
): boolean {
  if (!viewer.participantId) return false;
  if (viewer.participantId === need.participant_id) return false;
  if (leadsLocked(event) && !viewer.isAdmin) return false;
  return true;
}

/** A giver can withdraw their own offer only until the owner rates it. */
export function canWithdrawOffer(
  viewer: ViewerLike,
  lead: Pick<LeadRow, "giver_participant_id" | "strength">,
  need: Pick<NeedRow, "participant_id">,
  event: Pick<EventRow, "summaries_started_at">,
): boolean {
  if (canManageLeadsOn(viewer, need, event)) return true;
  if (leadsLocked(event)) return false;
  return viewer.participantId === lead.giver_participant_id && lead.strength === null;
}

/** Needs are editable by their owner until the session is closed. */
export function canEditNeed(
  viewer: ViewerLike,
  need: Pick<NeedRow, "participant_id">,
  event: Pick<EventRow, "status">,
): boolean {
  if (viewer.isAdmin) return true;
  return viewer.participantId === need.participant_id && event.status !== "closed";
}

export function canRegister(event: Pick<EventRow, "status">): boolean {
  return event.status === "registration_open";
}

export function noteVisibleTo(note: Pick<NoteRow, "visibility" | "author_participant_id">, participantId: string | null): boolean {
  return note.visibility === "shared" || note.author_participant_id === participantId;
}

/** Only the owner of a need (or a facilitator) sees and edits the outreach drafts for its leads. */
export function canSeeDrafts(viewer: ViewerLike, need: Pick<NeedRow, "participant_id">): boolean {
  return viewer.isAdmin || viewer.participantId === need.participant_id;
}
