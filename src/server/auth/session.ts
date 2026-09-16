import "server-only";

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

import { authPassword, sessionSecret } from "@/server/env";

import { GUEST_SUBJECT } from "./access";
import {
  GUEST_SESSION_DURATION_MS,
  newSessionPayload,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./token";

/**
 * Creating, reading and destroying the operator's session cookie.
 *
 * Stateless: the cookie carries the whole (signed) session, so there is no
 * session table to keep in sync with a JSON store that CLAUDE.md already says
 * is not production persistence. The cost is that logout cannot revoke a
 * cookie that has already been issued -- rotating SESSION_SECRET is the lever
 * that invalidates every outstanding session at once.
 */

/** The only account this app has. See `authPassword()` for why there is one. */
export const OPERATOR_SUBJECT = "operator";

export const SESSION_COOKIE = "lf_session";

/**
 * Is the operator's password correct?
 *
 * Both sides are hashed before comparison for two reasons: `timingSafeEqual`
 * throws on buffers of unequal length, and comparing raw values would let the
 * length of the configured password leak through that difference. Hashing
 * first makes every comparison fixed-width and constant-time.
 *
 * This is not password STORAGE -- there is no database of users and nothing to
 * breach here. The secret lives in the environment, so scrypt/bcrypt would be
 * protecting a value an attacker with the hash already has.
 */
export function passwordMatches(candidate: string): boolean {
  const expected = createHash("sha256").update(authPassword(), "utf8").digest();
  const supplied = createHash("sha256").update(candidate, "utf8").digest();
  return timingSafeEqual(expected, supplied);
}

/**
 * Issue a session cookie: the operator's by default, or a read-only guest's.
 * See `access.ts` for what a guest may do.
 */
export async function createSession(subject: string = OPERATOR_SUBJECT): Promise<void> {
  const payload =
    subject === GUEST_SUBJECT
      ? newSessionPayload(subject, Date.now(), GUEST_SESSION_DURATION_MS)
      : newSessionPayload(subject);
  const token = signSessionToken(payload, sessionSecret());
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    // The browser must never hand this to script; it is not a UI hint.
    httpOnly: true,
    // Https only in production. Local development is http, and a `secure`
    // cookie there is silently dropped -- which looks exactly like a broken
    // login rather than a misconfiguration.
    secure: process.env.NODE_ENV === "production",
    // "lax" still sends the cookie on top-level navigation, so a bookmarked
    // deep link works, while cross-site POSTs arrive without it.
    sameSite: "lax",
    expires: new Date(payload.exp),
    path: "/",
  });
}

/** Remove the session cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * The current session, or `null`.
 *
 * Reads and verifies; never redirects and never throws for an absent or bad
 * cookie. Callers decide what "no session" means for them -- a page redirects,
 * a route handler answers 401.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, sessionSecret());
}
