import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/repo";
import { eventCreateSchema, firstError } from "@/lib/schemas";
import { z } from "zod";

/** Create a new event (for later weeks). The caller must be a facilitator on an existing event. */
export const POST = handle(async (req: Request) => {
  const body = await req.json();
  const from = z.object({ fromSlug: z.string() }).safeParse(body);
  if (!from.success) throw new HttpError(400, "Missing fromSlug");
  await requireAdmin(from.data.fromSlug);
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;
  const sendAt = d.sendDate ? `${d.sendDate} ${d.sendTime || "09:00"}` : "";
  if (d.slug === "demo" || (await getEventBySlug(d.slug))) throw new HttpError(409, "That link name is already taken");
  try {
    await sql`
      insert into events (slug, title, location, timezone, starts_at, ends_at, send_delay_minutes, sign_in_until, summaries_send_at)
      values (${d.slug}, ${d.title}, ${d.location}, ${d.timezone},
        (${d.date}::date + ${d.startTime}::time) at time zone ${d.timezone},
        case when ${d.endTime} = '' then null else (${d.date}::date + nullif(${d.endTime}, '')::time) at time zone ${d.timezone} end,
        ${d.sendDelayMinutes}, nullif(${d.signInUntil}, '')::date,
        case when ${sendAt} = '' then null else nullif(${sendAt}, '')::timestamp at time zone ${d.timezone} end)`;
  } catch {
    throw new HttpError(400, "Check the date, times and time zone");
  }
  return NextResponse.json({ ok: true, next: `/e/${d.slug}/login` });
});
