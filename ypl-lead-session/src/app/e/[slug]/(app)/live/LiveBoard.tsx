"use client";
import { useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/bits";
import { useEvent } from "@/components/EventProvider";
import { CheckLeadsPanel, LeadChips, OfferBox } from "@/components/leads";
import { NotesBox } from "@/components/notes";
import { api } from "@/lib/client/api";

export function LiveBoard({ projector }: { projector: boolean }) {
  const { snap, patch, refresh } = useEvent();
  const slug = snap.event.slug;
  const isAdmin = snap.viewer.isAdmin;
  const [follow, setFollow] = useState(true);
  const [localId, setLocalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needByOwner = useMemo(() => new Map(snap.needs.map((n) => [n.participantId, n])), [snap.needs]);
  const presenters = useMemo(
    () => snap.participants.filter((p) => p.role !== "guest" && needByOwner.has(p.id)).sort((a, b) => a.presentationOrder - b.presentationOrder),
    [snap.participants, needByOwner],
  );

  const followedId = snap.event.currentPresenterId ?? presenters[0]?.id ?? null;
  const currentId = isAdmin || follow || !localId ? followedId : localId;
  const idx = presenters.findIndex((p) => p.id === currentId);
  const current = idx >= 0 ? presenters[idx] : presenters[0];
  const need = current ? needByOwner.get(current.id) : undefined;

  useEffect(() => {
    if (follow) setLocalId(null);
  }, [follow]);

  async function go(id: string | null) {
    if (!id) return;
    if (!isAdmin) {
      setFollow(false);
      setLocalId(id);
      return;
    }
    setError(null);
    patch((s) => ({ ...s, event: { ...s.event, currentPresenterId: id } }));
    try {
      await api(`/api/e/${slug}/presenter`, { participantId: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't move to that presenter");
      void refresh();
    }
  }

  if (!presenters.length) {
    return (
      <div className="card text-center">
        <h1 className="text-xl font-bold">No needs yet</h1>
        <p className="mt-1 text-gray-600">Once people register, their needs show up here.</p>
        <a className="btn btn-primary mt-4" href={`/e/${slug}/register`}>
          Share your need
        </a>
      </div>
    );
  }
  if (!current || !need) return null;

  const isMe = current.id === snap.viewer.participantId;
  const prev = idx > 0 ? presenters[idx - 1] : null;
  const next = idx >= 0 && idx < presenters.length - 1 ? presenters[idx + 1] : null;
  const leadCount = snap.leads.filter((l) => l.needId === need.id).length;

  if (projector) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-white p-8 sm:p-12">
        <div className="text-xl font-semibold text-gray-500">
          {idx + 1} of {presenters.length} · {snap.event.title}
        </div>
        <h1 className="mt-4 text-5xl font-bold text-crimson sm:text-7xl">{current.name}</h1>
        <div className="mt-2 text-2xl text-gray-600">
          {current.chapter} · <CategoryBadge category={need.category} />
        </div>
        <p className="mt-8 text-4xl font-bold leading-tight sm:text-5xl">{need.title}</p>
        {need.description && <p className="mt-4 max-w-5xl whitespace-pre-wrap text-2xl text-gray-700 sm:text-3xl">{need.description}</p>}
        <div className="mt-auto pt-10">
          <div className="text-2xl font-bold text-gray-500">
            {leadCount} lead{leadCount === 1 ? "" : "s"}
          </div>
          <div className="mt-3">
            <LeadChips needId={need.id} big />
          </div>
        </div>
        <a href={`/e/${slug}/live`} className="absolute right-4 top-4 text-sm text-gray-400 hover:text-gray-700">
          Exit projector view
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => go(prev?.id ?? null)} disabled={!prev}>
            ← Previous
          </button>
          <span className="text-sm text-gray-600">
            {idx + 1} of {presenters.length}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => go(next?.id ?? null)} disabled={!next}>
            Next →
          </button>
          {!isAdmin && (
            <label className="ml-auto flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-5 accent-crimson" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              Follow the facilitator
            </label>
          )}
          {isAdmin && (
            <a className="btn btn-ghost ml-auto text-sm" href={`/e/${slug}/live?display=projector`} target="_blank" rel="noreferrer">
              Projector view ↗
            </a>
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}

        <article className="card border-t-4 border-t-crimson" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={need.category} />
            {isMe && <span className="badge bg-crimson text-white">You&apos;re presenting</span>}
          </div>
          <h1 className="mt-2 text-3xl font-bold text-crimson sm:text-4xl">{current.name}</h1>
          {current.chapter && <div className="text-gray-600">{current.chapter}</div>}
          <p className="mt-4 text-xl font-bold sm:text-2xl">{need.title}</p>
          {need.description && <p className="mt-2 whitespace-pre-wrap text-lg text-gray-700">{need.description}</p>}
          <div className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Leads ({leadCount})</h2>
            <div className="mt-2">
              <LeadChips needId={need.id} />
            </div>
          </div>
        </article>

        {isMe || isAdmin ? <CheckLeadsPanel key={`check-${need.id}`} needId={need.id} ownerId={current.id} /> : <OfferBox key={`offer-${need.id}`} needId={need.id} ownerName={current.name} large />}
        <NotesBox key={`notes-${need.id}`} needId={need.id} />
      </div>

      <aside className="card h-fit lg:sticky lg:top-16" aria-label="Presenters">
        <h2 className="font-bold">Presenters</h2>
        <ol className="mt-2 space-y-1">
          {presenters.map((p, i) => {
            const n = needByOwner.get(p.id)!;
            const count = snap.leads.filter((l) => l.needId === n.id).length;
            const active = p.id === current.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => go(p.id)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left ${active ? "bg-crimson-light font-bold text-crimson" : "hover:bg-gray-50"}`}
                >
                  <span className="w-6 text-right text-sm text-gray-500">{i + 1}.</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  {count > 0 && <span className="badge bg-gray-100 text-gray-700">{count}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
