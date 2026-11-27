export type EventStatus = "registration_open" | "registration_locked" | "live" | "closed";
export type Category = "professional_services" | "fundraising" | "other";
export type Role = "participant" | "facilitator" | "guest";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "professional_services", label: "Professional Services" },
  { value: "fundraising", label: "Fundraising" },
  { value: "other", label: "Other" },
];

export function categoryLabel(c: Category): string {
  return CATEGORIES.find((x) => x.value === c)?.label ?? "Other";
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  location: string;
  starts_at: Date;
  ends_at: Date | null;
  timezone: string;
  status: EventStatus;
  current_presenter_id: string | null;
  send_delay_minutes: number;
  closed_at: Date | null;
  send_due_at: Date | null;
  summaries_started_at: Date | null;
  summaries_sent_at: Date | null;
  digest_json: unknown;
}

export interface ParticipantRow {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  chapter: string;
  role: Role;
  presentation_order: number;
  created_at: Date;
}

export interface NeedRow {
  id: string;
  participant_id: string;
  event_id: string;
  category: Category;
  title: string;
  description: string;
  updated_at: Date;
}

export interface LeadRow {
  id: string;
  need_id: string;
  giver_participant_id: string;
  strength: number | null;
  source: "owner" | "giver" | "facilitator";
  giver_note: string;
  outreach_subject: string | null;
  outreach_body: string | null;
  recorded_by: string | null;
  updated_at: Date;
}

export interface NoteRow {
  id: string;
  need_id: string;
  author_participant_id: string;
  body: string;
  visibility: "private" | "shared";
  updated_at: Date;
}

/** What the browser receives from GET /api/e/[slug]/state. */
export interface Snapshot {
  viewer: {
    participantId: string | null;
    name: string;
    email: string;
    isAdmin: boolean;
    isAdminEmail: boolean;
  };
  event: {
    id: string;
    slug: string;
    title: string;
    location: string;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    status: EventStatus;
    currentPresenterId: string | null;
    sendDelayMinutes: number;
    sendDueAt: string | null;
    summariesStartedAt: string | null;
    summariesSentAt: string | null;
    leadsLocked: boolean;
  };
  participants: {
    id: string;
    name: string;
    email: string | null;
    chapter: string;
    role: Role;
    presentationOrder: number;
  }[];
  needs: {
    id: string;
    participantId: string;
    category: Category;
    title: string;
    description: string;
    updatedAt: string;
  }[];
  leads: {
    id: string;
    needId: string;
    giverId: string;
    strength: number | null;
    source: "owner" | "giver" | "facilitator";
    giverNote: string;
    outreachSubject: string | null;
    outreachBody: string | null;
  }[];
  notes: {
    id: string;
    needId: string;
    authorId: string;
    authorName: string;
    body: string;
    visibility: "private" | "shared";
    updatedAt: string;
  }[];
}
