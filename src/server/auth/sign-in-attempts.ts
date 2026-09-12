import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Failed sign-ins, counted where every server can see them.
 *
 * The in-memory limit in `rate-limit.ts` still runs first -- it is free and
 * catches a loop on one server -- but on Vercel each request can reach a
 * fresh server that has counted nothing. This counts FAILURES in Supabase
 * (`auth_attempts`), so a guesser is slowed however the requests are spread.
 *
 * ── NEVER A LOCKOUT BY ACCIDENT ───────────────────────────────────────────
 *
 * If the store is unavailable -- the migration not yet applied, Supabase
 * briefly unreachable, the local JSON setup -- sign-in carries on under the
 * in-memory limit alone and the problem is logged. A database hiccup must not
 * lock the one operator out of their own tool. The one deliberate exception is
 * the site-wide cap below: under a real attack, the operator may have to wait
 * too, and that is the right trade for a single-password tool.
 *
 * ── WHAT IS STORED ────────────────────────────────────────────────────────
 *
 * A keyed hash of the visitor's address (HMAC with the session secret), never
 * the address, and never any password.
 */

export const SIGN_IN_WINDOW_MINUTES = 15;
/** Failures from one visitor within the window before sign-in pauses for them. */
export const MAX_FAILURES_PER_VISITOR = 8;
/** Failures from everyone within the window before sign-in pauses for all. */
export const MAX_FAILURES_SITEWIDE = 40;

export interface FailureCounts {
  visitor: number;
  sitewide: number;
}

export type SignInDecision =
  | { allowed: true }
  | { allowed: false; reason: "visitor" | "sitewide"; retryAfterMinutes: number };

/** Pure: whether a sign-in attempt may be checked at all. */
export function signInDecision(counts: FailureCounts): SignInDecision {
  if (counts.visitor >= MAX_FAILURES_PER_VISITOR) {
    return { allowed: false, reason: "visitor", retryAfterMinutes: SIGN_IN_WINDOW_MINUTES };
  }
  if (counts.sitewide >= MAX_FAILURES_SITEWIDE) {
    return { allowed: false, reason: "sitewide", retryAfterMinutes: SIGN_IN_WINDOW_MINUTES };
  }
  return { allowed: true };
}

/** A stable, non-reversible identity for a network address. */
export function hashVisitor(address: string, secret: string): string {
  return createHmac("sha256", secret).update(`sign-in:${address}`).digest("hex");
}

export interface AttemptStore {
  failuresSince(identity: string, since: Date): Promise<FailureCounts>;
  recordFailure(identity: string, now: Date): Promise<void>;
  clearFailures(identity: string): Promise<void>;
}

const TABLE = "auth_attempts";

function throwIf(error: { code?: string; message?: string } | null, step: string): void {
  if (error) throw new Error(`auth_attempts ${step} failed${error.code ? ` [${error.code}]` : ""}.`);
}

/**
 * The Supabase-backed store. Counts use GET with a one-row range, not HEAD:
 * a HEAD request reports a missing table as an empty count, which would read
 * as "no failures" rather than "no table".
 */
export function supabaseAttemptStore(client: SupabaseClient): AttemptStore {
  return {
    async failuresSince(identity, since) {
      const iso = since.toISOString();
      const [visitor, sitewide] = await Promise.all([
        client.from(TABLE).select("id", { count: "exact" }).eq("identity", identity).gte("attempted_at", iso).range(0, 0),
        client.from(TABLE).select("id", { count: "exact" }).gte("attempted_at", iso).range(0, 0),
      ]);
      throwIf(visitor.error, "count");
      throwIf(sitewide.error, "count");
      return { visitor: visitor.count ?? 0, sitewide: sitewide.count ?? 0 };
    },
    async recordFailure(identity, now) {
      const { error } = await client.from(TABLE).insert({ identity, attempted_at: now.toISOString() });
      throwIf(error, "insert");
      // Keep the table small: nothing older than a day is ever needed.
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const pruned = await client.from(TABLE).delete().lt("attempted_at", cutoff);
      throwIf(pruned.error, "prune");
    },
    async clearFailures(identity) {
      const { error } = await client.from(TABLE).delete().eq("identity", identity);
      throwIf(error, "clear");
    },
  };
}

/**
 * Whether this attempt may proceed, per the shared store. `null` store (no
 * Supabase configured) or a failing one both mean "allowed": the in-memory
 * limit is still in force.
 */
export async function checkSharedSignInLimit(
  store: AttemptStore | null,
  identity: string,
  now: Date = new Date(),
): Promise<SignInDecision> {
  if (store === null) return { allowed: true };
  try {
    const since = new Date(now.getTime() - SIGN_IN_WINDOW_MINUTES * 60 * 1000);
    return signInDecision(await store.failuresSince(identity, since));
  } catch (error) {
    console.error("[signIn] shared attempt limit unavailable; using the in-memory limit only:", error);
    return { allowed: true };
  }
}

/** Record the outcome. Never throws: a sign-in must not fail because a log did. */
export async function recordSignInOutcome(
  store: AttemptStore | null,
  identity: string,
  succeeded: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (store === null) return;
  try {
    if (succeeded) await store.clearFailures(identity);
    else await store.recordFailure(identity, now);
  } catch (error) {
    console.error("[signIn] could not record the attempt:", error);
  }
}
