"use client";
import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "queued" | "error";

/** Debounced autosave. Calls `save` `delay` ms after the last change to `value`. */
export function useAutosave<T>(value: T, save: (v: T) => Promise<"ok" | "queued" | void>, delay = 800, enabled = true) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!enabled) return;
    setState("saving");
    const t = setTimeout(async () => {
      try {
        const r = await saveRef.current(JSON.parse(serialized) as T);
        setState(r === "queued" ? "queued" : "saved");
        setError(null);
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    }, delay);
    return () => clearTimeout(t);
  }, [serialized, delay, enabled]);

  return { state, error };
}
