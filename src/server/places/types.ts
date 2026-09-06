/**
 * The business-discovery contract.
 *
 * Everything else in the application depends on THIS interface, never on a
 * concrete provider. Phase 1 ships one implementation (mock); Phase 5 adds
 * GooglePlacesProvider behind the same shape and nothing upstream changes.
 *
 * No server-only import here on purpose: this file declares types only and
 * emits no runtime code. The modules that actually load providers or touch
 * secrets carry the guard instead.
 */
import type { BusinessSearchQuery, DiscoveredBusiness } from "@/lib/types";

export interface PlacesProvider {
  /** Identifies the implementation in logs and responses. */
  readonly name: string;

  /**
   * Find businesses matching a category and city.
   *
   * Returns an empty array when nothing matches -- an unknown city is a normal
   * outcome, not an error. Reserve exceptions for genuine failures (a network
   * fault, a bad API key), which callers must not leak to the client.
   *
   * Async even though the mock resolves immediately: real providers are network
   * calls, and baking that into the contract now means the call sites written in
   * Phase 1 keep working unchanged in Phase 5.
   *
   * Returns the businesses AND metadata about the search, so a capped result set
   * can be reported honestly instead of looking like a complete one.
   */
  search(query: BusinessSearchQuery): Promise<ProviderSearchResult>;
}

/**
 * The caller asked for something we do not support (unknown city or category).
 *
 * A 400-class condition: the request is the problem, not the provider. The
 * message is written to be safe to show a client -- it names only our own
 * supported values, never upstream detail.
 */
export class ProviderValidationError extends Error {
  readonly supported?: { cities?: string[]; categories?: string[] };

  constructor(message: string, supported?: { cities?: string[]; categories?: string[] }) {
    super(message);
    this.name = "ProviderValidationError";
    this.supported = supported;
  }
}

/**
 * The upstream provider could not be reached or failed.
 *
 * A 502/503-class condition: our request was fine, the dependency was not. The
 * `message` is for server logs only and may contain upstream status detail; the
 * route substitutes a generic message for the client.
 */
export class ProviderUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * What a provider reports about the search itself, as opposed to the businesses.
 *
 * Request-level metadata: it describes one search, not any lead, and is never
 * persisted. A stored lead would have no meaningful "truncated" value.
 */
export interface ProviderSearchMeta {
  /**
   * True when the upstream query reached its cap, so more matching businesses
   * may exist. Deliberately conservative: it reflects whether the PROVIDER
   * query hit its limit, so it can remain true even if some returned records
   * were later skipped as unusable -- there may still be more upstream.
   */
  truncated: boolean;
  /** Max businesses this provider returns per search; null when uncapped. */
  limit: number | null;
}

/** A provider search: the businesses found, plus facts about the search. */
export interface ProviderSearchResult {
  businesses: DiscoveredBusiness[];
  meta: ProviderSearchMeta;
}
