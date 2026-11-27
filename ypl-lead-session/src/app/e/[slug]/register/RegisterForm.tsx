"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { CATEGORIES, categoryLabel, type Category, type EventStatus } from "@/lib/types";

interface Form {
  name: string;
  email: string;
  chapter: string;
  category: Category | "";
  title: string;
  description: string;
}

export function RegisterForm({ slug, initial, existing, status }: { slug: string; initial: Form; existing: boolean; status: EventStatus }) {
  const draftKey = `ypl-register-draft-${slug}`;
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { updated: boolean }>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  // Restore an unsent draft (nothing is lost on refresh).
  useEffect(() => {
    if (existing) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setForm((f) => ({ ...f, ...(JSON.parse(saved) as Partial<Form>), email: f.email || (JSON.parse(saved) as Form).email }));
    } catch {
      /* ignore */
    }
  }, [draftKey, existing]);

  useEffect(() => {
    if (existing || done) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
        setDraftSaved(true);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form, draftKey, existing, done]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDraftSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  async function suggest() {
    setSuggesting(true);
    try {
      const r = await api<{ category: Category }>(`/api/e/${slug}/category`, { text: `${form.title}\n${form.description}` });
      setForm((f) => ({ ...f, category: r.category }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't suggest a category");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) {
      setError("Choose a need category");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ updated: boolean }>(`/api/e/${slug}/register`, form);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setDone({ updated: r.updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't register");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-green-800">{done.updated ? "Your need is updated ✓" : "You're registered ✓"}</h1>
        <p className="mt-2 text-gray-700">Here's what everyone will see:</p>
        <div className="mt-4 rounded-lg bg-crimson-light p-4">
          <div className="text-sm font-semibold text-crimson">{form.category && categoryLabel(form.category)}</div>
          <div className="mt-1 text-lg font-bold">{form.title}</div>
          {form.description && <p className="mt-1 whitespace-pre-wrap text-gray-700">{form.description}</p>}
          <div className="mt-2 text-sm text-gray-600">
            {form.name} · {form.chapter}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className="btn btn-primary" href={`/e/${slug}/me`}>
            Edit my need
          </a>
          <a className="btn btn-secondary" href={`/e/${slug}/needs`}>
            See everyone&apos;s needs
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-600">To come back later, sign in with your email. No password needed.</p>
      </div>
    );
  }

  const closedToNew = !existing && status !== "registration_open";
  if (closedToNew) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold">Registration is closed</h1>
        <p className="mt-2 text-gray-700">Please see the facilitator to be added.</p>
        <p className="mt-4 text-gray-700">
          Already registered?{" "}
          <a className="font-semibold text-crimson underline" href={`/e/${slug}/login`}>
            Sign in with your email
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold">{existing ? "Update your need" : "Share your need"}</h1>
        <p className="mt-1 text-gray-600">
          {existing ? "Change anything and save." : "Takes a minute. You can come back and edit it any time before the session ends."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" className="input" autoComplete="name" required value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className="label" htmlFor="chapter">
            Chapter
          </label>
          <input id="chapter" className="input" required value={form.chapter} onChange={set("chapter")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" className="input" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set("email")} readOnly={existing} />
        {!existing && <p className="mt-1 text-xs text-gray-500">You&apos;ll use this to sign back in, and your summary goes here after the session.</p>}
      </div>
      <div>
        <label className="label" htmlFor="title">
          Your need, in one line
        </label>
        <input id="title" className="input" required maxLength={140} placeholder="e.g. Introductions to family offices investing in healthcare" value={form.title} onChange={set("title")} />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea id="description" className="input min-h-28" maxLength={2000} placeholder="What would move the needle for you in the next 90 days?" value={form.description} onChange={set("description")} />
      </div>
      <fieldset>
        <legend className="label">Need category</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <label key={c.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${form.category === c.value ? "border-crimson bg-crimson-light" : "border-gray-300 bg-white"}`}>
              <input type="radio" name="category" value={c.value} checked={form.category === c.value} onChange={() => setForm((f) => ({ ...f, category: c.value }))} className="accent-crimson" />
              <span className="font-medium">{c.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-ghost mt-2 px-2 text-sm" onClick={suggest} disabled={suggesting || !form.title.trim()}>
          {suggesting ? "Thinking…" : "✨ Suggest a category"}
        </button>
      </fieldset>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={busy}>
          {busy ? "Saving…" : existing ? "Save" : "Register"}
        </button>
        {!existing && draftSaved && <span className="text-sm text-gray-500">Draft saved ✓</span>}
      </div>
    </form>
  );
}
