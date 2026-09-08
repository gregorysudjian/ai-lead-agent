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

/**
 * One search result, annotated with whether it was new to us.
 *
 * The annotation is the point. Searching "Hair salon in Montreal" twice returns
 * the same businesses both times -- Overpass answers in a stable order, so the
 * list is identical -- and without this the second search looks like it found
 * sixty businesses when it found none the operator had not already seen.
 */
export interface DiscoveryHit {
  business: DiscoveredBusiness;
  /** Our internal lead id, so the UI can link straight to the record. */
  leadId: string;
  /** True when this batch created the lead, rather than refreshing one. */
  isNew: boolean;
}

export interface DiscoveryResult {
  query: BusinessSearchQuery;
  results: DiscoveredBusiness[];
  /** The same results, each carrying its lead id and whether it is new. */
  hits: DiscoveryHit[];
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

  // `summary.leads` is returned in the order the businesses were supplied, so
  // index i of one corresponds to index i of the other. `createdIds` says
  // which of those leads this batch actually created.
  const created = new Set(summary.createdIds);
  const hits: DiscoveryHit[] = businesses.map((business, index) => {
    const lead = summary.leads[index];
    return {
      business,
      leadId: lead.id,
      isNew: created.has(lead.id),
    };
  });

  return {
    query,
    results: businesses,
    hits,
    saved: { created: summary.created, updated: summary.updated },
    meta,
  };
}
