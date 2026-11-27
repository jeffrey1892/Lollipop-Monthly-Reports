import { redirect } from "next/navigation";
import { EventProvider } from "@/components/EventProvider";
import { Nav } from "@/components/Nav";
import { WalkthroughProvider } from "@/components/Walkthrough";
import { getViewer, viewerSummary } from "@/lib/auth";
import { env } from "@/lib/env";
import { buildSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer(slug);
  if (!viewer) redirect(`/e/${slug}/login`);
  const snapshot = await buildSnapshot(viewer.event, viewerSummary(viewer));
  return (
    <EventProvider initial={snapshot} supabaseUrl={env.supabaseUrl} supabaseAnonKey={env.supabaseAnonKey}>
      <WalkthroughProvider>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-4 pb-16">{children}</main>
      </WalkthroughProvider>
    </EventProvider>
  );
}
