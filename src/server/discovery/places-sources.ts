import "server-only";

import { createOpenStreetMapProvider } from "@/server/places/osm";
import { mockPlacesProvider } from "@/server/places/mock";
import type { PlacesProvider } from "@/server/places/types";
import { ProviderUnavailableError, ProviderValidationError } from "@/server/places/types";

import type { DiscoveryRequest, DiscoverySource, DiscoverySourceResult } from "./types";
import { DiscoverySourceError } from "./types";

/**
 * The two sources that already existed, behind the new interface.
 *
 * Adapters, not rewrites. `PlacesProvider` still does the work -- the Overpass
 * query, the bounded area, the in-memory cache, the ODbL provenance stamp -- and
 * this file only translates one shape into the other. That matters because the
 * OSM provider is the one the search-and-save path also uses: changing its
 * behaviour to suit discovery would change lead persistence too.
 *
 * The registry objects are already resolved by the time a source is called, so
 * the adapter hands the provider the canonical LABELS. The provider resolves
 * those back to the same registry entries, which is redundant but harmless, and
 * far better than a second code path that could drift.
 */

function toSourceError(error: unknown): DiscoverySourceError {
  if (error instanceof ProviderValidationError) {
    // Should be unreachable: the orchestrator resolves city and category
    // against the registries before dispatching. Mapped rather than rethrown so
    // a future adapter cannot turn a request problem into a crash.
    return new DiscoverySourceError(
      "This source does not support that city or category.",
      "unsupported-request",
      { cause: error },
    );
  }
  if (error instanceof ProviderUnavailableError) {
    return new DiscoverySourceError(
      "The source could not be reached.",
      "unavailable",
      { cause: error },
    );
  }
  return new DiscoverySourceError("The source failed.", "unavailable", { cause: error });
}

function adapt(
  provider: PlacesProvider,
  name: "osm" | "mock",
  persistable: boolean,
): DiscoverySource {
  return {
    name,
    persistable,

    async search(request: DiscoveryRequest): Promise<DiscoverySourceResult> {
      try {
        const result = await provider.search({
          category: request.category.label,
          city: request.city.label,
        });
        return { businesses: result.businesses, meta: result.meta };
      } catch (error) {
        throw toSourceError(error);
      }
    },
  };
}

export function createOsmDiscoverySource(provider?: PlacesProvider): DiscoverySource {
  // OpenStreetMap records ARE persisted by the established search-and-save
  // path: ODbL data we already store, with attribution rendered in the UI.
  return adapt(provider ?? createOpenStreetMapProvider(), "osm", true);
}

export function createMockDiscoverySource(provider?: PlacesProvider): DiscoverySource {
  return adapt(provider ?? mockPlacesProvider, "mock", true);
}

export const osmDiscoverySource: DiscoverySource = createOsmDiscoverySource();
export const mockDiscoverySource: DiscoverySource = createMockDiscoverySource();
