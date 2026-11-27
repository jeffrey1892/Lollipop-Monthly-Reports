// Tells every open device that something changed, via Supabase Realtime Broadcast.
// The message carries no personal data; clients refetch from the API.
// If Supabase is not configured, clients fall back to polling.
import { env } from "./env";

export function channelName(slug: string) {
  return `ypo-event-${slug}`;
}

export async function broadcastChange(slug: string): Promise<void> {
  if (!env.supabaseUrl || !(env.supabaseServiceKey || env.supabaseAnonKey)) return;
  const apiKey = env.supabaseServiceKey || env.supabaseAnonKey;
  try {
    await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        messages: [{ topic: channelName(slug), event: "changed", payload: { at: Date.now() } }],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Polling covers a missed broadcast.
  }
}
