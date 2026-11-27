// The "How it works" walkthrough: one page per feature, short enough to read at a glance.
export const TITLE_MAX = 24; // characters
export const BODY_MAX = 120; // characters

export interface WalkthroughStep {
  icon: string;
  title: string;
  body: string;
}

function untilLabel(date: string | null): string {
  if (!date) return "for 30 days";
  const d = new Date(`${date}T12:00:00Z`);
  return `through ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

export function walkthroughSteps(opts: { sendDelayMinutes: number; signInUntil: string | null }): WalkthroughStep[] {
  return [
    {
      icon: "✍️",
      title: "Share your need",
      body: "Tell the group what would help you most. Edit it any time on My Need until the session closes.",
    },
    {
      icon: "🎤",
      title: "Check your leads",
      body: "When you present, tick each person who raises a hand and rate their lead from 5 (strong) to 1 (weak).",
    },
    {
      icon: "🙋",
      title: "Offer a lead",
      body: "Can you help someone? Tick “I have a lead for…” on their card and add a quick note.",
    },
    {
      icon: "📇",
      title: "Browse the Index",
      body: "The Index tab lists every need by category. Search by name, chapter or keyword.",
    },
    {
      icon: "📝",
      title: "Take notes",
      body: "Jot notes on any need. They stay private unless you switch them to Shared.",
    },
    {
      icon: "✉️",
      title: "Draft follow-ups",
      body: "On My Need, tap Draft email next to each lead, then copy it into your own email.",
    },
    {
      icon: "📬",
      title: "Get your summary",
      body: `${opts.sendDelayMinutes} minutes after the session closes, we email your leads and drafts. You stay signed in ${untilLabel(opts.signInUntil)}.`,
    },
  ];
}
