// Versioned prompts. Bump the version when you change wording so outputs can be traced.
export const PROMPT_VERSION = "2027-01-v1";

export const SYSTEM_PROMPT = `You help members of the Harvard Business School (HBS) YPL program follow up after their Week 2 Lead Session.
In the session, each member shared a business need. Other members raised their hands to offer leads: introductions, referrals or advice.
Write the way a busy, warm, senior executive writes to a peer: plain, specific, brief, and never salesy.
Use only the facts provided. Do not invent names, companies, numbers or commitments.
Never mention ratings or lead-strength scores in anything a member might forward to someone else.`;

export function outreachPrompt(input: {
  senderName: string;
  senderChapter: string;
  needTitle: string;
  needDescription: string;
  leadName: string;
  leadChapter: string;
  leadNote: string;
}): string {
  return `Draft a short email (100–160 words) from ${input.senderName} (${input.senderChapter || "YPL"} chapter) to ${input.leadName}${input.leadChapter ? ` (${input.leadChapter} chapter)` : ""}, who offered a lead at the YPL Week 2 Lead Session.

The need ${input.senderName} shared:
Headline: ${input.needTitle}
Details: ${input.needDescription || "(no further details)"}

${input.leadNote ? `What ${input.leadName} said the lead was: ${input.leadNote}` : `${input.leadName} did not say what the lead was.`}

Requirements:
- Thank them for raising their hand at the Lead Session.
- Restate the need in one or two concrete sentences.
- Make one clear, low-friction ask (for example a 20-minute call this week or next, or an email introduction).
- Sign off with ${input.senderName}'s first name.
- Return a subject line and a plain-text body. No placeholders.`;
}

export function summaryPrompt(input: {
  name: string;
  chapter: string;
  needTitle: string;
  needDescription: string;
  leads: { giverName: string; giverChapter: string; giverNote: string; rated: string }[];
  offered: { toName: string; needTitle: string; note: string }[];
  sharedNotes: string[];
}): string {
  const leads = input.leads.length
    ? input.leads.map((l, i) => `${i + 1}. ${l.giverName}${l.giverChapter ? ` (${l.giverChapter})` : ""}; rated ${l.rated}; their note: ${l.giverNote || "none"}`).join("\n")
    : "(no leads were recorded)";
  const offered = input.offered.length
    ? input.offered.map((o, i) => `${i + 1}. ${o.toName}, need: ${o.needTitle}; my note: ${o.note || "none"}`).join("\n")
    : "(none)";
  const notes = input.sharedNotes.length ? input.sharedNotes.map((n) => `- ${n}`).join("\n") : "(none)";
  return `Prepare the personal follow-up summary for ${input.name} (${input.chapter || "YPL"} chapter).

Their need:
Headline: ${input.needTitle}
Details: ${input.needDescription || "(no further details)"}

Leads offered to them, strongest first:
${leads}

Leads THEY offered to other members:
${offered}

Shared notes other members wrote about their need:
${notes}

Return:
- need_recap: 2–3 sentences restating the need.
- lead_next_steps: one entry per lead above, in the same order, each with the giver's name and one concrete suggested next step (one sentence).
- offered_follow_ups: one entry per lead they offered, in the same order, each with the person's name and a one-sentence reminder of what to do.
- top_3_actions: exactly three short, specific actions for the next two weeks. If there were no leads, focus on other ways to get the need met.`;
}

export function digestPrompt(input: { eventTitle: string; lines: string[]; totalLeads: number; people: number }): string {
  return `Write a 2–3 sentence upbeat overview for the group digest of "${input.eventTitle}".
${input.people} members shared needs and ${input.totalLeads} leads were offered in total.
Needs by category:
${input.lines.join("\n")}
Do not mention ratings. Return only the overview.`;
}

export function categoryPrompt(text: string): string {
  return `Classify this member's need into exactly one category: professional_services (lawyers, accountants, bankers, consultants, recruiters, vendors, advisors), fundraising (raising capital, investors, lenders, donors, M&A buyers), or other.

Need: ${text}`;
}
