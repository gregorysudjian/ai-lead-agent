import "server-only";

import type { BusinessSearchQuery, DiscoveredBusiness } from "@/lib/types";
import { getPlacesProvider } from "@/server/places";
import { getLeadRepository } from "@/server/repo";

/**
 * Discovery service: search, then persist.
 *
 * This exists so the route handler stays a thin HTTP shell -- parse, validate,
 * call, serialize. The business rule "a search always persists what it found"
 * lives here, where it can be reused by a future dashboard action or CLI without
 * going through HTTP.
 */

export interface DiscoveryResult {
  query: BusinessSearchQuery;
  results: DiscoveredBusiness[];
  saved: { created: number; updated: number };
}

export async function discoverAndSaveLeads(
  query: BusinessSearchQuery,
): Promise<DiscoveryResult> {
  const provider = getPlacesProvider();
  const results = await provider.search(query);

  // Persist before returning. If this throws, the caller reports a failure --
  // we must never claim a search succeeded when nothing was stored.
  const summary = await getLeadRepository().upsertDiscovered(results);

  return {
    query,
    results,
    saved: { created: summary.created, updated: summary.updated },
  };
}
