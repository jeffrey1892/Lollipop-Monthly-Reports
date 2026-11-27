import { handle, requireAdmin } from "@/lib/auth";
import { buildDeck, deckFileName } from "@/lib/pptx";
import { loadEventData } from "@/lib/summaries";

type Ctx = { params: Promise<{ slug: string }> };
export const runtime = "nodejs";

/** Generate PowerPoint: one slide per participant, built from the data at the moment of the click. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const buf = await buildDeck(viewer.event, await loadEventData(viewer.event.id));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${deckFileName(viewer.event)}"`,
      "Cache-Control": "no-store",
    },
  });
});
