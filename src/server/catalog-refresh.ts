import "server-only";

import { linkLeadsToCatalog } from "@/lib/catalog/link-leads";
import type { CatalogConflict } from "@/lib/catalog/plan-upsert";
import type { CatalogExtractMeta, CatalogRecord } from "@/lib/catalog/types";

import type { CatalogRepository, LeadRepository } from "@/server/repo";

/**
 * Bring the catalog up to date with one extract, and record that we did.
 *
 * The one path by which businesses enter the catalog, whether a person runs
 * the load by hand or the scheduled refresh does:
 *
 *   open a run -> refresh (dedupe inside the repository) -> link existing
 *   leads to the businesses they are -> close the run
 *
 * Every step's outcome lands on the run row, including failure. A refresh that
 * dies part-way leaves its run marked failed with the count it reached, and
 * running it again is safe: the same extract refreshes rather than duplicates.
 *
 * Takes parsed records rather than a path. Reading the file is the caller's
 * business, which keeps this testable and keeps `fs` out of a module a route
 * handler might one day import.
 */

export interface CatalogExtract {
  meta: CatalogExtractMeta;
  records: CatalogRecord[];
  sourceFile: string;
  sha256: string;
}

export interface CatalogRefreshOutcome {
  runId: string;
  added: number;
  refreshed: number;
  collapsed: number;
  conflicts: CatalogConflict[];
  unseen: number;
  leadsLinked: number;
}

export async function refreshCatalog(
  extract: CatalogExtract,
  deps: { catalog: CatalogRepository; leads: LeadRepository },
): Promise<CatalogRefreshOutcome> {
  const { catalog, leads } = deps;

  const run = await catalog.openRun({
    dataset: extract.meta.dataset,
    release: extract.meta.release,
    area: extract.meta.area,
    sourceFile: extract.sourceFile,
    sourceSha256: extract.sha256,
    records: extract.records.length,
  });

  const fail = async (step: string, error: unknown): Promise<never> => {
    // A short, operator-facing summary on the row. The detail -- which can
    // carry driver messages -- goes to the server log only.
    console.error(`[catalog refresh ${run.id}] ${step} failed:`, error);
    await catalog
      .updateRun(run.id, { state: "failed", finishedAt: new Date().toISOString(), detail: `${step} failed` })
      .catch((updateError: unknown) => console.error("[catalog refresh] could not mark the run failed:", updateError));
    throw error;
  };

  const summary = await catalog.refresh(extract.records, extract.meta.release).catch((error: unknown) =>
    fail("refresh", error),
  );

  await catalog.updateRun(run.id, {
    businessesAdded: summary.added,
    businessesRefreshed: summary.refreshed,
    recordsCollapsed: summary.collapsed,
    recordsSkipped: summary.conflicts.length,
  });

  // Leads that predate the catalog, connected to the businesses they are, so
  // search says "In your leads" instead of offering to add them again.
  let leadsLinked = 0;
  try {
    const links = linkLeadsToCatalog(await catalog.listAll(), await leads.list());
    for (const [businessId, leadId] of links) {
      const linked = await catalog.linkLead(businessId, leadId);
      if (linked?.leadId === leadId) leadsLinked += 1;
    }
  } catch (error) {
    await fail("linking existing leads", error);
  }

  await catalog.updateRun(run.id, {
    businessesUnseen: summary.unseen,
    leadsLinked,
    state: "complete",
    finishedAt: new Date().toISOString(),
  });

  return {
    runId: run.id,
    added: summary.added,
    refreshed: summary.refreshed,
    collapsed: summary.collapsed,
    conflicts: summary.conflicts,
    unseen: summary.unseen,
    leadsLinked,
  };
}
