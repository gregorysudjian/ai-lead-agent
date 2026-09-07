import "server-only";

import type { BusinessSearchQuery, DiscoveredBusiness } from "@/lib/types";
import { getPlacesProvider } from "@/server/places";
import type { ProviderSearchMeta } from "@/server/places/types";
import { getLeadRepository } from "@/server/repo";

/**
 * Lead discovery: search ONE provider, then persist what it found.
 *
 * This exists so the route handler stays a thin HTTP shell -- parse, validate,
 * call, serialize. The business rule "a search always persists what it found"
 * lives here, where it can be reused by a future dashboard action or CLI without
 * going through HTTP.
 *
 * NOT the multi-source discovery layer. That is `server/discovery/`, which asks
 * several sources, groups their answers into transient candidates and writes
 * nothing. This module is the established persistence path: one configured
 * provider, straight into the lead store, with `LeadRepository` owning dedupe.
 * The two are deliberately separate -- previewing what is out there and
 * committing it to our records are different acts, and only one of them should
 * be able to change the database.
 */

export interface DiscoveryResult {
  query: BusinessSearchQuery;
  results: DiscoveredBusiness[];
  saved: { created: number; updated: number };
  /**
   * Facts about the search itself, passed straight through from the provider.
   * Request-level only -- never written into a Lead.
   */
  meta: ProviderSearchMeta;
}

export async function discoverAndSaveLeads(
  query: BusinessSearchQuery,
): Promise<DiscoveryResult> {
  const provider = getPlacesProvider();
  const { businesses, meta } = await provider.search(query);

  // Persist before returning. If this throws, the caller reports a failure --
  // we must never claim a search succeeded when nothing was stored.
  const summary = await getLeadRepository().upsertDiscovered(businesses);

  return {
    query,
    results: businesses,
    saved: { created: summary.created, updated: summary.updated },
    meta,
  };
}
