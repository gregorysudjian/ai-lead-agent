/**
 * Shared domain types.
 *
 * These are OUR types, not any provider's response shape. A provider adapter is
 * responsible for mapping its own payload into these structures, so swapping
 * Google Places for anything else never ripples into the rest of the app.
 *
 * This module is intentionally NOT marked `server-only`: the dashboard (Phase 3)
 * will need these same types in the browser.
 */

/** Which adapter produced a record. `externalId` is only unique within a source. */
export type BusinessSource = "mock" | "osm" | "google";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** One day's opening window. Days the business is closed are simply omitted. */
export interface OpeningHoursEntry {
  day: Weekday;
  /** Local time, 24-hour "HH:MM". */
  opens: string;
  /** Local time, 24-hour "HH:MM". */
  closes: string;
}

export type OpeningHours = OpeningHoursEntry[];

/**
 * A business as returned by a discovery provider.
 *
 * Every optional field is typed `T | null` rather than `field?: T`. That is
 * deliberate: `null` must be written explicitly, so "we have no phone number for
 * this business" is a recorded fact rather than a field somebody forgot. Nothing
 * in this system may invent a value to fill a gap.
 *
 * Note the difference between `openingHours: null` (unknown -- the provider told
 * us nothing) and `openingHours: []` (known to publish no hours). Likewise
 * `reviewCount: 0` (has no reviews) versus `reviewCount: null` (unknown).
 */
export interface DiscoveredBusiness {
  /** Provider's own identifier. Stable per source, but never our primary key. */
  externalId: string;
  source: BusinessSource;
  name: string;
  /** Free-text category as the provider labels it, e.g. "hair salon". */
  category: string;
  city: string;
  address: string | null;
  phone: string | null;
  /**
   * `null` means the discovery provider did not return a website for this
   * business.
   *
   * That is NOT proof the business has no website. A provider can simply lack
   * the field, or the business may have a site the provider does not list.
   * Treat `null` as a strong lead signal, never as a confirmed fact -- only a
   * later, explicit verification step could establish that, and nothing in the
   * system does so yet.
   */
  website: string | null;
  /** Typically 0-5. `null` when unrated. */
  rating: number | null;
  reviewCount: number | null;
  openingHours: OpeningHours | null;
  /**
   * ISO-8601 timestamp of when this data was retrieved. Required by the caching
   * policy in CLAUDE.md: provider-sourced fields are a refreshable cache, and we
   * cannot honour a retention rule without knowing when we fetched.
   */
  fetchedAt: string;
}

/** What the user is looking for. */
export interface BusinessSearchQuery {
  category: string;
  city: string;
}

// ---------------------------------------------------------------------------
// Leads -- a business after it has entered OUR system
// ---------------------------------------------------------------------------

/**
 * Application-owned lead status. Deliberately minimal: this is not a CRM state
 * machine, and it should not become one without a real reason.
 */
export type LeadStatus = "new" | "reviewed";

/**
 * What a provider last told us about a business.
 *
 * Structurally identical to `DiscoveredBusiness` -- the alias exists to name the
 * role this data plays once stored: a refreshable cache, overwritten wholesale
 * on every rediscovery, never a source of truth we own.
 */
export type ProviderSnapshot = DiscoveredBusiness;

/**
 * A discovered business promoted into our own records.
 *
 * The nesting is the point. Everything we own sits at the top level; everything
 * the provider told us sits under `provider` and is disposable. That split is
 * what makes two rules mechanically enforceable rather than merely documented:
 *
 *   - Rediscovery replaces `provider` wholesale while `id`, `createdAt` and
 *     `status` are untouched by construction, not by remembering to preserve
 *     them field by field.
 *   - The retention policy in CLAUDE.md applies to exactly one subtree, so
 *     expiring cached provider data later means clearing `provider` -- our own
 *     notes, status and history survive automatically.
 *
 * A flat record would leave both rules depending on developer discipline.
 */
export interface Lead {
  /**
   * Our own stable identifier, generated once and never changed -- not derived
   * from `externalId`, because provider identifiers can be retired or replaced
   * and anything we link to a lead must outlive that.
   */
  id: string;
  status: LeadStatus;
  /** ISO-8601. Set once when the lead first entered our system. */
  createdAt: string;
  /** ISO-8601. Changes whenever the stored record is written. */
  updatedAt: string;
  /** Refreshable cache of the latest discovery result. */
  provider: ProviderSnapshot;
}
