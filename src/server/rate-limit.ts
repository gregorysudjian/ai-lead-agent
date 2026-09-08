import "server-only";

/**
 * A small fixed-window rate limiter.
 *
 * WHAT THIS IS FOR. Two different risks, one mechanism:
 *
 *   1. Outbound. `/api/search` and `/api/discovery` reach the public Overpass
 *      instance, which CLAUDE.md is explicit is shared community
 *      infrastructure and not our capacity. Research reaches a real business's
 *      own web server. A UI bug that retries in a loop should stop at our
 *      boundary, not at theirs.
 *   2. Spend. Analysis, demo generation and the Google website lookup are all
 *      billable per call. A limit is the difference between a mistake that
 *      costs cents and one that costs a lot.
 *
 * WHAT THIS IS NOT. The counters live in one process's memory. On Vercel that
 * means per-instance and reset on every cold start, so this is a governor on
 * accidents, not a defence against a determined distributed attacker. It is
 * the right amount of machinery for a single-operator tool behind a login;
 * a shared store (Redis, Postgres) is what this would need to become if the
 * app ever had real users. The same honesty applies here as to the JSON lead
 * repository: it is deliberately not production-grade, and saying so is part
 * of the design.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window. Zero once the limit is reached. */
  remaining: number;
  /** Whole seconds until the window resets. Always at least 1 when blocked. */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  /** Epoch milliseconds at which this window ends. */
  resetAt: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * The limits, in one place so they can be read as a policy rather than hunted
 * for across ten route handlers.
 */
export const RATE_LIMITS = {
  /** Overpass. Deliberate searches by one human, not a crawl. */
  search: { limit: 10, windowMs: 5 * MINUTE },
  /** Overpass plus, when enabled, a billable Google Text Search per run. */
  discovery: { limit: 10, windowMs: 5 * MINUTE },
  /** One lead's own website, plus an optional paid lookup. */
  research: { limit: 20, windowMs: 5 * MINUTE },
  /** A batch touches many third-party sites in one request. Kept scarce. */
  researchBatch: { limit: 3, windowMs: 15 * MINUTE },
  /** Billable Claude request. */
  analysis: { limit: 20, windowMs: 5 * MINUTE },
  /** Billable Claude request. */
  demo: { limit: 20, windowMs: 5 * MINUTE },
  /**
   * Password attempts. The only rule here that guards an unauthenticated
   * surface, and the only one whose purpose is slowing a guesser rather than
   * protecting a third party.
   */
  signIn: { limit: 8, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const windows = new Map<string, Window>();

/**
 * Drop expired windows so the map cannot grow without bound.
 *
 * Called on each check rather than on a timer: a timer would keep a handle
 * alive in a serverless function for no reason, and the map is small enough
 * that sweeping it is cheaper than tracking when to sweep it.
 */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Count one request against `name` for `identity`.
 *
 * `identity` separates callers -- a signed-in operator, or a client address on
 * the login route. `now` is a parameter so the windows are testable without
 * faking the clock.
 */
export function checkRateLimit(
  name: RateLimitName,
  identity: string,
  now: number = Date.now(),
): RateLimitResult {
  const rule: RateLimitRule = RATE_LIMITS[name];
  sweep(now);

  const key = `${name}:${identity}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      // Round up: reporting 0 seconds would invite an immediate retry that is
      // still inside the window.
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / SECOND)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Forget every window. For tests, so one does not leak into the next. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Identify the caller of an unauthenticated request.
 *
 * Only used for the sign-in limit. `x-forwarded-for` is client-settable in
 * general; behind Vercel's proxy the left-most entry is the real client, and
 * an operator running this locally has no proxy at all. A spoofed value can
 * therefore dodge this limit -- which is why the value of the sign-in rule is
 * "slows down a script", not "stops an attacker". The password itself is the
 * control that matters.
 */
export function clientIdentity(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

/**
 * Enforce a limit in a Route Handler. Returns a 429 to return, or `null`.
 *
 *   const limited = enforceRateLimit("search", session.sub);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  name: RateLimitName,
  identity: string,
): Response | null {
  const result = checkRateLimit(name, identity);
  if (result.allowed) return null;

  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
