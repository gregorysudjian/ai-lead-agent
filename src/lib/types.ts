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
export type BusinessSource = "mock" | "google";

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
