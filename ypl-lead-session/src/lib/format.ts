export function formatEventDate(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz }).format(new Date(d));
}

export function formatTime(d: Date | string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(d));
}

export function tzAbbrev(d: Date | string, tz: string): string {
  if (tz === "America/New_York") return "ET";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(d))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}

/** "Wednesday, January 20, 2027 · 12:30 PM – 1:30 PM ET · Tara Hall" */
export function eventWhenWhere(e: { startsAt: string | Date; endsAt: string | Date | null; timezone: string; location: string }): string {
  const date = formatEventDate(e.startsAt, e.timezone);
  const start = formatTime(e.startsAt, e.timezone);
  const end = e.endsAt ? ` – ${formatTime(e.endsAt, e.timezone)}` : "";
  const parts = [date, `${start}${end} ${tzAbbrev(e.startsAt, e.timezone)}`];
  if (e.location) parts.push(e.location);
  return parts.join(" · ");
}

/** YYYY-MM-DD and HH:MM in the event's time zone, for admin form inputs. */
export function localParts(d: Date | string, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function stars(n: number | null): string {
  if (n === null) return "not rated";
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function strengthLabel(n: number | null): string {
  if (n === null) return "not rated";
  if (n === 5) return "5 · Strong";
  if (n === 1) return "1 · Weak";
  return String(n);
}
