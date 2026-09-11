import "server-only";

import { randomUUID } from "node:crypto";

import { planCatalogUpsert } from "@/lib/catalog/plan-upsert";
import type { CatalogBusiness, CatalogRecord, IngestRun } from "@/lib/catalog/types";

import type { CatalogTableGateway } from "./catalog-gateway";
import {
  catalogBusinessToRow,
  ingestRunToRow,
  rowToCatalogBusiness,
  rowToIngestRun,
  type IngestRunRow,
} from "./catalog-mapping";
import { SupabaseCatalogTableGateway } from "./catalog-table";
import {
  CatalogRepositoryError,
  type CatalogRefreshSummary,
  type CatalogRepository,
  type IngestRunProgress,
  type OpenRunInput,
} from "./catalog-types";

/**
 * Catalog persistence, backed by whichever gateway is supplied.
 *
 * The rules live here, so the Supabase and in-memory backings behave
 * identically: dedupe runs inside `refresh`, links are set once, and an older
 * release is refused.
 */
export function createCatalogRepository(
  gateway: CatalogTableGateway,
  options: { now?: () => Date; newId?: () => string } = {},
): CatalogRepository {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? randomUUID;

  async function readAll(): Promise<CatalogBusiness[]> {
    return (await gateway.listRows()).map(rowToCatalogBusiness);
  }

  return {
    async listAll(): Promise<CatalogBusiness[]> {
      try {
        return await readAll();
      } catch (error) {
        throw new CatalogRepositoryError("Could not read the business catalog.", { cause: error });
      }
    },

    async findById(id: string): Promise<CatalogBusiness | null> {
      try {
        const row = await gateway.findRowById(id);
        return row === null ? null : rowToCatalogBusiness(row);
      } catch (error) {
        throw new CatalogRepositoryError("Could not read the business.", { cause: error });
      }
    },

    async refresh(records: readonly CatalogRecord[], release: string): Promise<CatalogRefreshSummary> {
      let existing: CatalogBusiness[];
      try {
        existing = await readAll();
      } catch (error) {
        throw new CatalogRepositoryError("Could not read the catalog before refreshing.", {
          cause: error,
        });
      }

      // Release names are ISO dates and order as text.
      const newest = existing.reduce<string | null>(
        (max, business) => (max === null || business.lastSeenRelease > max ? business.lastSeenRelease : max),
        null,
      );
      if (newest !== null && release < newest) {
        throw new CatalogRepositoryError(
          `Refusing to load release ${release}: the catalog already holds ${newest}. ` +
            "Loading an older release would mark current businesses as no longer listed.",
        );
      }

      const plan = planCatalogUpsert({
        existing,
        incoming: records,
        release,
        now: now().toISOString(),
        newId,
      });

      try {
        await gateway.upsertRows(plan.rows.map(catalogBusinessToRow));
      } catch (error) {
        // Not atomic across chunks, deliberately stated: a failure part-way
        // leaves some rows refreshed. Refreshing is idempotent, so the answer
        // is to run it again, and the ingest run records that it failed.
        throw new CatalogRepositoryError("Could not write the catalog refresh.", { cause: error });
      }

      const written = new Set(plan.rows.map((row) => row.id));
      return {
        added: plan.added,
        refreshed: plan.refreshed,
        collapsed: plan.collapsed,
        conflicts: plan.conflicts,
        unseen: existing.filter((business) => !written.has(business.id)).length,
      };
    },

    async linkLead(businessId: string, leadId: string): Promise<CatalogBusiness | null> {
      try {
        await gateway.setLeadIfUnlinked(businessId, leadId);
        // Re-read rather than assume: the write only happens while unlinked,
        // so what is stored is the authority on which lead actually won.
        const row = await gateway.findRowById(businessId);
        return row === null ? null : rowToCatalogBusiness(row);
      } catch (error) {
        throw new CatalogRepositoryError("Could not link the business to its lead.", {
          cause: error,
        });
      }
    },

    async openRun(input: OpenRunInput): Promise<IngestRun> {
      const run: IngestRun = {
        id: newId(),
        ...input,
        businessesAdded: 0,
        businessesRefreshed: 0,
        recordsCollapsed: 0,
        recordsSkipped: 0,
        businessesUnseen: null,
        leadsLinked: 0,
        startedAt: now().toISOString(),
        finishedAt: null,
        state: "running",
        detail: null,
      };
      try {
        await gateway.insertRun(ingestRunToRow(run));
      } catch (error) {
        throw new CatalogRepositoryError("Could not open an ingest run.", { cause: error });
      }
      return run;
    },

    async updateRun(id: string, progress: IngestRunProgress): Promise<void> {
      const patch: Partial<IngestRunRow> = {};
      if (progress.businessesAdded !== undefined) patch.businesses_added = progress.businessesAdded;
      if (progress.businessesRefreshed !== undefined) {
        patch.businesses_refreshed = progress.businessesRefreshed;
      }
      if (progress.recordsCollapsed !== undefined) patch.records_collapsed = progress.recordsCollapsed;
      if (progress.recordsSkipped !== undefined) patch.records_skipped = progress.recordsSkipped;
      if (progress.businessesUnseen !== undefined) patch.businesses_unseen = progress.businessesUnseen;
      if (progress.leadsLinked !== undefined) patch.leads_linked = progress.leadsLinked;
      if (progress.finishedAt !== undefined) patch.finished_at = progress.finishedAt;
      if (progress.state !== undefined) patch.state = progress.state;
      if (progress.detail !== undefined) patch.detail = progress.detail;

      try {
        await gateway.updateRun(id, patch);
      } catch (error) {
        throw new CatalogRepositoryError("Could not update the ingest run.", { cause: error });
      }
    },

    async recentRuns(limit: number): Promise<IngestRun[]> {
      try {
        return (await gateway.listRuns(limit)).map(rowToIngestRun);
      } catch (error) {
        throw new CatalogRepositoryError("Could not read ingest runs.", { cause: error });
      }
    },
  };
}

export function supabaseCatalogRepository(): CatalogRepository {
  return createCatalogRepository(new SupabaseCatalogTableGateway());
}
