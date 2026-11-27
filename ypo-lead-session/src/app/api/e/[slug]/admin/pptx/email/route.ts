import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { emailDeck } from "@/lib/deckEmail";

type Ctx = { params: Promise<{ slug: string }> };
export const runtime = "nodejs";

/** "Email it to me now": build the PowerPoint from current data and email it to the signed-in facilitator. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  try {
    await emailDeck(viewer.event, [viewer.email]);
  } catch (err) {
    console.error(err);
    throw new HttpError(502, "Couldn't email the PowerPoint. Check the email settings and try again.");
  }
  return NextResponse.json({ ok: true, message: `PowerPoint emailed to ${viewer.email}.` });
});
