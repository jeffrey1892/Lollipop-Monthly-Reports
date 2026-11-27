"use client";
// Browser-side API helper with an offline queue: writes made while the connection drops are retried automatically.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

interface Queued {
  key: string;
  url: string;
  body: unknown;
}

const qKey = (slug: string) => `ypo-queue-${slug}`;

function readQueue(slug: string): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(qKey(slug)) || "[]") as Queued[];
  } catch {
    return [];
  }
}

function writeQueue(slug: string, q: Queued[]) {
  try {
    localStorage.setItem(qKey(slug), JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}

export function queuedCount(slug: string): number {
  return readQueue(slug).length;
}

/**
 * POST that survives a dropped connection. `key` dedupes: a later write with the same key replaces an earlier queued one.
 * Returns "queued" if it couldn't reach the server.
 */
export async function resilientPost(slug: string, key: string, url: string, body: unknown): Promise<"ok" | "queued"> {
  try {
    await api(url, body);
    return "ok";
  } catch (err) {
    if (err instanceof ApiError) throw err; // the server answered: a real error, don't retry
    const q = readQueue(slug).filter((x) => x.key !== key);
    q.push({ key, url, body });
    writeQueue(slug, q);
    return "queued";
  }
}

/** Retry everything queued. Returns the number still waiting. */
export async function flushQueue(slug: string): Promise<number> {
  const q = readQueue(slug);
  if (!q.length) return 0;
  const remaining: Queued[] = [];
  for (const item of q) {
    try {
      await api(item.url, item.body);
    } catch (err) {
      if (!(err instanceof ApiError)) remaining.push(item); // still offline; drop real server rejections
    }
  }
  writeQueue(slug, remaining);
  return remaining.length;
}
