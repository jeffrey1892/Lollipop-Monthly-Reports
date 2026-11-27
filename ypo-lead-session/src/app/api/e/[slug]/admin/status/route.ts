import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { statusActionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Open registration → lock registration → go live → close. Closing starts the countdown to the automatic send. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = statusActionSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid action");
  const e = viewer.event;

  if (parsed.data.action === "close") {
    if (e.status !== "closed") {
      await sql`
        update events set status = 'closed', closed_at = now(),
          send_due_at = coalesce(summaries_send_at, now() + make_interval(mins => send_delay_minutes)), updated_at = now()
        where id = ${e.id}`;
    }
  } else {
    if (e.summaries_started_at) throw new HttpError(409, "Summaries have already gone out, so the session can't be reopened.");
    const status = { open_registration: "registration_open", lock_registration: "registration_locked", go_live: "live" }[parsed.data.action];
    await sql`
      update events set status = ${status}, closed_at = null, send_due_at = null, updated_at = now(),
        current_presenter_id = coalesce(current_presenter_id, (
          select p.id from participants p join needs n on n.participant_id = p.id
          where p.event_id = ${e.id} and p.role <> 'guest' and ${status} = 'live'
          order by p.presentation_order, p.created_at limit 1))
      where id = ${e.id}`;
  }
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
