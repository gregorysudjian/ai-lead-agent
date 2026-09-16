import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signing and verification for the operator's session cookie.
 *
 * Deliberately dependency-free. A session library (jose, iron-session) buys
 * algorithm agility and JWKS handling that a single-operator tool with one
 * symmetric secret will never use, so the whole mechanism is ~40 lines of
 * `node:crypto` instead. Next 16 runs Proxy and Route Handlers on the Node
 * runtime, so `node:crypto` is available everywhere this is needed.
 *
 * NO `server-only` here on purpose. Every other module that touches
 * authentication carries it, but this one is imported by `proxy.ts`, which
 * Next does not resolve under React's `react-server` condition. This file
 * earns the exemption by reading no environment variable and holding no
 * secret: the secret is a parameter, supplied by a caller that is itself
 * server-only.
 *
 * The token is `base64url(payload).base64url(hmac)`. Note what is NOT in it:
 * no algorithm field. A JWT's `alg` header is attacker-controlled input and
 * the source of the classic `alg: none` forgery; here the algorithm is a
 * constant in this file and the token has no say in how it is verified.
 */

/** Minimum acceptable secret length. 32 bytes of base64 is ~43 characters. */
export const MIN_SESSION_SECRET_LENGTH = 32;

/** How long a freshly issued session lasts. */
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** A guest session is shorter: a visit, not a working week. */
export const GUEST_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export interface SessionPayload {
  /**
   * Format version. Bumping it invalidates every outstanding session, which
   * is the intended lever if the payload shape or the secret handling changes.
   */
  v: 1;
  /**
   * Who the session belongs to. One operator today, hence a constant -- but a
   * field rather than an assumption, so adding a second account later is a
   * data change and not a format change.
   */
  sub: string;
  /** Issued at, epoch milliseconds. */
  iat: number;
  /** Expires at, epoch milliseconds. Absolute, never relative to the reader. */
  exp: number;
}

const CURRENT_VERSION = 1;

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * Compare two signatures without leaking their difference through timing.
 *
 * A length mismatch returns false before `timingSafeEqual`, which throws on
 * unequal buffers. That is not a timing leak worth worrying about: our HMAC
 * output has a fixed length, so a different length means malformed input
 * rather than a near-miss guess.
 */
function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Build a signed token for `payload`. */
export function signSessionToken(payload: SessionPayload, secret: string): string {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${hmac(body, secret)}`;
}

/**
 * Verify a token and return its payload, or `null` for anything unusable.
 *
 * Returns `null` rather than throwing for every rejection -- forged, expired,
 * truncated, wrong secret, wrong version. A caller cannot accidentally treat a
 * failure as a success, and no distinction between failure modes is reported
 * to whoever supplied the token.
 *
 * `now` is a parameter so expiry is testable without faking the clock.
 */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;

  // Exactly one separator. "a.b.c" is not a token we ever issued.
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;

  // Signature first: never parse attacker-supplied JSON we have not authenticated.
  if (!signaturesMatch(hmac(body, secret), signature)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  if (candidate.v !== CURRENT_VERSION) return null;
  if (typeof candidate.sub !== "string" || candidate.sub.length === 0) return null;
  if (typeof candidate.iat !== "number" || !Number.isFinite(candidate.iat)) return null;
  if (typeof candidate.exp !== "number" || !Number.isFinite(candidate.exp)) return null;

  // Expiry is inclusive: a token whose instant has arrived is already spent.
  if (candidate.exp <= now) return null;

  return { v: CURRENT_VERSION, sub: candidate.sub, iat: candidate.iat, exp: candidate.exp };
}

/** Payload for a session starting now. */
export function newSessionPayload(
  subject: string,
  now: number = Date.now(),
  durationMs: number = SESSION_DURATION_MS,
): SessionPayload {
  return { v: CURRENT_VERSION, sub: subject, iat: now, exp: now + durationMs };
}
