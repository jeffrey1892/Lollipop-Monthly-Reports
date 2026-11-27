// Email bodies (HTML + plain text). Kept as plain template functions so they render anywhere.
import { categoryLabel, CATEGORIES, type Category } from "../types";
import { escapeHtml, eventWhenWhere, stars } from "../format";

export interface EventInfo {
  title: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  timezone: string;
  location: string;
  appUrl: string;
}

export interface PersonalSummaryContent {
  name: string;
  chapter: string;
  needTitle: string;
  needDescription: string;
  needRecap: string;
  leads: {
    giverName: string;
    giverEmail: string | null;
    chapter: string;
    strength: number | null;
    giverNote: string;
    suggestedNextStep: string;
    outreachSubject: string;
    outreachBody: string;
  }[];
  leadsOffered: { name: string; needTitle: string; note: string; reminder: string }[];
  notesAboutMyNeed: { author: string; body: string }[];
  myNotes: { onWhoseNeed: string; body: string; visibility: "private" | "shared" }[];
  top3Actions: string[];
}

export interface DigestContent {
  overview: string;
  totalLeads: number;
  people: {
    name: string;
    chapter: string;
    category: Category;
    needTitle: string;
    needDescription: string;
    leadCount: number;
    leadGivers: string[];
  }[];
}

const CRIMSON = "#A51C30";

function shell(info: EventInfo, inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:640px;margin:0 auto;background:#ffffff">
<div style="background:${CRIMSON};color:#fff;padding:20px 24px">
<div style="font-size:20px;font-weight:700">${escapeHtml(info.title)}</div>
<div style="font-size:13px;opacity:.9;margin-top:4px">${escapeHtml(eventWhenWhere(info))}</div>
</div>
<div style="padding:24px">${inner}
<p style="margin-top:32px;font-size:13px;color:#6b7280">Open the app: <a href="${escapeHtml(info.appUrl)}" style="color:${CRIMSON}">${escapeHtml(info.appUrl)}</a></p>
</div></div></body></html>`;
}

const h2 = (t: string) => `<h2 style="font-size:16px;color:${CRIMSON};margin:28px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">${escapeHtml(t)}</h2>`;
const p = (t: string) => `<p style="margin:6px 0;line-height:1.5">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;

function mailto(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function personalSubject(c: PersonalSummaryContent): string {
  const n = c.leads.length;
  return `Your YPO Week 2 Lead Session summary: ${n} lead${n === 1 ? "" : "s"}`;
}

export function renderPersonalEmail(info: EventInfo, c: PersonalSummaryContent): { subject: string; html: string; text: string } {
  const subject = personalSubject(c);
  let html = `<p style="margin:0 0 8px">Hi ${escapeHtml(c.name.split(" ")[0])},</p>`;
  html += h2("Your need") + `<p style="margin:6px 0;font-weight:600">${escapeHtml(c.needTitle)}</p>` + p(c.needRecap);

  html += h2(`Your leads (${c.leads.length})`);
  if (!c.leads.length) html += p("No leads were recorded for your need this time. See the actions below for other ways to get it met.");
  for (const l of c.leads) {
    const contact = l.giverEmail
      ? `<a href="${escapeHtml(mailto(l.giverEmail, l.outreachSubject, l.outreachBody))}" style="color:${CRIMSON}">${escapeHtml(l.giverEmail)}</a>`
      : "no email on file";
    html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin:10px 0">
<div style="font-weight:700">${escapeHtml(l.giverName)} <span style="color:#b45309;font-weight:400">${stars(l.strength)}</span></div>
<div style="font-size:13px;color:#4b5563">${escapeHtml(l.chapter || "")}${l.chapter ? " · " : ""}${contact}</div>
${l.giverNote ? `<div style="font-size:14px;margin-top:6px"><em>Their note:</em> ${escapeHtml(l.giverNote)}</div>` : ""}
<div style="font-size:14px;margin-top:6px"><strong>Next step:</strong> ${escapeHtml(l.suggestedNextStep)}</div>
<div style="font-size:13px;margin-top:10px;color:#6b7280">Outreach draft to copy and paste:</div>
<pre style="white-space:pre-wrap;font-family:inherit;background:#f9fafb;border:1px dashed #d1d5db;border-radius:6px;padding:10px;margin:4px 0;font-size:14px">Subject: ${escapeHtml(l.outreachSubject)}

${escapeHtml(l.outreachBody)}</pre>
</div>`;
  }

  html += h2("Leads you offered");
  if (!c.leadsOffered.length) html += p("You didn't check \"I have a lead for you\" for anyone.");
  for (const o of c.leadsOffered) {
    html += `<div style="margin:8px 0"><strong>${escapeHtml(o.name)}</strong>: ${escapeHtml(o.needTitle)}${o.note ? `<br><span style="font-size:14px;color:#4b5563">Your note: ${escapeHtml(o.note)}</span>` : ""}<br><span style="font-size:14px">${escapeHtml(o.reminder)}</span></div>`;
  }

  html += h2("Notes on your need");
  html += c.notesAboutMyNeed.length
    ? c.notesAboutMyNeed.map((n) => `<div style="margin:8px 0"><strong>${escapeHtml(n.author)}:</strong> ${escapeHtml(n.body)}</div>`).join("")
    : p("No one shared notes on your need.");

  html += h2("Your notes");
  html += c.myNotes.length
    ? c.myNotes
        .map((n) => `<div style="margin:8px 0"><strong>On ${escapeHtml(n.onWhoseNeed)}'s need</strong>${n.visibility === "private" ? " 🔒" : ""}<br>${escapeHtml(n.body).replace(/\n/g, "<br>")}</div>`)
        .join("") + `<p style="font-size:12px;color:#6b7280">🔒 Private notes are only ever sent to you.</p>`
    : p("You didn't take any notes.");

  html += h2("Top 3 actions") + `<ol style="padding-left:20px;margin:6px 0">${c.top3Actions.map((a) => `<li style="margin:4px 0">${escapeHtml(a)}</li>`).join("")}</ol>`;

  const lines: string[] = [];
  lines.push(`${info.title}`, eventWhenWhere(info), "", `Hi ${c.name.split(" ")[0]},`, "", "YOUR NEED", c.needTitle, c.needRecap, "", `YOUR LEADS (${c.leads.length})`);
  if (!c.leads.length) lines.push("No leads were recorded for your need this time.");
  for (const l of c.leads) {
    lines.push("", `${l.giverName} (${stars(l.strength)})${l.chapter ? `, ${l.chapter}` : ""}${l.giverEmail ? `, ${l.giverEmail}` : ""}`);
    if (l.giverNote) lines.push(`Their note: ${l.giverNote}`);
    lines.push(`Next step: ${l.suggestedNextStep}`, "Outreach draft:", `Subject: ${l.outreachSubject}`, "", l.outreachBody, "---");
  }
  lines.push("", "LEADS YOU OFFERED");
  if (!c.leadsOffered.length) lines.push("None.");
  for (const o of c.leadsOffered) lines.push(`- ${o.name}: ${o.needTitle}${o.note ? ` (your note: ${o.note})` : ""}. ${o.reminder}`);
  lines.push("", "NOTES ON YOUR NEED");
  if (!c.notesAboutMyNeed.length) lines.push("None.");
  for (const n of c.notesAboutMyNeed) lines.push(`- ${n.author}: ${n.body}`);
  lines.push("", "YOUR NOTES");
  if (!c.myNotes.length) lines.push("None.");
  for (const n of c.myNotes) lines.push(`- On ${n.onWhoseNeed}'s need${n.visibility === "private" ? " (private)" : ""}: ${n.body}`);
  lines.push("", "TOP 3 ACTIONS", ...c.top3Actions.map((a, i) => `${i + 1}. ${a}`), "", `Open the app: ${info.appUrl}`);

  return { subject, html: shell(info, html), text: lines.join("\n") };
}

export function renderDigestEmail(info: EventInfo, d: DigestContent): { subject: string; html: string; text: string } {
  const subject = `YPO Week 2 Lead Session: everyone's needs and leads`;
  let html = p(d.overview);
  const text: string[] = [info.title, eventWhenWhere(info), "", d.overview];
  for (const cat of CATEGORIES) {
    const people = d.people.filter((x) => x.category === cat.value);
    if (!people.length) continue;
    html += h2(`${cat.label} (${people.length})`);
    text.push("", cat.label.toUpperCase());
    for (const x of people) {
      const givers = x.leadGivers.length ? `Leads from: ${x.leadGivers.join(", ")}` : "No leads yet";
      html += `<div style="margin:10px 0"><strong>${escapeHtml(x.name)}</strong>${x.chapter ? ` <span style="color:#6b7280">· ${escapeHtml(x.chapter)}</span>` : ""}<br>
<span>${escapeHtml(x.needTitle)}</span>${x.needDescription ? `<br><span style="font-size:14px;color:#4b5563">${escapeHtml(x.needDescription)}</span>` : ""}<br>
<span style="font-size:13px;color:#374151">${x.leadCount} lead${x.leadCount === 1 ? "" : "s"} · ${escapeHtml(givers)}</span></div>`;
      text.push(`- ${x.name}${x.chapter ? ` (${x.chapter})` : ""}: ${x.needTitle}. ${x.leadCount} lead(s). ${givers}`);
    }
  }
  text.push("", `Open the app: ${info.appUrl}`);
  return { subject, html: shell(info, html), text: text.join("\n") };
}

export { categoryLabel };
