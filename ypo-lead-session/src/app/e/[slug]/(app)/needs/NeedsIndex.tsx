"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEvent } from "@/components/EventProvider";
import { OfferBox } from "@/components/leads";
import { CATEGORIES } from "@/lib/types";

type Sort = "name" | "chapter" | "leads";

export function NeedsIndex() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const [q, setQ] = useState("");
  const [chapter, setChapter] = useState("");
  const [sort, setSort] = useState<Sort>("name");

  const people = new Map(snap.participants.map((p) => [p.id, p]));
  const chapters = useMemo(() => [...new Set(snap.participants.filter((p) => p.role !== "guest").map((p) => p.chapter).filter(Boolean))].sort(), [snap.participants]);
  const myNoteNeeds = new Set(snap.notes.filter((n) => n.authorId === me && n.body.trim()).map((n) => n.needId));

  const rows = snap.needs
    .map((n) => {
      const p = people.get(n.participantId)!;
      const leads = snap.leads.filter((l) => l.needId === n.id);
      const rated = leads.filter((l) => l.strength !== null);
      const avg = rated.length ? rated.reduce((s, l) => s + (l.strength ?? 0), 0) / rated.length : null;
      return { n, p, leadCount: leads.length, avg };
    })
    .filter((r) => r.p && r.p.role !== "guest")
    .filter((r) => !chapter || r.p.chapter === chapter)
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return !t || [r.p.name, r.p.chapter, r.n.title, r.n.description].some((x) => x.toLowerCase().includes(t));
    })
    .sort((a, b) => (sort === "leads" ? b.leadCount - a.leadCount : sort === "chapter" ? a.p.chapter.localeCompare(b.p.chapter) : 0) || a.p.name.localeCompare(b.p.name));

  return (
    <div>
      <h1 className="text-2xl font-bold">Index of needs</h1>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
        <input type="search" className="input" placeholder="Search names, chapters, needs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label="Filter by chapter">
          <option value="">All chapters</option>
          {chapters.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="name">Sort by name</option>
          <option value="chapter">Sort by chapter</option>
          <option value="leads">Sort by number of leads</option>
        </select>
      </div>

      {CATEGORIES.map((cat) => {
        const list = rows.filter((r) => r.n.category === cat.value);
        return (
          <section key={cat.value} className="mt-6" aria-labelledby={`cat-${cat.value}`}>
            <h2 id={`cat-${cat.value}`} className="border-b-2 border-crimson pb-1 text-xl font-bold text-crimson">
              {cat.label} <span className="text-base font-normal text-gray-500">({list.length})</span>
            </h2>
            {!list.length && <p className="mt-2 text-sm text-gray-500">None yet.</p>}
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {list.map(({ n, p, leadCount, avg }) => (
                <li key={n.id} className="card flex flex-col gap-2">
                  <Link href={`/e/${slug}/needs/${p.id}`} className="group">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-bold group-hover:text-crimson group-hover:underline">{p.name}</span>
                      {myNoteNeeds.has(n.id) && (
                        <span className="text-xs font-semibold text-gray-500" title="You have notes on this need">
                          📝 My notes
                        </span>
                      )}
                    </div>
                    {p.chapter && <div className="text-sm text-gray-500">{p.chapter}</div>}
                    <div className="mt-1 font-semibold">{n.title}</div>
                    {n.description && <p className="line-clamp-3 text-sm text-gray-700">{n.description}</p>}
                    <div className="mt-1 text-sm text-gray-600">
                      {leadCount} lead{leadCount === 1 ? "" : "s"}
                      {avg !== null && ` · avg strength ${avg.toFixed(1)}`}
                    </div>
                  </Link>
                  {p.id !== me ? <OfferBox key={n.id} needId={n.id} ownerName={p.name} /> : <span className="text-sm font-semibold text-crimson">This is your need</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
