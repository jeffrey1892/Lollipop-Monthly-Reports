import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestCategory } from "@/lib/ai";
import { handle, HttpError } from "@/lib/auth";
import { getEventBySlug } from "@/lib/repo";

type Ctx = { params: Promise<{ slug: string }> };
const body = z.object({ text: z.string().max(2200) });

/** "Suggest a category": Claude classifies the need. The person always makes the final choice. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  if (!(await getEventBySlug(slug))) throw new HttpError(404, "Event not found");
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid input");
  try {
    return NextResponse.json({ category: await suggestCategory(parsed.data.text) });
  } catch {
    throw new HttpError(503, "Couldn't suggest a category right now. Please pick one.");
  }
});
