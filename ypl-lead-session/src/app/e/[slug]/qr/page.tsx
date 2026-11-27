import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { env } from "@/lib/env";
import { PrintButton } from "./PrintButton";

export default async function QrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer(slug);
  if (!viewer) redirect(`/e/${slug}/login`);
  if (!viewer.isAdmin) redirect(`/e/${slug}/admin`);
  const url = `${env.appBaseUrl}/e/${slug}/register`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  return (
    <main className="flex flex-col items-center px-4 py-6 text-center">
      <h1 className="text-3xl font-bold sm:text-4xl">Scan to share your need</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/e/${slug}/qr?format=svg`} alt={`QR code linking to ${url}`} className="mt-6 aspect-square w-[min(80vw,70vh)] bg-white p-2" />
      <p className="mt-4 break-all text-2xl font-bold text-crimson sm:text-3xl">{shortUrl}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
        <a className="btn btn-secondary" href={`/api/e/${slug}/qr?format=png&download=1`}>
          Download PNG (2048 px)
        </a>
        <a className="btn btn-secondary" href={`/api/e/${slug}/qr?format=svg&download=1`}>
          Download SVG
        </a>
        <PrintButton />
        <a className="btn btn-ghost" href={`/e/${slug}/admin`}>
          Back to admin
        </a>
      </div>
    </main>
  );
}
