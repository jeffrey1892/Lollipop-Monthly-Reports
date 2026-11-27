import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime";
import { orderSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ slug: string }> };

/** Save the speaking order (ids in the new order). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const parsed = orderSchema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid order");
  await sql.begin(async (tx) => {
    for (const [i, id] of parsed.data.ids.entries()) {
      await tx`update participants set presentation_order = ${i + 1} where id = ${id} and event_id = ${viewer.event.id}`;
    }
  });
  await broadcastChange(slug);
  return NextResponse.json({ ok: true });
});
