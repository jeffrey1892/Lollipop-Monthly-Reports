import { NextResponse } from "next/server";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { sendTestSummary } from "@/lib/summaries";

type Ctx = { params: Promise<{ slug: string }> };

/** "Send test summary to me". */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  try {
    return NextResponse.json({ ok: true, message: await sendTestSummary(viewer.event, viewer.email) });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Test send failed");
  }
});
