"use client";
// Lead capture: the need owner's "Check your leads" panel, the "I have a lead for you" checkbox, and read-only chips.
import { useEffect, useMemo, useState } from "react";
import { api, resilientPost } from "@/lib/client/api";
import { useAutosave } from "@/lib/client/hooks";
import type { Snapshot } from "@/lib/types";
import { StrengthPill } from "./bits";
import { useEvent } from "./EventProvider";
import { SavedIndicator } from "./SavedIndicator";

type Lead = Snapshot["leads"][number];

const RATINGS = [
  { v: 5, label: "5 Strong" },
  { v: 4, label: "4" },
  { v: 3, label: "3" },
  { v: 2, label: "2" },
  { v: 1, label: "1 Weak" },
];

function sortByStrength(leads: Lead[]) {
  return [...leads].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0));
}

/** "Check your leads": for the need's owner (and facilitators). */
export function CheckLeadsPanel({ needId, ownerId }: { needId: string; ownerId: string }) {
  const { snap, patch, refresh } = useEvent();
  const slug = snap.event.slug;
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // giver whose picker is open
  const locked = snap.event.leadsLocked && !snap.viewer.isAdmin;

  const leadsByGiver = useMemo(() => new Map(snap.leads.filter((l) => l.needId === needId).map((l) => [l.giverId, l])), [snap.leads, needId]);
  const people = useMemo(() => {
    const term = q.trim().toLowerCase();
    return snap.participants
      .filter((p) => p.id !== ownerId)
      .filter((p) => !term || p.name.toLowerCase().includes(term) || p.chapter.toLowerCase().includes(term))
      .sort((a, b) => {
        // Offers first, then everyone else alphabetically.
        const ao = leadsByGiver.has(a.id) ? 0 : 1;
        const bo = leadsByGiver.has(b.id) ? 0 : 1;
        return ao - bo || a.name.localeCompare(b.name);
      });
  }, [snap.participants, ownerId, q, leadsByGiver]);

  async function write(giverId: string, strength: number | null, remove = false) {
    setError(null);
    patch((s) => {
      const others = s.leads.filter((l) => !(l.needId === needId && l.giverId === giverId));
      if (remove) return { ...s, leads: others };
      const existing = s.leads.find((l) => l.needId === needId && l.giverId === giverId);
      const lead: Lead = existing
        ? { ...existing, strength }
        : { id: `tmp-${giverId}`, needId, giverId, strength, source: "owner", giverNote: "", outreachSubject: null, outreachBody: null };
      return { ...s, leads: [...others, lead] };
    });
    try {
      await resilientPost(slug, `lead:${needId}:${giverId}`, `/api/e/${slug}/leads`, { needId, giverId, strength, remove });
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      void refresh();
    }
  }

  const offers = [...leadsByGiver.values()].filter((l) => l.strength === null && l.source === "giver");

  return (
    <section className="card border-crimson/40" aria-labelledby={`check-${needId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`check-${needId}`} className="text-lg font-bold text-crimson">
          Check your leads
        </h3>
        <span className="text-sm text-gray-600">{leadsByGiver.size} checked</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">Tick everyone who raised their hand for you, then rate each lead from 5 (strong) to 1 (weak).</p>
      {offers.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {offers.length} {offers.length === 1 ? "person says" : "people say"} they have a lead for you. Rate {offers.length === 1 ? "it" : "them"} below.
        </p>
      )}
      {locked && <p className="mt-2 text-sm text-gray-600">Summaries have gone out, so leads are final.</p>}
      <input type="search" className="input mt-3" placeholder="Search names or chapters" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search participants" />
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <ul className="mt-3 max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
        {people.map((p) => {
          const lead = leadsByGiver.get(p.id);
          const checked = !!lead;
          const showPicker = checked && (open === p.id || lead.strength === null);
          return (
            <li key={p.id} className="py-2">
              <div className="flex items-center gap-3">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-6 accent-crimson"
                    checked={checked}
                    disabled={locked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setOpen(p.id);
                        void write(p.id, null);
                      } else {
                        void write(p.id, null, true);
                      }
                    }}
                    aria-label={`${p.name} has a lead for you`}
                  />
                  <span>
                    <span className="font-semibold">{p.name}</span>
                    {p.chapter && <span className="text-sm text-gray-500"> · {p.chapter}</span>}
                    {p.role === "guest" && <span className="text-xs text-gray-500"> (guest)</span>}
                    {lead?.source === "giver" && <span className="ml-1 text-xs font-semibold text-amber-700">offered</span>}
                  </span>
                </label>
                {checked && !showPicker && (
                  <button type="button" onClick={() => setOpen(p.id)} disabled={locked} aria-label={`Change rating for ${p.name}`}>
                    <StrengthPill strength={lead.strength} />
                  </button>
                )}
              </div>
              {lead?.giverNote && <p className="ml-9 text-sm text-gray-600">&ldquo;{lead.giverNote}&rdquo;</p>}
              {showPicker && !locked && (
                <div className="ml-9 mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`Rate ${p.name}'s lead`}>
                  {RATINGS.map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => {
                        setOpen(null);
                        void write(p.id, r.v);
                      }}
                      className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${lead.strength === r.v ? "border-crimson bg-crimson text-white" : "border-gray-300 bg-white hover:border-crimson"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!people.length && <li className="py-3 text-sm text-gray-500">No one matches &ldquo;{q}&rdquo;.</li>}
      </ul>
      {!locked && <AddGuest needId={needId} />}
    </section>
  );
}

/** "Add someone not on the list". */
function AddGuest({ needId }: { needId: string }) {
  const { snap, refresh } = useEvent();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [chapter, setChapter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost mt-2 px-2 text-sm" onClick={() => setOpen(true)}>
        + Add someone not on the list
      </button>
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/e/${snap.event.slug}/guests`, { name, email, chapter, needId, strength: null });
      setName("");
      setEmail("");
      setChapter("");
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
      <p className="text-sm font-semibold">Someone who raised a hand but didn&apos;t register</p>
      <input className="input" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} aria-label="Guest name" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Guest email" />
        <input className="input" placeholder="Chapter (optional)" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label="Guest chapter" />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          Add as a lead
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "I have a lead for you": everyone except the need's owner. */
export function OfferBox({ needId, ownerName, large = false }: { needId: string; ownerName: string; large?: boolean }) {
  const { snap, patch, refresh } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const mine = snap.leads.find((l) => l.needId === needId && l.giverId === me);
  const [note, setNote] = useState(mine?.giverNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const checked = !!mine;
  const rated = mine?.strength !== null && mine?.strength !== undefined;
  const locked = snap.event.leadsLocked;

  useEffect(() => {
    // Pick up the note if it arrives from another device.
    if (mine && document.activeElement?.id !== `offer-note-${needId}`) setNote(mine.giverNote);
  }, [mine, needId]);

  const autosave = useAutosave(
    note,
    async (v) => (checked ? resilientPost(slug, `offer:${needId}`, `/api/e/${slug}/offers`, { needId, checked: true, note: v }) : undefined),
    800,
    checked,
  );

  if (!me) return null;

  async function toggle(next: boolean) {
    setError(null);
    patch((s) => {
      const others = s.leads.filter((l) => !(l.needId === needId && l.giverId === me));
      if (!next) return { ...s, leads: others };
      return { ...s, leads: [...others, { id: `tmp-offer-${needId}`, needId, giverId: me!, strength: null, source: "giver", giverNote: note, outreachSubject: null, outreachBody: null }] };
    });
    try {
      await resilientPost(slug, `offer:${needId}`, `/api/e/${slug}/offers`, { needId, checked: next, note: next ? note : undefined });
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      void refresh();
    }
  }

  return (
    <div className={`rounded-xl border-2 ${checked ? "border-crimson bg-crimson-light" : "border-gray-200 bg-white"} p-3`}>
      <label className={`flex cursor-pointer items-center gap-3 ${large ? "min-h-14 text-lg" : "min-h-11"}`}>
        <input type="checkbox" className={`${large ? "size-7" : "size-6"} accent-crimson`} checked={checked} disabled={locked || rated} onChange={(e) => void toggle(e.target.checked)} />
        <span className="font-bold">I have a lead for {ownerName.split(" ")[0]}</span>
      </label>
      {rated && <p className="ml-9 text-sm text-gray-600">{ownerName.split(" ")[0]} has rated your lead, so it can&apos;t be withdrawn.</p>}
      {checked && (
        <div className="ml-0 mt-2 sm:ml-9">
          <label htmlFor={`offer-note-${needId}`} className="sr-only">
            Who or what is the lead?
          </label>
          <input id={`offer-note-${needId}`} className="input" maxLength={280} placeholder="Who or what is the lead? (optional)" value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-1 h-5">
            <SavedIndicator state={autosave.state} error={autosave.error} />
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Read-only list of leads on a need. */
export function LeadChips({ needId, big = false }: { needId: string; big?: boolean }) {
  const { snap } = useEvent();
  const name = new Map(snap.participants.map((p) => [p.id, p.name]));
  const leads = sortByStrength(snap.leads.filter((l) => l.needId === needId));
  if (!leads.length) return <p className={`${big ? "text-2xl" : "text-sm"} text-gray-500`}>No leads yet</p>;
  return (
    <ul className={`flex flex-wrap gap-2 ${big ? "text-2xl" : ""}`}>
      {leads.map((l) => (
        <li key={l.id} className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white ${big ? "px-5 py-2" : "px-3 py-1 text-sm"}`}>
          <span className="font-semibold">{name.get(l.giverId) ?? "Someone"}</span>
          <StrengthPill strength={l.strength} />
        </li>
      ))}
    </ul>
  );
}
