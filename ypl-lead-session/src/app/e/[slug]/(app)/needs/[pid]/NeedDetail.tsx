"use client";
import Link from "next/link";
import { CategoryBadge } from "@/components/bits";
import { useEvent } from "@/components/EventProvider";
import { CheckLeadsPanel, LeadChips, OfferBox } from "@/components/leads";
import { NotesBox } from "@/components/notes";

export function NeedDetail({ participantId }: { participantId: string }) {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const p = snap.participants.find((x) => x.id === participantId);
  const need = snap.needs.find((n) => n.participantId === participantId);
  if (!p || !need) {
    return (
      <div className="card">
        <p>That need wasn&apos;t found.</p>
        <Link className="btn btn-secondary mt-3" href={`/e/${slug}/needs`}>
          Back to the Index
        </Link>
      </div>
    );
  }
  const isMe = p.id === snap.viewer.participantId;
  return (
    <div className="space-y-4">
      <Link href={`/e/${slug}/needs`} className="text-sm font-semibold text-crimson">
        ← Index
      </Link>
      <article className="card">
        <CategoryBadge category={need.category} />
        <h1 className="mt-2 text-3xl font-bold text-crimson">{p.name}</h1>
        <div className="text-gray-600">
          {p.chapter}
          {p.email && (
            <>
              {" · "}
              <a className="underline" href={`mailto:${p.email}`}>
                {p.email}
              </a>
            </>
          )}
        </div>
        <p className="mt-4 text-xl font-bold">{need.title}</p>
        {need.description && <p className="mt-2 whitespace-pre-wrap text-gray-700">{need.description}</p>}
        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">Leads</h2>
        <div className="mt-2">
          <LeadChips needId={need.id} />
        </div>
        {isMe && (
          <Link className="btn btn-primary mt-4" href={`/e/${slug}/me`}>
            Go to My Need
          </Link>
        )}
      </article>
      {!isMe && <OfferBox key={need.id} needId={need.id} ownerName={p.name} large />}
      {!isMe && snap.viewer.isAdmin && <CheckLeadsPanel key={`c-${need.id}`} needId={need.id} ownerId={p.id} />}
      <NotesBox key={`n-${need.id}`} needId={need.id} />
    </div>
  );
}
