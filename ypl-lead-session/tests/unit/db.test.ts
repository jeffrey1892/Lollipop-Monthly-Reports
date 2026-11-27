// Database-backed tests (local Postgres test database): lead merging and the automatic send.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { offerLead, rateLead, setLeadByOwner, withdrawOffer } from "@/lib/leads";
import { runScheduler } from "@/lib/summaries";

let eventId: string;
let ann: string, bob: string, cy: string, needAnn: string;

async function makeEvent(opts: { endsAt: string | null; delay?: number }) {
  await sql`delete from events`;
  await sql`delete from email_log`;
  const [e] = await sql<{ id: string }[]>`
    insert into events (slug, title, location, starts_at, ends_at, timezone, status, send_delay_minutes)
    values ('test-event', 'Test', 'Tara Hall', '2027-01-20 17:30:00+00', ${opts.endsAt}, 'America/New_York', 'live', ${opts.delay ?? 30})
    returning id`;
  eventId = e.id;
  const mk = async (name: string, email: string, order: number) =>
    (await sql<{ id: string }[]>`insert into participants (event_id, name, email, chapter, presentation_order) values (${eventId}, ${name}, ${email}, 'Boston', ${order}) returning id`)[0].id;
  ann = await mk("Ann Able", "ann@example.com", 1);
  bob = await mk("Bob Baker", "bob@example.com", 2);
  cy = await mk("Cy Cole", "cy@example.com", 3);
  needAnn = (await sql<{ id: string }[]>`insert into needs (participant_id, event_id, category, title) values (${ann}, ${eventId}, 'fundraising', 'Find investors') returning id`)[0].id;
  await sql`insert into needs (participant_id, event_id, category, title) values (${bob}, ${eventId}, 'other', 'Hire a CFO')`;
}

beforeAll(async () => {
  await sql`select 1`;
});
afterAll(async () => {
  await sql`delete from events`;
  await sql.end();
});

describe("lead merging", () => {
  beforeEach(() => makeEvent({ endsAt: "2027-01-20 18:30:00+00" }));

  it("a giver offer and an owner check end up as one row", async () => {
    await offerLead(needAnn, bob, "my old boss");
    await setLeadByOwner(needAnn, bob, null, ann, "owner");
    await rateLead(needAnn, bob, 4, ann);
    const rows = await sql`select * from leads where need_id = ${needAnn}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].strength).toBe(4);
    expect(rows[0].giver_note).toBe("my old boss");
    expect(rows[0].source).toBe("giver");
  });

  it("a giver can withdraw an unrated offer but not a rated one", async () => {
    await offerLead(needAnn, bob, "");
    expect(await withdrawOffer(needAnn, bob)).toBe(true);
    await offerLead(needAnn, cy, "");
    await rateLead(needAnn, cy, 5, ann);
    expect(await withdrawOffer(needAnn, cy)).toBe(false);
    expect((await sql`select count(*)::int as n from leads where need_id = ${needAnn}`)[0].n).toBe(1);
  });

  it("re-offering keeps the note unless a new one is given", async () => {
    await offerLead(needAnn, bob, "first note");
    await offerLead(needAnn, bob, undefined);
    expect((await sql`select giver_note from leads where need_id = ${needAnn}`)[0].giver_note).toBe("first note");
  });

  it("records every change in lead history", async () => {
    await offerLead(needAnn, bob, "");
    await rateLead(needAnn, bob, 3, ann);
    const h = await sql`select action from lead_history where need_id = ${needAnn} order by id`;
    expect(h.map((r) => r.action)).toEqual(["offered", "rated"]);
  });
});

describe("automatic send", () => {
  it("closes itself at the end time, sends after the delay, and never emails anyone twice", async () => {
    await makeEvent({ endsAt: "2027-01-20 18:30:00+00", delay: 30 }); // 1:30 PM ET
    await offerLead(needAnn, bob, "my old boss");
    await rateLead(needAnn, bob, 5, ann);

    await runScheduler(new Date("2027-01-20T18:29:00Z"));
    expect((await sql`select status from events where id = ${eventId}`)[0].status).toBe("live");

    await runScheduler(new Date("2027-01-20T18:31:00Z")); // closed, waiting for the delay
    const e1 = (await sql`select status, send_due_at from events where id = ${eventId}`)[0];
    expect(e1.status).toBe("closed");
    expect(new Date(e1.send_due_at).toISOString()).toBe("2027-01-20T19:00:00.000Z"); // 2:00 PM ET
    expect((await sql`select count(*)::int as n from email_log`)[0].n).toBe(0);

    await runScheduler(new Date("2027-01-20T19:01:00Z"));
    await runScheduler(new Date("2027-01-20T19:06:00Z")); // second run must not resend
    const log = await sql<{ kind: string; to_email: string }[]>`select kind, to_email from email_log where event_id = ${eventId} order by kind, to_email`;
    // personal summaries go to the two people with needs; the digest goes to all three registrants
    expect(log.map((r) => `${r.kind}:${r.to_email}`)).toEqual([
      "digest:ann@example.com",
      "digest:bob@example.com",
      "digest:cy@example.com",
      "personal:ann@example.com",
      "personal:bob@example.com",
    ]);
    const e2 = (await sql`select summaries_sent_at from events where id = ${eventId}`)[0];
    expect(e2.summaries_sent_at).not.toBeNull();

    // Ann's summary has the lead, its outreach draft and no ratings in the digest
    const annMail = (await sql`select text_body from email_log where kind = 'personal' and to_email = 'ann@example.com'`)[0].text_body as string;
    expect(annMail).toContain("Bob Baker");
    expect(annMail).toContain("Outreach draft");
    const digest = (await sql`select html from email_log where kind = 'digest' limit 1`)[0].html as string;
    expect(digest).not.toContain("★");
  });

  it("without an end time, the backstop is 6:00 PM Eastern on the event day", async () => {
    await makeEvent({ endsAt: null, delay: 30 });
    await runScheduler(new Date("2027-01-20T22:59:00Z")); // 5:59 PM ET
    expect((await sql`select status from events where id = ${eventId}`)[0].status).toBe("live");
    await runScheduler(new Date("2027-01-20T23:00:00Z")); // 6:00 PM ET
    const e = (await sql`select status, send_due_at from events where id = ${eventId}`)[0];
    expect(e.status).toBe("closed");
    expect(new Date(e.send_due_at).toISOString()).toBe("2027-01-20T23:30:00.000Z");
  });

  it("freezes leads once sending starts", async () => {
    await makeEvent({ endsAt: "2027-01-20 18:30:00+00", delay: 0 });
    await runScheduler(new Date("2027-01-20T18:31:00Z"));
    const e = (await sql`select summaries_started_at from events where id = ${eventId}`)[0];
    expect(e.summaries_started_at).not.toBeNull();
  });
});
