import "server-only";

import type { BusinessSearchQuery } from "@/lib/types";
import { equalsNormalized, looselyMatches } from "@/lib/normalize";
import { BUSINESS_FIXTURES } from "./fixtures/businesses";
import type { PlacesProvider, ProviderSearchResult } from "./types";

/**
 * Fixture-backed implementation of PlacesProvider.
 *
 * Makes NO network calls of any kind -- there is deliberately no fetch, no HTTP
 * client and no external import in this module. It exists so the entire
 * pipeline (validation, search, and later storage, scoring and the dashboard)
 * can be built and tested before any paid API is connected.
 *
 * Matching rules:
 *   - city     : equality after normalization, so "montreal" and "Montreal"
 *                match but "Montreal" does not swallow "Montreal West".
 *   - category : loose containment after normalization, which handles
 *                singular/plural ("hair salon" vs "hair salons") without a
 *                stemming library.
 * Both are accent-insensitive, so "Montreal" finds "Montreal" and "Montreal".
 */
class MockPlacesProvider implements PlacesProvider {
  readonly name = "mock";

  async search(query: BusinessSearchQuery): Promise<ProviderSearchResult> {
    const fetchedAt = new Date().toISOString();

    const businesses = BUSINESS_FIXTURES.filter(
      (business) =>
        equalsNormalized(business.city, query.city) &&
        looselyMatches(business.category, query.category),
    ).map((business) => ({ ...business, fetchedAt }));

    // The fixture set is finite and fully searched, so a result is never capped.
    return { businesses, meta: { truncated: false, limit: null } };
  }
}

export const mockPlacesProvider: PlacesProvider = new MockPlacesProvider();
