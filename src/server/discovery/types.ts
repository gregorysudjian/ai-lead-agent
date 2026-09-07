/**
 * The multi-source discovery contract.
 *
 * One interface, several implementations, and an orchestrator that knows about
 * none of them. Adding a directory or another places API later means writing an
 * adapter and registering it -- not touching the orchestrator, the API route or
 * the UI.
 *
 * Types only, so no `server-only` guard here: the modules that read credentials
 * or open sockets carry it instead.
 */
import type { SupportedCategory } from "@/lib/osm/categories";
import type { SupportedCity } from "@/lib/osm/cities";
import type { DiscoverySourceName } from "@/lib/discovery/candidates";
import type { DiscoveredBusiness } from "@/lib/types";

/**
 * One normalized discovery request.
 *
 * City and category arrive ALREADY RESOLVED against the curated registries.
 * That is the whole point of resolving centrally: a source receives registry
 * objects, never the user's text, so no adapter can turn free input into query
 * syntax -- the rule that governs Overpass applies to every source by
 * construction rather than by each adapter remembering it.
 *
 * Neighbourhoods, bounds and business-type groups belong here when they exist.
 * They are deliberately absent now: the shape is ready for them, and inventing
 * fields nothing populates would be worse than adding them later.
 */
export interface DiscoveryRequest {
  city: SupportedCity;
  category: SupportedCategory;
}

/** What one source reports about its own search, separate from the businesses. */
export interface DiscoverySourceMeta {
  /** True when this source reached its cap, so more matches may exist upstream. */
  truncated: boolean;
  /** Max businesses this source returns per search; null when uncapped. */
  limit: number | null;
}

export interface DiscoverySourceResult {
  businesses: DiscoveredBusiness[];
  meta: DiscoverySourceMeta;
}

export interface DiscoverySource {
  readonly name: DiscoverySourceName;
  /**
   * Does the established search-and-save path persist this source's records?
   *
   * OpenStreetMap: yes -- ODbL data we already store, with attribution.
   * Google: no -- its content stays in the discovery layer until a deliberate
   * verification and promotion step exists, which is not this phase.
   */
  readonly persistable: boolean;

  search(request: DiscoveryRequest): Promise<DiscoverySourceResult>;
}

// ---------------------------------------------------------------------------
// Per-source status
// ---------------------------------------------------------------------------

/**
 * Why a source did not return results.
 *
 * Coarse and enumerated so the UI can say something useful without any upstream
 * text reaching it. `message` is written by us, is safe to show, and never
 * carries a provider body, a status line, a quota figure or a key.
 */
export type DiscoveryFailureReason =
  | "not-configured"
  | "unavailable"
  | "invalid-response"
  | "unsupported-request";

export type DiscoverySourceStatus =
  | {
      source: DiscoverySourceName;
      status: "ok";
      /** Businesses this source contributed, before cross-source grouping. */
      count: number;
      truncated: boolean;
      limit: number | null;
    }
  | {
      source: DiscoverySourceName;
      status: "failed";
      reason: DiscoveryFailureReason;
      /** One plain sentence. Written here, never quoted from upstream. */
      message: string;
    };

/**
 * A source failed in a way the run can survive.
 *
 * Carries a client-safe `message` and a coarse `reason`. Anything genuinely
 * diagnostic belongs in `cause`, which is logged server-side and never
 * serialized.
 */
export class DiscoverySourceError extends Error {
  constructor(
    message: string,
    readonly reason: DiscoveryFailureReason,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DiscoverySourceError";
  }
}

/**
 * The caller asked for something we do not support.
 *
 * A 400-class condition raised BEFORE any source runs: an unknown city,
 * category or source name. The message names only our own supported values.
 */
export class DiscoveryValidationError extends Error {
  readonly supported?: { cities?: string[]; categories?: string[]; sources?: string[] };

  constructor(
    message: string,
    supported?: { cities?: string[]; categories?: string[]; sources?: string[] },
  ) {
    super(message);
    this.name = "DiscoveryValidationError";
    this.supported = supported;
  }
}

/**
 * Every configured source failed.
 *
 * Distinct from a partial failure on purpose. If one source is down the run
 * still has something to show and says which source is missing; if all of them
 * are down there is nothing to show, and reporting that as an empty but
 * successful search would be a lie about the city having no barbers in it.
 */
export class DiscoveryFailedError extends Error {
  constructor(
    message: string,
    readonly statuses: readonly DiscoverySourceStatus[],
  ) {
    super(message);
    this.name = "DiscoveryFailedError";
  }
}
