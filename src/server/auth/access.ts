import type { SessionPayload } from "./token";

/**
 * Who may do what: the operator, or a read-only guest.
 *
 * WHY A GUEST EXISTS. The operator wants recruiters to open the live app
 * without a password. Opening the app itself up would let anyone change the
 * lead list, run research against real businesses' websites, or mint share
 * links. So a guest gets a real, signed session -- issued by the "Continue as
 * guest" button, never by a password -- that reads every page and changes
 * nothing.
 *
 * WHERE "CHANGES NOTHING" IS ENFORCED. Every write in this app goes through a
 * route handler, and every route handler starts with `requireApiSession()`,
 * which refuses a guest outright (`apiAccess` below). Pages read the
 * repository directly and never fetch the API, so a guest loses no page by
 * this. The disabled buttons a guest sees are courtesy; this is the lock.
 * `auth-coverage.test.ts` already fails any handler that skips the guard.
 *
 * Pure and dependency-free, like `token.ts`, so the decision is unit-tested.
 */

/** The subject of a guest session. The operator's is `OPERATOR_SUBJECT`. */
export const GUEST_SUBJECT = "guest";

export function isGuest(session: Pick<SessionPayload, "sub"> | null | undefined): boolean {
  return session?.sub === GUEST_SUBJECT;
}

export type ApiAccess = "allowed" | "unauthenticated" | "read-only";

/** What an API request may do, given the session it arrived with. */
export function apiAccess(session: Pick<SessionPayload, "sub"> | null): ApiAccess {
  if (session === null) return "unauthenticated";
  return isGuest(session) ? "read-only" : "allowed";
}
