import { describe, expect, it } from "vitest";
import { renderDigestEmail, renderPersonalEmail } from "@/lib/email/templates";
import { assemblePersonalContent, collectDigestFacts, type EventData } from "@/lib/summaries";
import { slideData } from "@/lib/pptx";
import type { LeadRow, NeedRow, NoteRow, ParticipantRow } from "@/lib/types";

const t = new Date("2027-01-20T17:30:00Z");
const P = (id: string, name: string, order: number, role: ParticipantRow["role"] = "participant"): ParticipantRow => ({
  id, event_id: "e", name, email: `${id}@x.com`, chapter: "Boston", role, presentation_order: order, created_at: t, walkthrough_seen_at: null,
});
const N = (id: string, owner: string, title: string): NeedRow => ({ id, participant_id: owner, event_id: "e", category: "fundraising", title, description: "", updated_at: t });
const L = (id: string, need: string, giver: string, strength: number | null, extra: Partial<LeadRow> = {}): LeadRow => ({
  id, need_id: need, giver_participant_id: giver, strength, source: "owner", giver_note: "", outreach_subject: null, outreach_body: null, recorded_by: null, updated_at: t, ...extra,
});
const NT = (id: string, need: string, author: string, body: string, visibility: NoteRow["visibility"]): NoteRow => ({ id, need_id: need, author_participant_id: author, body, visibility, updated_at: t });

const data: EventData = {
  participants: [P("a", "Ann Able", 1), P("b", "Bob Baker", 2), P("c", "Cy Cole", 3), P("g", "Gus Guest", 0, "guest")],
  needs: [N("na", "a", "Find investors"), N("nb", "b", "Hire a CFO")],
  leads: [
    L("l1", "na", "b", 2),
    L("l2", "na", "c", 5, { outreach_subject: "Saved subject", outreach_body: "Saved body" }),
    L("l3", "na", "g", null, { source: "giver", giver_note: "my uncle" }),
    L("l4", "nb", "a", 4, { giver_note: "Great CFO I know" }),
  ],
  notes: [
    NT("n1", "na", "b", "Shared idea for Ann", "shared"),
    NT("n2", "na", "c", "Cy's private thought about Ann", "private"),
    NT("n3", "nb", "a", "Ann's private note on Bob", "private"),
  ],
};

const ai = {
  need_recap: "Ann needs investors.",
  lead_next_steps: [
    { giver_name: "Cy Cole", suggested_next_step: "Call Cy." },
    { giver_name: "Bob Baker", suggested_next_step: "Call Bob." },
    { giver_name: "Gus Guest", suggested_next_step: "Call Gus." },
  ],
  offered_follow_ups: [{ name: "Bob Baker", reminder: "Send Bob the CFO intro." }],
  top_3_actions: ["One", "Two", "Three", "Four"],
};

describe("personal summary", () => {
  const drafts = new Map([["l1", { subject: "New subject", body: "New body" }]]);
  const c = assemblePersonalContent(data.participants[0], data, ai, drafts);

  it("sorts leads strongest first with unrated last, and takes facts from the database", () => {
    expect(c.leads.map((l) => l.giverName)).toEqual(["Cy Cole", "Bob Baker", "Gus Guest"]);
    expect(c.leads[0].strength).toBe(5);
    expect(c.leads[0].giverEmail).toBe("c@x.com");
    expect(c.leads[2].giverNote).toBe("my uncle");
  });
  it("reuses saved drafts and uses fresh ones where there were none", () => {
    expect(c.leads[0].outreachSubject).toBe("Saved subject");
    expect(c.leads[1].outreachSubject).toBe("New subject");
  });
  it("includes leads they offered", () => {
    expect(c.leadsOffered).toEqual([{ name: "Bob Baker", needTitle: "Hire a CFO", note: "Great CFO I know", reminder: "Send Bob the CFO intro." }]);
  });
  it("never includes other people's private notes, but includes all of their own", () => {
    expect(c.notesAboutMyNeed.map((n) => n.body)).toEqual(["Shared idea for Ann"]);
    expect(c.myNotes.map((n) => n.body)).toEqual(["Ann's private note on Bob"]);
    const email = renderPersonalEmail({ title: "T", startsAt: t, endsAt: null, timezone: "America/New_York", location: "Tata 100 (downstairs)", appUrl: "http://x" }, c);
    expect(email.html).not.toContain("Cy's private thought");
    expect(email.text).toContain("Ann's private note on Bob");
  });
  it("caps actions at three and counts leads in the subject", () => {
    expect(c.top3Actions).toHaveLength(3);
    const email = renderPersonalEmail({ title: "T", startsAt: t, endsAt: null, timezone: "America/New_York", location: "", appUrl: "http://x" }, c);
    expect(email.subject).toBe("Your YPO Week 2 Lead Session summary: 3 leads");
    expect(email.text).toContain("Subject: Saved subject");
  });
});

describe("group digest", () => {
  it("lists needs and lead givers but no ratings or notes", () => {
    const facts = collectDigestFacts(data);
    expect(facts.people.map((p) => p.name)).toEqual(["Ann Able", "Bob Baker"]);
    expect(facts.people[0].leadGivers).toEqual(["Bob Baker", "Cy Cole", "Gus Guest"]);
    const email = renderDigestEmail(
      { title: "T", startsAt: t, endsAt: null, timezone: "America/New_York", location: "", appUrl: "http://x" },
      { overview: "Overview", totalLeads: facts.totalLeads, people: facts.people },
    );
    expect(email.html).not.toMatch(/★|\/5|Shared idea|private/);
    expect(email.text).toContain("3 lead(s)");
  });
});

describe("PowerPoint data", () => {
  it("one slide per participant with a need, in speaking order, leads strongest first", () => {
    const slides = slideData(data);
    expect(slides.map((s) => s.name)).toEqual(["Ann Able", "Bob Baker"]);
    expect(slides[0].leads).toEqual([
      { name: "Cy Cole", strength: 5 },
      { name: "Bob Baker", strength: 2 },
      { name: "Gus Guest", strength: null },
    ]);
  });
});
