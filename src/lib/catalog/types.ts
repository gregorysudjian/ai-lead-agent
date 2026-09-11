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
