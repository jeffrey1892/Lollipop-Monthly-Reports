import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { eventUpdateSchema, firstError } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Event setup: title, location, date, times, time zone and the delay before summaries send. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = eventUpdateSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error));
  const d = parsed.data;
  const sendAt = d.sendDate ? `${d.sendDate} ${d.sendTime || "09:00"}` : "";
  try {
    await sql`
      update events set
        title = ${d.title},
        location = ${d.location},
        timezone = ${d.timezone},
        starts_at = (${d.date}::date + ${d.startTime}::time) at time zone ${d.timezone},
        ends_at = case when ${d.endTime} = '' then null else (${d.date}::date + nullif(${d.endTime}, '')::time) at time zone ${d.timezone} end,
        send_delay_minutes = ${d.sendDelayMinutes},
        sign_in_until = nullif(${d.signInUntil}, '')::date,
        summaries_send_at = case when ${sendAt} = '' then null else nullif(${sendAt}, '')::timestamp at time zone ${d.timezone} end,
        send_due_at = case when status = 'closed' and summaries_started_at is null
          then coalesce(case when ${sendAt} = '' then null else nullif(${sendAt}, '')::timestamp at time zone ${d.timezone} end,
                        closed_at + make_interval(mins => ${d.sendDelayMinutes}))
          else send_due_at end,
        updated_at = now()
      where id = ${viewer.event.id}`;
  } catch {
    throw new HttpError(400, "Check the date, times and time zone");
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
