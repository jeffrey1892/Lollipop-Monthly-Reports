import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { buildCsv, type CsvType } from "@/lib/csv";
import { loadEventData } from "@/lib/summaries";

type Ctx = { params: Promise<{ slug: string }> };
const TYPES: CsvType[] = ["participants", "needs", "leads", "notes"];

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const viewer = await requireAdmin(slug);
  const type = new URL(req.url).searchParams.get("type") as CsvType;
  if (!TYPES.includes(type)) throw new HttpError(400, "Unknown export");
  const csv = buildCsv(type, await loadEventData(viewer.event.id));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ypl-${slug}-${type}.csv"`,
    },
  });
});
