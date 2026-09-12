import type { DiscoveredBusiness, ProviderSnapshot } from "../types";

/**
 * The business catalog: every business in the area we might ever want to
 * approach, kept separate from the leads we have decided to pursue.
 *
 * ── CATALOG VERSUS LEADS ──────────────────────────────────────────────────
 *
 * The catalog is refreshed automatically from open data and holds thousands
 * of businesses nobody has looked at. A lead is a business the operator chose.
 * Before this existed, searching wrote every result straight into leads, so
 * "the leads" were really "whatever the last few searches returned", and a
 * second search reported that everything was already a lead.
 *
 * The same structural rule as `Lead` applies: what we own sits at the top
 * level, what the provider told us sits under `provider` and is replaced
 * wholesale on every refresh. `location` is provider-derived too and is
 * replaced alongside it; it lives outside the snapshot only because the
 * snapshot is a shared type every provider and every lead carries, and
 * coordinates belong to the catalog alone. Keeping them out of `Lead.provider`
 * also means Google's 30-day limit on caching coordinates can never apply to
 * a lead.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * What checking a business against Google Maps concluded.
 *
 *   verified   Google has a matching place, close by, not permanently closed.
 *   not_found  Google returned no place that matches. NOT "does not exist":
 *              it is what one lookup found, said as narrowly as that.
 *   closed     Google's matching place is marked permanently closed.
 *   uncertain  Something similar came back, but not close enough in name or
 *              position to call it a match either way. Kept visible.
 */
export const GOOGLE_CHECK_VERDICTS = ["verified", "not_found", "closed", "uncertain"] as const;
export type GoogleCheckVerdict = (typeof GOOGLE_CHECK_VERDICTS)[number];

/**
 * The result of the Google Maps check, owned by us.
 *
 * The only thing kept FROM Google is `placeId`, which Google's terms allow to
 * be stored indefinitely; it makes the Maps link open the exact listing.
 * Google's name, address, coordinates and ratings are compared during the
 * check and never stored.
 */
export interface GoogleCheck {
  verdict: GoogleCheckVerdict;
  /** Google's place id for the matched place; null when nothing matched. */
  placeId: string | null;
  checkedAt: string;
}

/** A business in the catalog. */
export interface CatalogBusiness {
  /** Our identifier. Never changes, never derived from a provider id. */
  id: string;
  /**
   * The municipality the business files under for filtering -- "Montréal",
   * "Westmount". Derived by us from the provider's locality, which is why it
   * is ours rather than part of the snapshot. The snapshot's own `city` keeps
   * the more specific district when the provider named one ("Verdun").
   */
  municipality: string;
  location: Coordinates | null;
  /** When a refresh first recorded this business. Never moves. */
  firstSeenAt: string;
  /** The most recent refresh that still contained it. */
  lastSeenAt: string;
  /** Dataset release that first contained it, e.g. "2026-08-19.0". */
  firstSeenRelease: string;
  /** Dataset release that most recently contained it. */
  lastSeenRelease: string;
  /** The lead this business became, when the operator chose it. */
  leadId: string | null;
  /**
   * The latest Google Maps check, or null when it has never been checked.
   * Ours, so a refresh keeps it: a new release does not un-check a business.
   */
  googleCheck: GoogleCheck | null;
  provider: ProviderSnapshot;
}

/**
 * One line of a catalog extract, as the ingest writes it.
 *
 * Everything a refresh needs about one business and nothing it does not:
 * no raw provider payload (CLAUDE.md), no confidence score (a filter, not a
 * field), no postcode (nothing reads one yet).
 */
export interface CatalogRecord {
  business: DiscoveredBusiness;
  municipality: string;
  location: Coordinates | null;
}

/** Metadata that travels with an extract, so a load knows what it is loading. */
export interface CatalogExtractMeta {
  dataset: string;
  release: string;
  area: string;
}

export type IngestRunState = "running" | "complete" | "failed";

/** The record of one catalog refresh. */
export interface IngestRun {
  id: string;
  dataset: string;
  release: string;
  area: string;
  sourceFile: string;
  sourceSha256: string;
  records: number;
  businessesAdded: number;
  businessesRefreshed: number;
  recordsCollapsed: number;
  recordsSkipped: number;
  /** Null until the run completes. */
  businessesUnseen: number | null;
  leadsLinked: number;
  startedAt: string;
  finishedAt: string | null;
  state: IngestRunState;
  detail: string | null;
}
