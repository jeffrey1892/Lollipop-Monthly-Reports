import QRCode from "qrcode";
import { handle, HttpError } from "@/lib/auth";
import { env } from "@/lib/env";
import { getEventBySlug } from "@/lib/repo";

type Ctx = { params: Promise<{ slug: string }> };

/** QR code for the registration link, as PNG (2048 px) or SVG. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) throw new HttpError(404, "Event not found");
  const url = `${env.appBaseUrl}/e/${slug}/register`;
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = `ypl-lead-session-qr.${format}`;
  const disposition = download ? { "Content-Disposition": `attachment; filename="${filename}"` } : undefined;
  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", ...disposition } });
  }
  const png = await QRCode.toBuffer(url, { type: "png", width: 2048, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", ...disposition } });
});
