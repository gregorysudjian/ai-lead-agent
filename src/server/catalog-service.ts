import "server-only";

import { MONTREAL_ISLAND } from "@/lib/catalog/area";
import { searchCatalog, type CatalogQuery, type CatalogSearchResult } from "@/lib/catalog/search";
import type { CatalogBusiness, IngestRun } from "@/lib/catalog/types";
import { getCatalogRepository, getLeadRepository } from "@/server/repo";

/**
 * The catalog as the application uses it: search it, and add a business from
 * it to the leads.
 *
 * ── A SHORT CACHE, AND WHY IT IS SAFE ─────────────────────────────────────
 *
 * Searching reads the whole catalog -- a few thousand rows -- and filters it in
 * memory (see `lib/catalog/search.ts` for why). Browsing is a burst of filter
 * clicks, so the rows are held for a minute rather than re-read on every one.
 *
 * The catalog changes in exactly two ways. A refresh runs in a separate
 * process, monthly; a minute of staleness after it is invisible. Adding a
 * lead happens HERE, and clears the cache before returning, so the page that
 * `router.refresh()` re-renders always shows the button it just pressed as
 * "In your leads".
 */

const CACHE_MS = 60_000;

let cached: { at: number; businesses: CatalogBusiness[] } | null = null;

async function catalogRows(): Promise<CatalogBusiness[]> {
  if (cached !== null && Date.now() - cached.at < CACHE_MS) return cached.businesses;
  const businesses = await getCatalogRepository().listAll();
  cached = { at: Date.now(), businesses };
  return businesses;
}

function invalidate(): void {
  cached = null;
}

/** The area every catalog page searches. One today. */
export const CATALOG_AREA = MONTREAL_ISLAND;

export interface CatalogPage {
  result: CatalogSearchResult;
  /** The most recent refresh that completed, for "last updated". */
  lastRefresh: IngestRun | null;
  /** A refresh currently running, or one that failed after the last success. */
  attention: IngestRun | null;
}

/**
 * One page of catalog search.
 *
 * Throws when the catalog cannot be read. The page shows that as an error,
 * never as an empty catalog -- "no businesses" and "could not load" lead to
 * opposite conclusions.
 */
export async function catalogPage(query: CatalogQuery): Promise<CatalogPage> {
  const catalog = getCatalogRepository();
  const [businesses, runs] = await Promise.all([
    catalogRows(),
    // The refresh log is context, not content: a failure to read it must not
    // take search down with it.
    catalog.recentRuns(10).catch((error: unknown) => {
      console.error("[catalog] could not read ingest runs:", error);
      return [] as IngestRun[];
    }),
  ]);

  const lastRefresh = runs.find((run) => run.state === "complete") ?? null;
  const newest = runs[0] ?? null;
  const attention = newest !== null && newest.state !== "complete" ? newest : null;

  return { result: searchCatalog(businesses, query), lastRefresh, attention };
}

export type AddToLeadsResult =
  | { status: "added"; leadId: string }
  | { status: "already"; leadId: string }
  | { status: "not-found" };

/**
 * Make a catalog business a lead.
 *
 * The lead is created through `LeadRepository.upsertDiscovered`, so the lead
 * dedupe runs exactly as it always has: a business that is somehow already a
 * lead is refreshed, not duplicated. Then the catalog row is linked to it.
 *
 * Idempotent. Pressing the button twice, or in two tabs, yields one lead.
 */
export async function addBusinessToLeads(businessId: string): Promise<AddToLeadsResult> {
  const catalog = getCatalogRepository();
  const leads = getLeadRepository();

  const business = await catalog.findById(businessId);
  if (business === null) return { status: "not-found" };

  if (business.leadId !== null) {
    const existing = await leads.findById(business.leadId);
    if (existing !== null) return { status: "already", leadId: existing.id };
  }

  // The snapshot goes in unchanged: a catalog row IS a provider snapshot plus
  // our own fields, which is why the table mirrors public.leads.
  const summary = await leads.upsertDiscovered([business.provider]);
  let lead = summary.leads[0];
  // Adding a business whose lead was once removed puts that lead back, with
  // everything made for it, rather than leaving it off the list.
  if (lead.removal) lead = (await leads.restore(lead.id)) ?? lead;

  try {
    const linked = await catalog.linkLead(business.id, lead.id);
    invalidate();
    // If another request linked a different lead first, the stored link wins.
    const leadId = linked?.leadId ?? lead.id;
    return summary.createdIds.includes(lead.id) && leadId === lead.id
      ? { status: "added", leadId }
      : { status: "already", leadId };
  } catch (error) {
    // The lead exists either way. A failed link -- most likely because that
    // lead is already linked to a different catalog row -- only means this row
    // keeps offering "Add"; pressing it again lands on the same lead.
    invalidate();
    console.error(`[catalog] lead ${lead.id} created but not linked to business ${business.id}:`, error);
    return { status: summary.createdIds.includes(lead.id) ? "added" : "already", leadId: lead.id };
  }
}

/**
 * Put a removed lead back on the list, and its catalog business back in step.
 *
 * Removal unlinked the business (so search could hide it); restoring links it
 * again when the business is still unlinked -- found by the provider identity
 * the two share. Returns false for an unknown lead.
 */
export async function restoreLead(leadId: string): Promise<boolean> {
  const leads = getLeadRepository();
  const catalog = getCatalogRepository();

  const lead = await leads.restore(leadId);
  if (lead === null) return false;

  const { source, externalId } = lead.provider;
  const business = (await catalogRows()).find(
    (row) => row.provider.source === source && row.provider.externalId === externalId,
  );
  if (business && business.leadId === null) {
    await catalog.linkLead(business.id, lead.id).catch((error: unknown) => {
      // The lead is back on the list either way; only its "In your leads"
      // mark in search is missing, and adding it again repairs that.
      console.error(`[catalog] restored lead ${lead.id} could not be relinked:`, error);
    });
  }
  invalidate();
  return true;
}
