"use client";
import Link from "next/link";
import { useState } from "react";
import { StrengthPill } from "@/components/bits";
import { useEvent } from "@/components/EventProvider";
import { CheckLeadsPanel } from "@/components/leads";
import { SavedIndicator } from "@/components/SavedIndicator";
import { api } from "@/lib/client/api";
import { useAutosave } from "@/lib/client/hooks";
import { CATEGORIES, type Category, type Snapshot } from "@/lib/types";

export function MyNeed() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const need = snap.needs.find((n) => n.participantId === me);

  if (!me) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">You&apos;re signed in as a facilitator</h1>
        <p className="mt-1 text-gray-600">Register too if you want to share a need of your own.</p>
        <a className="btn btn-primary mt-4" href={`/e/${slug}/register?email=${encodeURIComponent(snap.viewer.email)}`}>
          Register
        </a>
      </div>
    );
  }
  if (!need) {
    return (
      <div className="card">
        <p>You haven&apos;t shared a need yet.</p>
        <a className="btn btn-primary mt-3" href={`/e/${slug}/register`}>
          Share your need
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <NeedEditor key={need.id} need={need} />
      <CheckLeadsPanel needId={need.id} ownerId={me} />
      <OutreachDrafts needId={need.id} />
      <LeadsIOffered />
      <NotesIWrote />
    </div>
  );
}

function NeedEditor({ need }: { need: Snapshot["needs"][number] }) {
  const { snap, refresh } = useEvent();
  const slug = snap.event.slug;
  const closed = snap.event.status === "closed" && !snap.viewer.isAdmin;
  const [form, setForm] = useState({ category: need.category as Category, title: need.title, description: need.description });
  const [suggesting, setSuggesting] = useState(false);
  const valid = form.title.trim().length > 0;
  const { state, error } = useAutosave(
    form,
    async (v) => {
      await api(`/api/e/${slug}/need`, v, "PUT");
      void refresh();
    },
    800,
    !closed && valid,
  );

  async function suggest() {
    setSuggesting(true);
    try {
      const r = await api<{ category: Category }>(`/api/e/${slug}/category`, { text: `${form.title}\n${form.description}` });
      setForm((f) => ({ ...f, category: r.category }));
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <section className="card" aria-labelledby="my-need">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="my-need" className="text-2xl font-bold">
          My need
        </h1>
        <SavedIndicator state={valid ? state : "error"} error={valid ? error : "Your need needs a headline"} />
      </div>
      {closed && <p className="mt-1 text-sm text-gray-600">The session is closed, so your need can no longer be edited.</p>}
      <div className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor="need-title">
            Headline
          </label>
          <input id="need-title" className="input" maxLength={140} disabled={closed} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="need-desc">
            Details
          </label>
          <textarea id="need-desc" className="input min-h-28" maxLength={2000} disabled={closed} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div>
          <label className="label" htmlFor="need-cat">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            <select id="need-cat" className="input sm:max-w-xs" disabled={closed} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {!closed && (
              <button type="button" className="btn btn-ghost text-sm" onClick={suggest} disabled={suggesting}>
                {suggesting ? "Thinking…" : "✨ Suggest"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OutreachDrafts({ needId }: { needId: string }) {
  const { snap } = useEvent();
  const name = new Map(snap.participants.map((p) => [p.id, p]));
  const leads = snap.leads.filter((l) => l.needId === needId).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0));
  return (
    <section className="card" aria-labelledby="drafts">
      <h2 id="drafts" className="text-lg font-bold">
        Outreach drafts
      </h2>
      <p className="mt-1 text-sm text-gray-600">Draft a follow-up email to each lead, then copy it into your own email. The app never sends these for you.</p>
      {!leads.length && <p className="mt-3 text-sm text-gray-500">Check your leads above, and a Draft email button appears for each one.</p>}
      <ul className="mt-3 space-y-3">
        {leads.map((l) => {
          const giver = name.get(l.giverId);
          return <DraftRow key={l.id} lead={l} giverName={giver?.name ?? "Someone"} giverEmail={giver?.email ?? null} />;
        })}
      </ul>
    </section>
  );
}

function DraftRow({ lead, giverName, giverEmail }: { lead: Snapshot["leads"][number]; giverName: string; giverEmail: string | null }) {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const [subject, setSubject] = useState(lead.outreachSubject ?? "");
  const [body, setBody] = useState(lead.outreachBody ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const has = !!(subject || body);
  const temp = lead.id.startsWith("tmp-");

  const { state } = useAutosave({ subject, body }, async (v) => void (await api(`/api/e/${slug}/drafts`, { action: "save", leadId: lead.id, ...v })), 800, has && !temp);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ subject: string; body: string }>(`/api/e/${slug}/drafts`, { action: "generate", leadId: lead.id });
      setSubject(r.subject);
      setBody(r.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write a draft");
    } finally {
      setBusy(false);
    }
  }

  async function copy(what: "subject" | "body") {
    try {
      await navigator.clipboard.writeText(what === "subject" ? subject : body);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Copy didn't work on this device. Select the text and copy it by hand.");
    }
  }

  const mailto = giverEmail ? `mailto:${encodeURIComponent(giverEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;

  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{giverName}</span> <StrengthPill strength={lead.strength} />
          {lead.giverNote && <div className="text-sm text-gray-600">&ldquo;{lead.giverNote}&rdquo;</div>}
        </div>
        <button type="button" className="btn btn-secondary text-sm" onClick={generate} disabled={busy || temp}>
          {busy ? "Writing…" : has ? "Redo draft" : "Draft email"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {has && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor={`subj-${lead.id}`}>
                Subject
              </label>
              <button type="button" className="text-sm font-semibold text-crimson" onClick={() => copy("subject")}>
                {copied === "subject" ? "Copied ✓" : "Copy subject"}
              </button>
            </div>
            <input id={`subj-${lead.id}`} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor={`body-${lead.id}`}>
                Body
              </label>
              <button type="button" className="text-sm font-semibold text-crimson" onClick={() => copy("body")}>
                {copied === "body" ? "Copied ✓" : "Copy body"}
              </button>
            </div>
            <textarea id={`body-${lead.id}`} className="input min-h-48" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {mailto ? (
              <a className="btn btn-ghost text-sm" href={mailto}>
                Open in my email ↗
              </a>
            ) : (
              <span className="text-sm text-gray-500">No email on file for {giverName}.</span>
            )}
            <SavedIndicator state={state} />
          </div>
        </div>
      )}
    </li>
  );
}

function LeadsIOffered() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const needs = new Map(snap.needs.map((n) => [n.id, n]));
  const people = new Map(snap.participants.map((p) => [p.id, p]));
  const offered = snap.leads.filter((l) => l.giverId === me);
  return (
    <section className="card" aria-labelledby="offered">
      <h2 id="offered" className="text-lg font-bold">
        Leads I&apos;ve offered
      </h2>
      <p className="mt-1 text-sm text-gray-600">Your follow-up list: everyone you said you have a lead for.</p>
      {!offered.length && <p className="mt-3 text-sm text-gray-500">None yet. Check &ldquo;I have a lead&rdquo; on someone&apos;s need in Live or the Index.</p>}
      <ul className="mt-3 divide-y divide-gray-100">
        {offered.map((l) => {
          const n = needs.get(l.needId);
          const owner = n ? people.get(n.participantId) : undefined;
          return (
            <li key={l.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link className="font-semibold hover:text-crimson hover:underline" href={`/e/${slug}/needs/${owner?.id ?? ""}`}>
                  {owner?.name ?? "Someone"}
                </Link>
                {l.strength !== null && <StrengthPill strength={l.strength} />}
              </div>
              <div className="text-sm">{n?.title}</div>
              {l.giverNote && <div className="text-sm text-gray-600">Your note: {l.giverNote}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotesIWrote() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const needs = new Map(snap.needs.map((n) => [n.id, n]));
  const people = new Map(snap.participants.map((p) => [p.id, p]));
  const mine = snap.notes.filter((n) => n.authorId === me && n.body.trim());
  return (
    <section className="card" aria-labelledby="my-notes">
      <h2 id="my-notes" className="text-lg font-bold">
        Notes I&apos;ve written
      </h2>
      {!mine.length && <p className="mt-2 text-sm text-gray-500">No notes yet.</p>}
      <ul className="mt-2 space-y-2">
        {mine.map((n) => {
          const need = needs.get(n.needId);
          const owner = need ? people.get(need.participantId) : undefined;
          return (
            <li key={n.id} className="rounded-lg bg-gray-50 p-2">
              <div className="text-sm font-semibold">
                <Link className="hover:text-crimson hover:underline" href={`/e/${slug}/needs/${owner?.id ?? ""}`}>
                  On {owner?.name ?? "someone"}&apos;s need
                </Link>{" "}
                <span className="font-normal text-gray-500">{n.visibility === "private" ? "🔒 Private" : "Shared"}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm">{n.body}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
