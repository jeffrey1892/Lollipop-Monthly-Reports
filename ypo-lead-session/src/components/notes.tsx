"use client";
// Notes on a need: one autosaved note per person, private by default, plus everyone's shared notes.
import { useState } from "react";
import { resilientPost } from "@/lib/client/api";
import { useAutosave } from "@/lib/client/hooks";
import { useEvent } from "./EventProvider";
import { SavedIndicator } from "./SavedIndicator";

/** Render with key={needId} so switching presenters loads that need's note. */
export function NotesBox({ needId }: { needId: string }) {
  const { snap } = useEvent();
  const slug = snap.event.slug;
  const me = snap.viewer.participantId;
  const mine = snap.notes.find((n) => n.needId === needId && n.authorId === me);
  const [body, setBody] = useState(mine?.body ?? "");
  const [visibility, setVisibility] = useState<"private" | "shared">(mine?.visibility ?? "private");

  const value = { needId, body, visibility };
  const { state, error } = useAutosave(value, (v) => resilientPost(slug, `note:${v.needId}`, `/api/e/${slug}/notes`, v), 800, !!me);

  const others = snap.notes.filter((n) => n.needId === needId && n.authorId !== me && n.visibility === "shared" && n.body.trim());

  if (!me) return null;
  return (
    <section className="card" aria-labelledby={`notes-${needId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`notes-${needId}`} className="font-bold">
          My notes
        </h3>
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5" role="radiogroup" aria-label="Who can see this note">
          {(["private", "shared"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={`min-h-9 rounded-md px-3 text-sm font-semibold ${visibility === v ? "bg-crimson text-white" : "text-gray-700"}`}
            >
              {v === "private" ? "🔒 Private" : "Shared"}
            </button>
          ))}
        </div>
      </div>
      <textarea className="input mt-2 min-h-24" placeholder="Ideas, names, follow-ups…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="My notes on this need" />
      <div className="mt-1 flex h-5 items-center justify-between text-xs text-gray-500">
        <span>{visibility === "private" ? "Only you can see this note." : "Everyone can see this note."}</span>
        <SavedIndicator state={state} error={error} />
      </div>
      {others.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <h4 className="text-sm font-semibold text-gray-600">Shared notes from others</h4>
          <ul className="mt-2 space-y-2">
            {others.map((n) => (
              <li key={n.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                <div className="whitespace-pre-wrap">{n.body}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {n.authorName} · {new Date(n.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
