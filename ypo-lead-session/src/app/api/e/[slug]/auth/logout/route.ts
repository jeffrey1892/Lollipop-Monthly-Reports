import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { clearSession } from "@/lib/session";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  await clearSession();
  return NextResponse.json({ ok: true, next: `/e/${slug}/login` });
});
