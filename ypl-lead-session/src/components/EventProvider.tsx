"use client";
// Holds the event snapshot for every signed-in screen. Refreshes on Realtime broadcasts and by polling.
import { createClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, flushQueue, queuedCount } from "@/lib/client/api";
import type { Snapshot } from "@/lib/types";

interface Ctx {
  snap: Snapshot;
  refresh: () => Promise<void>;
  /** Apply an optimistic local change right away; the next refresh replaces it with server truth. */
  patch: (fn: (s: Snapshot) => Snapshot) => void;
  offline: boolean;
  pending: number;
}

const EventCtx = createContext<Ctx | null>(null);

export function useEvent(): Ctx {
  const c = useContext(EventCtx);
  if (!c) throw new Error("useEvent outside EventProvider");
  return c;
}

const POLL_MS = 4000;

export function EventProvider({ initial, supabaseUrl, supabaseAnonKey, children }: { initial: Snapshot; supabaseUrl: string; supabaseAnonKey: string; children: React.ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const slug = initial.event.slug;
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const left = await flushQueue(slug);
      setPending(left);
      const next = await api<Snapshot>(`/api/e/${slug}/state`);
      setSnap(next);
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = `/e/${slug}/login`;
        return;
      }
      setOffline(!(err instanceof ApiError));
      setPending(queuedCount(slug));
    } finally {
      inflight.current = false;
    }
  }, [slug]);

  const patch = useCallback((fn: (s: Snapshot) => Snapshot) => setSnap((s) => fn(s)), []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onOnline = () => void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Instant updates through Supabase Realtime Broadcast, when configured.
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const channel = client
      .channel(`ypl-event-${slug}`)
      .on("broadcast", { event: "changed" }, () => void refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [slug, supabaseUrl, supabaseAnonKey, refresh]);

  return <EventCtx.Provider value={{ snap, refresh, patch, offline, pending }}>{children}</EventCtx.Provider>;
}
