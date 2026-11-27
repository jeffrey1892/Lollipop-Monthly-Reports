// Email-only sign-in: the session is a signed JWT in an httpOnly cookie. No passwords, no emailed codes.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

export const SESSION_COOKIE = "ypl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export async function encodeSession(data: SessionData): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
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

export async function writeSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
