/**
 * A share: permission to view one demo site without a session.
 *
 * ── WHY THIS IS ITS OWN OBJECT ────────────────────────────────────────────
 *
 * `DemoSite` gains no field for this. A demo is a generated artefact; a share
 * is a decision to show it to someone, and the two have different lifetimes --
 * one demo can be shared, revoked, and shared again, and the record of each
 * act has to outlive the act. Same reasoning that keeps `Analysis` off `Lead`.
 *
 * ── WHY IT EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * `/demos/[id]` used to claim in a comment that it was private and was not.
 * Putting it behind the session fixed the lie and created a real problem: the
 * demo is the strongest thing in the pitch, and it could no longer be shown to
 * the business it was made for. A share is the deliberate version of what the
 * unguessable URL was pretending to be.
 *
 * ── THE RULES ─────────────────────────────────────────────────────────────
 *
 * 1. The token is random and server-generated, never derived from the demo id.
 *    An id that is hard to guess is not an access control; a secret that was
 *    issued on purpose is.
 * 2. Every share expires. There is no perpetual link, because a link that
 *    outlives the conversation it was made for is one nobody remembers to
 *    revoke.
 * 3. Revoking sets a timestamp rather than deleting the row. "What did we show
 *    them, and when" is exactly the thing a later conversation needs.
 * 4. Unknown, expired and revoked all present identically to a visitor. A
 *    distinct "this link expired" would confirm the token was once real, which
 *    is more than a stranger holding a guess is entitled to learn.
 *
 * Pure and total: no clock of its own, no I/O, never throws.
 */

/** Why a share cannot be viewed, or that it can. */
export type ShareState = "active" | "expired" | "revoked";

export interface DemoShare {
  id: string;
  /** The demo this grants access to. Never embeds it. */
  demoId: string;
  /**
   * The secret in the URL.
   *
   * Opaque, high-entropy and application-generated. It is deliberately not the
   * demo id, not derived from it, and not reused across shares of the same
   * demo -- revoking one link must not silently revoke another.
   */
  token: string;
  createdAt: string;
  /** ISO-8601. Always set; see rule 2. */
  expiresAt: string;
  /** ISO-8601 once revoked, null while live. */
  revokedAt: string | null;
  /**
   * The operator's own note about why this was shared.
   *
   * Free text we wrote, never shown to the recipient. "Left with the owner on
   * Tuesday" is the kind of thing that makes a follow-up conversation possible
   * three weeks later.
   */
  note: string | null;
}

/** How long a new share lasts unless the operator chooses otherwise. */
export const DEFAULT_SHARE_DAYS = 30;

/** The range the API accepts, so a share cannot be made effectively permanent. */
export const MIN_SHARE_DAYS = 1;
export const MAX_SHARE_DAYS = 90;

/**
 * Whether a share may be viewed, and if not, why.
 *
 * Revocation is checked before expiry: a link that was deliberately withdrawn
 * is revoked, whatever the calendar says. That ordering matters for the record
 * more than for the visitor, who is told nothing either way.
 */
export function shareState(share: DemoShare, now: Date = new Date()): ShareState {
  if (share.revokedAt !== null) return "revoked";

  const expiresAt = Date.parse(share.expiresAt);
  // Fails CLOSED on a value that will not parse. `Date.parse` returns NaN, and
  // `NaN <= now` is false -- so a naive comparison reads a corrupt row as "not
  // yet expired" and turns it into a link that never closes. An expiry we
  // cannot read is not an expiry we can honour.
  if (!Number.isFinite(expiresAt)) return "expired";

  // Inclusive: a share whose instant has arrived is spent, matching how the
  // session token treats its own expiry.
  if (expiresAt <= now.getTime()) return "expired";
  return "active";
}

/** True only for a share a visitor may actually use. */
export function isShareViewable(share: DemoShare, now: Date = new Date()): boolean {
  return shareState(share, now) === "active";
}

/**
 * The instant a share created now should expire.
 *
 * Clamped rather than rejected: the caller validates its input, and this stays
 * total so no path can produce a share with an absurd or missing expiry.
 */
export function shareExpiry(days: number, now: Date = new Date()): string {
  const whole = Number.isFinite(days) ? Math.floor(days) : DEFAULT_SHARE_DAYS;
  const clamped = Math.min(Math.max(whole, MIN_SHARE_DAYS), MAX_SHARE_DAYS);
  return new Date(now.getTime() + clamped * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The path a token is served at.
 *
 * Short on purpose. This is read aloud, typed from a business card, and put in
 * a text message, so every character of the prefix is one the recipient has to
 * get right.
 */
export function sharePath(token: string): string {
  return `/s/${token}`;
}
