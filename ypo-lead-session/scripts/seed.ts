// Creates (or resets) a separate demo event at /e/demo for rehearsing. Never touches the real event.
import postgres from "postgres";

const PEOPLE: [string, string, string, string, string][] = [
  // name, chapter, category, title, description
  ["Alex Rivera", "Boston", "fundraising", "Intros to family offices for a $15M growth round", "Healthcare services roll-up, $40M revenue, profitable. Looking for 2–3 family offices that write $2–5M checks."],
  ["Priya Shah", "New York", "professional_services", "A great M&A lawyer for a carve-out", "Selling a division to a strategic buyer. Need deal counsel with carve-out experience by March."],
  ["Marcus Lee", "Chicago", "other", "Head of Sales who has scaled B2B SaaS from $10M to $50M", "Two failed hires. Want referrals to proven sales leaders, ideally Midwest-based."],
  ["Hannah Okafor", "Atlanta", "fundraising", "Lenders for a $20M asset-based facility", "Manufacturing business with strong receivables; current bank is pulling back."],
  ["Diego Alvarez", "Boston", "professional_services", "Fractional CFO with PE-exit experience", "Preparing for a sale in 18 months and need to professionalize finance."],
  ["Sofia Rossi", "New York", "other", "Introductions to hospital system procurement leaders", "We sell sterilization equipment and need warm intros at large health systems."],
  ["James Carter", "Chicago", "fundraising", "Board member with consumer brand experience", "Raising a Series B for a beverage brand; want an operator on the board."],
  ["Mei Chen", "Atlanta", "professional_services", "Executive search firm for a COO", "Founder-led company of 300 people needs its first COO."],
  ["Omar Haddad", "Boston", "other", "Advice on expanding into Mexico", "Logistics company considering a Monterrey facility; want to talk to people who have done it."],
  ["Laura Bennett", "New York", "fundraising", "Donors for a youth entrepreneurship nonprofit", "Raising $2M for a new program; looking for foundation and individual donor intros."],
  ["Tom Nguyen", "Chicago", "professional_services", "Cybersecurity firm for a SOC 2 audit", "Enterprise customers are asking for SOC 2 Type II within six months."],
  ["Rachel Green", "Atlanta", "other", "A peer CEO who has navigated a family succession", "Second-generation CEO planning transition with siblings involved."],
];

const LEADS: [number, number, number | null, string][] = [
  // need owner index, giver index, strength, giver note
  [0, 2, 5, "My cousin runs a family office in Wellesley"],
  [0, 4, 3, ""],
  [0, 9, null, "I know two healthcare-focused family offices"],
  [1, 6, 4, "Our counsel did our carve-out last year"],
  [1, 10, 2, ""],
  [2, 7, 5, "We placed a CRO who fits this exactly"],
  [3, 0, 4, "My bank's ABL group is very active"],
  [3, 5, null, ""],
  [5, 1, 5, "I sit on the board of a large hospital system"],
  [6, 11, 3, ""],
  [7, 3, 4, "Spencer Stuart partner I trust"],
  [8, 6, null, "We opened in Monterrey in 2022"],
  [9, 8, 2, ""],
  [10, 2, 4, "Used a great firm for our SOC 2"],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`delete from events where slug = 'demo'`;
      const [event] = await tx<{ id: string }[]>`
        insert into events (slug, title, location, starts_at, ends_at, timezone, status, send_delay_minutes)
        values ('demo', 'DEMO · HBS YPO · Lead Session rehearsal', 'Tara Hall',
          date_trunc('hour', now()) , null, 'America/New_York', 'live', 30)
        returning id`;
      const ids: string[] = [];
      for (const [i, [name, chapter, category, title, description]] of PEOPLE.entries()) {
        const email = `${name.split(" ")[0].toLowerCase()}@example.com`;
        const [p] = await tx<{ id: string }[]>`
          insert into participants (event_id, name, email, chapter, role, presentation_order)
          values (${event.id}, ${name}, ${email}, ${chapter}, 'participant', ${i + 1}) returning id`;
        ids.push(p.id);
        await tx`insert into needs (participant_id, event_id, category, title, description) values (${p.id}, ${event.id}, ${category}, ${title}, ${description})`;
      }
      const needIds = await tx<{ id: string; participant_id: string }[]>`select id, participant_id from needs where event_id = ${event.id}`;
      const needOf = new Map(needIds.map((n) => [n.participant_id, n.id]));
      for (const [owner, giver, strength, note] of LEADS) {
        await tx`
          insert into leads (need_id, giver_participant_id, strength, source, giver_note, recorded_by)
          values (${needOf.get(ids[owner])!}, ${ids[giver]}, ${strength}, ${note ? "giver" : "owner"}, ${note}, ${ids[owner]})`;
      }
      await tx`insert into notes (need_id, author_participant_id, body, visibility) values
        (${needOf.get(ids[0])!}, ${ids[1]}, 'Ask about their Florida expansion too.', 'shared'),
        (${needOf.get(ids[0])!}, ${ids[3]}, 'Possible co-investor angle for us.', 'private'),
        (${needOf.get(ids[2])!}, ${ids[0]}, 'Check LinkedIn for ex-Salesforce leaders in Chicago.', 'shared')`;
      await tx`update events set current_presenter_id = ${ids[0]} where id = ${event.id}`;
    });
    console.log("Demo event ready: /e/demo (sign in as alex@example.com, or any of the 12 first names @example.com)");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
