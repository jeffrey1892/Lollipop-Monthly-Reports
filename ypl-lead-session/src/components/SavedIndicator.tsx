"use client";
import type { SaveState } from "@/lib/client/hooks";

export function SavedIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  if (state === "idle") return null;
  const map: Record<Exclude<SaveState, "idle">, { text: string; cls: string }> = {
    saving: { text: "Saving…", cls: "text-gray-500" },
    saved: { text: "Saved ✓", cls: "text-green-700" },
    queued: { text: "Offline: will save when you reconnect", cls: "text-amber-700" },
    error: { text: error || "Couldn't save", cls: "text-red-700" },
  };
  const m = map[state];
  return (
    <span role="status" aria-live="polite" className={`text-sm ${m.cls}`}>
      {m.text}
    </span>
  );
}
