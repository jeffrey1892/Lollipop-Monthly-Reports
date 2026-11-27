"use client";
import { useCallback, useEffect, useState } from "react";
import { CategoryBadge } from "@/components/bits";
import { useEvent } from "@/components/EventProvider";
import { api } from "@/lib/client/api";
import { formatTime, localParts, tzAbbrev } from "@/lib/format";
import { CATEGORIES, type Category, type EventStatus } from "@/lib/types";

const STATUS_LABEL: Record<EventStatus, string> = {
  registration_open: "Registration open",
  registration_locked: "Registration locked",
  live: "Live",
  closed: "Closed",
};

export function AdminPanel() {
  const { snap } = useEvent();
  if (!snap.viewer.isAdminEmail) return <div className="card">Facilitator access only.</div>;
  if (!snap.viewer.isAdmin) return <PinGate />;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Facilitator admin</h1>
      <SessionControls />
      <PowerPointCard />
      <SummariesCard />
      <ParticipantsCard />
      <EventSetup />
      <NewEvent />
    </div>
  );
}

function PinGate() {
  const { snap } = useEvent();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/e/${snap.event.slug}/auth/pin`, { pin });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wrong PIN");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3">
      <h1 className="text-xl font-bold">Facilitator PIN</h1>
      <p className="text-sm text-gray-600">Enter the shared PIN once to turn on admin features on this device.</p>
      <input className="input" type="password" inputMode="numeric" autoComplete="one-time-code" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || !pin}>
        Unlock admin
      </button>
    </form>
  );
}

function useAction() {
  const { refresh } = useEvent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = useCallback(
    async (fn: () => Promise<string | void>) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const m = await fn();
        if (m) setMessage(m);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  return { busy, error, message, run };
}

function SessionControls() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const { busy, error, run } = useAction();
  const s = snap.event.status;
  const act = (action: string, confirmText?: string) => () => {
    if (confirmText && !window.confirm(confirmText)) return;
    void run(async () => void (await api(`/api/e/${slug}/admin/status`, { action })));
  };
  const steps: { action: string; label: string; active: boolean; confirm?: string }[] = [
    { action: "open_registration", label: "1. Open registration", active: s === "registration_open" },
    { action: "lock_registration", label: "2. Lock registration", active: s === "registration_locked" },
    { action: "go_live", label: "3. Go live", active: s === "live" },
    {
      action: "close",
      label: "4. Close session",
      active: s === "closed",
      confirm: `Close the session? Summaries will email automatically in ${snap.event.sendDelayMinutes} minutes.`,
    },
  ];
  return (
    <section className="card" aria-labelledby="session">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="session" className="text-lg font-bold">
          Session
        </h2>
        <span className="badge bg-crimson text-white">{STATUS_LABEL[s]}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((st) => (
          <button
            key={st.action}
            type="button"
            className={`btn ${st.active ? "btn-primary" : "btn-secondary"}`}
            disabled={busy || st.active || !!snap.event.summariesStartedAt}
            onClick={act(st.action, st.confirm)}
            aria-pressed={st.active}
          >
            {st.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn btn-ghost" href={`/e/${slug}/qr`}>
          Show QR code
        </a>
        <a className="btn btn-ghost" href={`/e/${slug}/live?display=projector`} target="_blank" rel="noreferrer">
          Projector view ↗
        </a>
      </div>
    </section>
  );
}

function PowerPointCard() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const people = snap.participants.filter((p) => p.role !== "guest" && snap.needs.some((n) => n.participantId === p.id)).length;
  return (
    <section className="card" aria-labelledby="ppt">
      <h2 id="ppt" className="text-lg font-bold">
        PowerPoint
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        One slide per person ({people}) with their name, need and leads, built from the data at the moment you click. Click again any time for the latest.
      </p>
      <a className="btn btn-primary mt-3" href={`/api/e/${slug}/admin/pptx`}>
        Generate PowerPoint
      </a>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-600">CSV exports:</span>
        {(["participants", "needs", "leads", "notes"] as const).map((t) => (
          <a key={t} className="font-semibold text-crimson underline" href={`/api/e/${slug}/admin/csv?type=${t}`}>
            {t}
          </a>
        ))}
      </div>
    </section>
  );
}

interface SummaryRow {
  id: string;
  kind: "personal" | "digest";
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  sent_at: string | null;
  error: string | null;
  name: string;
  email: string | null;
}

function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function SummariesCard() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const e = snap.event;
  const now = useNow();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const { busy, error, message, run } = useAction();

  const load = useCallback(async () => {
    const r = await api<{ rows: SummaryRow[] }>(`/api/e/${slug}/admin/summaries`);
    setRows(r.rows);
  }, [slug]);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
  }, [load]);

  const tz = e.timezone;
  const at = (iso: string) => `${formatTime(iso, tz)} ${tzAbbrev(iso, tz)}`;
  let statusLine: string;
  if (e.summariesSentAt) statusLine = `All summaries were sent at ${at(e.summariesSentAt)}.`;
  else if (e.summariesStartedAt) statusLine = "Summaries are being sent now…";
  else if (e.status === "closed" && e.sendDueAt) {
    const mins = Math.max(0, Math.ceil((new Date(e.sendDueAt).getTime() - now) / 60000));
    statusLine = `Summaries will email automatically at ${at(e.sendDueAt)} (${mins <= 0 ? "any moment now" : `in ${mins} minute${mins === 1 ? "" : "s"}`}).`;
  } else {
    const backstop = e.endsAt ? at(e.endsAt) : "6:00 PM";
    statusLine = `Summaries email automatically ${e.sendDelayMinutes} minutes after you close the session. If it isn't closed by ${backstop}, it closes itself then.`;
  }
  const counts = { sent: rows.filter((r) => r.status === "sent").length, failed: rows.filter((r) => r.status === "failed").length, total: rows.length };

  return (
    <section className="card" aria-labelledby="summaries">
      <h2 id="summaries" className="text-lg font-bold">
        Summaries (sent automatically)
      </h2>
      <p className="mt-1 text-gray-700" role="status">
        {statusLine}
      </p>
      <p className="mt-1 text-sm text-gray-600">Each person gets their own summary with outreach drafts, and everyone gets the group digest (no ratings, no notes).</p>
      <button
        type="button"
        className="btn btn-secondary mt-3"
        disabled={busy}
        onClick={() => run(async () => (await api<{ message: string }>(`/api/e/${slug}/admin/summaries/test`, {})).message)}
      >
        Send test summary to me
      </button>
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {rows.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {counts.sent} of {counts.total} emails sent{counts.failed ? ` · ${counts.failed} failed` : ""}
          </p>
          <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Email</th>
                  <th className="py-1 pr-2">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 align-top">
                    <td className="py-1.5 pr-2">{r.name}</td>
                    <td className="py-1.5 pr-2">{r.kind === "personal" ? "Personal summary" : "Group digest"}</td>
                    <td className="py-1.5 pr-2">
                      <span className={r.status === "sent" ? "text-green-700" : r.status === "failed" ? "text-red-700" : "text-gray-600"}>{r.status}</span>
                      {r.error && <div className="text-xs text-red-700">{r.error}</div>}
                    </td>
                    <td className="py-1.5">
                      {r.status === "failed" && (
                        <button
                          type="button"
                          className="font-semibold text-crimson underline"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const res = await api<{ ok: boolean; error: string | null }>(`/api/e/${slug}/admin/summaries/retry`, { id: r.id });
                              await load();
                              return res.ok ? `Sent to ${r.name}.` : `Still failing: ${res.error}`;
                            })
                          }
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

interface PForm {
  name: string;
  email: string;
  chapter: string;
  category: Category;
  title: string;
  description: string;
}
const emptyForm: PForm = { name: "", email: "", chapter: "", category: "other", title: "", description: "" };

function ParticipantsCard() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const { busy, error, message, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PForm>(emptyForm);
  const [adding, setAdding] = useState(false);
  const needBy = new Map(snap.needs.map((n) => [n.participantId, n]));
  const list = snap.participants.filter((p) => p.role !== "guest").sort((a, b) => a.presentationOrder - b.presentationOrder);
  const guests = snap.participants.filter((p) => p.role === "guest");

  function startEdit(id: string) {
    const p = snap.participants.find((x) => x.id === id)!;
    const n = needBy.get(id);
    setForm({ name: p.name, email: p.email ?? "", chapter: p.chapter, category: n?.category ?? "other", title: n?.title ?? "", description: n?.description ?? "" });
    setEditing(id);
    setAdding(false);
  }

  function move(id: string, dir: -1 | 1) {
    const ids = list.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(async () => void (await api(`/api/e/${slug}/admin/order`, { ids })));
  }

  const formFields = (
    <div className="grid gap-2 sm:grid-cols-3">
      <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
      <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
      <input className="input" placeholder="Chapter" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} aria-label="Chapter" />
      <input className="input sm:col-span-2" placeholder="Need headline" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Need headline" />
      <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} aria-label="Category">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea className="input sm:col-span-3" placeholder="Need details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Need details" />
    </div>
  );

  return (
    <section className="card" aria-labelledby="people">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="people" className="text-lg font-bold">
          Participants ({list.length}) · speaking order
        </h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setForm(emptyForm);
            setAdding(true);
            setEditing(null);
          }}
        >
          + Add participant
        </button>
      </div>
      {adding && (
        <form
          className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/e/${slug}/admin/participants`, form);
              setAdding(false);
              return `Added ${form.name}.`;
            });
          }}
        >
          <p className="text-sm font-semibold">Add a walk-in</p>
          {formFields}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || !form.name.trim()}>
              Add
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <ol className="mt-3 divide-y divide-gray-100">
        {list.map((p, i) => {
          const n = needBy.get(p.id);
          return (
            <li key={p.id} className="py-2">
              {editing === p.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(`/api/e/${slug}/admin/participants/${p.id}`, form, "PUT");
                      setEditing(null);
                      return `Saved ${form.name}.`;
                    });
                  }}
                >
                  {formFields}
                  <div className="flex gap-2">
                    <button className="btn btn-primary" disabled={busy}>
                      Save
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-right text-sm text-gray-500">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {p.name} {p.role === "facilitator" && <span className="text-xs text-gray-500">(facilitator)</span>}
                    </div>
                    <div className="truncate text-sm text-gray-600">
                      {p.chapter} {p.email && `· ${p.email}`}
                    </div>
                    {n ? (
                      <div className="text-sm">
                        <CategoryBadge category={n.category} /> {n.title}
                      </div>
                    ) : (
                      <div className="text-sm text-amber-700">No need entered</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-secondary px-3" onClick={() => move(p.id, -1)} disabled={busy || i === 0} aria-label={`Move ${p.name} up`}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-secondary px-3" onClick={() => move(p.id, 1)} disabled={busy || i === list.length - 1} aria-label={`Move ${p.name} down`}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-secondary px-3" onClick={() => startEdit(p.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary px-3 text-red-700"
                      onClick={() => {
                        if (window.confirm(`Remove ${p.name}, their need, leads and notes?`)) void run(async () => void (await api(`/api/e/${slug}/admin/participants/${p.id}`, undefined, "DELETE")));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {guests.length > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Guests added as leads (can&apos;t sign in): {guests.map((g) => g.name).join(", ")}
        </p>
      )}
    </section>
  );
}

const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "UTC"];

function eventFormFrom(e: { title: string; location: string; startsAt: string; endsAt: string | null; timezone: string; sendDelayMinutes: number; signInUntil: string | null }) {
  const s = localParts(e.startsAt, e.timezone);
  return {
    title: e.title,
    location: e.location,
    date: s.date,
    startTime: s.time,
    endTime: e.endsAt ? localParts(e.endsAt, e.timezone).time : "",
    timezone: e.timezone,
    sendDelayMinutes: e.sendDelayMinutes,
    signInUntil: e.signInUntil ?? "",
  };
}

type EventForm = ReturnType<typeof eventFormFrom>;

function EventFields({ form, setForm }: { form: EventForm; setForm: (f: EventForm) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Title</label>
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label className="label">Location</label>
        <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </div>
      <div>
        <label className="label">Date</label>
        <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </div>
      <div>
        <label className="label">Start time</label>
        <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      </div>
      <div>
        <label className="label">
          End time <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      </div>
      <div>
        <label className="label">Time zone</label>
        <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
          {[...new Set([form.timezone, ...TIMEZONES])].map((t) => (
            <option key={t} value={t}>
              {t === "America/New_York" ? "Eastern (America/New_York)" : t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Send summaries this many minutes after closing</label>
        <input className="input" type="number" min={0} max={1440} value={form.sendDelayMinutes} onChange={(e) => setForm({ ...form, sendDelayMinutes: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Keep people signed in through</label>
        <input className="input" type="date" value={form.signInUntil} onChange={(e) => setForm({ ...form, signInUntil: e.target.value })} />
        <p className="mt-1 text-xs text-gray-500">End of this day, event time. Applies the next time someone signs in. Blank means 30 days.</p>
      </div>
    </div>
  );
}

function EventSetup() {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const [form, setForm] = useState(() => eventFormFrom(snap.event));
  const { busy, error, message, run } = useAction();
  return (
    <details className="card">
      <summary className="cursor-pointer text-lg font-bold">Event setup</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api(`/api/e/${slug}/admin/event`, form, "PUT");
            return "Saved. Reload to see the new header.";
          });
        }}
      >
        <EventFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button className="btn btn-primary" disabled={busy}>
          Save event
        </button>
      </form>
    </details>
  );
}

function NewEvent() {
  const { snap } = useEvent();
  const [form, setForm] = useState<EventForm & { slug: string }>(() => ({ ...eventFormFrom(snap.event), title: "HBS YPO · Week 3", slug: "ypo-week-3" }));
  const { busy, error, run } = useAction();
  return (
    <details className="card">
      <summary className="cursor-pointer text-lg font-bold">Create another event</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await api<{ next: string }>(`/api/admin/events`, { ...form, fromSlug: snap.event.slug });
            window.location.href = r.next;
          });
        }}
      >
        <div>
          <label className="label">Link name</label>
          <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <p className="mt-1 text-xs text-gray-500">The registration link will be /e/{form.slug || "…"}/register</p>
        </div>
        <EventFields form={form} setForm={(f) => setForm({ ...form, ...f })} />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          Create event
        </button>
      </form>
    </details>
  );
}
