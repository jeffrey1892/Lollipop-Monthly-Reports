import { notFound } from "next/navigation";
import { eventWhenWhere } from "@/lib/format";
import { getEventBySlug } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  return (
    <div className="min-h-screen">
      <header className="bg-crimson text-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="text-lg font-bold leading-tight sm:text-xl">{event.title}</div>
          <div className="text-sm text-white/90">
            {eventWhenWhere({ startsAt: event.starts_at, endsAt: event.ends_at, timezone: event.timezone, location: event.location })}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
