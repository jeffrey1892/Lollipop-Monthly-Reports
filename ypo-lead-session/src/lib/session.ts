// Email-only sign-in: the session is a signed JWT in an httpOnly cookie. No passwords, no emailed codes.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

export const SESSION_COOKIE = "ypo_session";
const DEFAULT_SECONDS = 60 * 60 * 24 * 30; // when an event has no "signed in through" date
const MIN_SECONDS = 60 * 60 * 24; // never sign someone in for less than a day

/**
 * When a sign-in expires: the end of the event's "signed in through" date, in the event's time zone
 * (for the Jan 20 event: through January 30, 2027 ET). Falls back to 30 days, and never less than a day.
 */
export function sessionExpiry(endOfDay: Date | null, now = new Date()): Date {
  const fallback = new Date(now.getTime() + DEFAULT_SECONDS * 1000);
  if (!endOfDay) return fallback;
  const min = new Date(now.getTime() + MIN_SECONDS * 1000);
  return endOfDay > min ? endOfDay : min;
}

export interface SessionData {
  eid: string; // event id
  pid: string | null; // participant id
  email: string;
  pin: boolean; // facilitator PIN entered
}

function key() {
  if (!env.sessionSecret || env.sessionSecret.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be at least 16 characters");
    return new TextEncoder().encode("dev-only-session-secret-change-me");
  }
  return new TextEncoder().encode(env.sessionSecret);
}

export async function encodeSession(data: SessionData, expiresAt: Date): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key());
}

export async function decodeSession(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.eid !== "string" || typeof payload.email !== "string") return null;
    return {
      eid: payload.eid,
      pid: typeof payload.pid === "string" ? payload.pid : null,
      email: payload.email,
      pin: payload.pin === true,
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function writeSession(data: SessionData, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encodeSession(data, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
