import { after, NextResponse } from "next/server";
import { handle, requireViewer, viewerSummary } from "@/lib/auth";
import { buildSnapshot } from "@/lib/repo";
import { maybeRunScheduler } from "@/lib/summaries";

type Ctx = { params: Promise<{ slug: string }> };

/** Everything the signed-in viewer is allowed to see for this event. Polled by every screen. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireViewer(slug);
  after(maybeRunScheduler); // keeps auto-send working even if cron isn't configured
  const snapshot = await buildSnapshot(viewer.event, viewerSummary(viewer));
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
});
