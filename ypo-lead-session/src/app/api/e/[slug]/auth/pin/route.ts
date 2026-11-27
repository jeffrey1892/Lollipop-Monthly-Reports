import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handle, HttpError, requireViewer } from "@/lib/auth";
import { env } from "@/lib/env";
import { pinSchema } from "@/lib/schemas";
import { signInEndsAt } from "@/lib/repo";
import { sessionExpiry, writeSession } from "@/lib/session";

type Ctx = { params: Promise<{ slug: string }> };

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Facilitators enter the shared PIN once to turn on admin features. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  if (!viewer.isAdminEmail) throw new HttpError(403, "This email is not on the facilitator list");
  const parsed = pinSchema.safeParse(await req.json());
  if (!parsed.success || !env.adminPin || !same(parsed.data.pin, env.adminPin)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    throw new HttpError(401, "That PIN is not right");
  }
  await writeSession({ eid: viewer.event.id, pid: viewer.participantId, email: viewer.email, pin: true }, sessionExpiry(await signInEndsAt(viewer.event.id)));
  return NextResponse.json({ ok: true });
});
