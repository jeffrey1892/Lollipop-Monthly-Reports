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
  try {
    await sql`
      update events set
        title = ${d.title},
        location = ${d.location},
        timezone = ${d.timezone},
        starts_at = (${d.date}::date + ${d.startTime}::time) at time zone ${d.timezone},
        ends_at = case when ${d.endTime} = '' then null else (${d.date}::date + nullif(${d.endTime}, '')::time) at time zone ${d.timezone} end,
        send_delay_minutes = ${d.sendDelayMinutes},
        send_due_at = case when status = 'closed' and summaries_started_at is null then closed_at + make_interval(mins => ${d.sendDelayMinutes}) else send_due_at end,
        updated_at = now()
      where id = ${viewer.event.id}`;
  } catch {
    throw new HttpError(400, "Check the date, times and time zone");
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
