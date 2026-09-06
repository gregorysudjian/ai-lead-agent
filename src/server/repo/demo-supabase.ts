import "server-only";

import { randomUUID } from "node:crypto";

import type { DemoSite, DemoSiteDraft } from "@/lib/demo-site";

import type { DemoSiteTableGateway } from "./demo-gateway";
import { assertValidDemoDraft, demoSiteToRow, rowToDemoSite } from "./demo-mapping";
import { SupabaseDemoSiteTableGateway } from "./demo-table";
import { DemoSiteRepositoryError, type DemoSiteRepository } from "./demo-types";

/**
 * Demo-site persistence, backed by whichever gateway is supplied.
 *
 * Validates the assembled draft BEFORE writing. A malformed spec is rejected
 * rather than stored: a bad row would fail validation on every later read, and
 * a store full of unrenderable demos is worse than a failed generation.
 */
export function createDemoSiteRepository(
  gateway: DemoSiteTableGateway,
  options: { now?: () => Date } = {},
): DemoSiteRepository {
  const now = options.now ?? (() => new Date());

  return {
    async create(leadId: string, analysisId: string, draft: DemoSiteDraft): Promise<DemoSite> {
      const validated = assertValidDemoDraft(draft);
      const timestamp = now().toISOString();

      const demo: DemoSite = {
        id: randomUUID(),
        leadId,
        analysisId,
        status: "generated",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...validated,
      };

      try {
        await gateway.insertRow(demoSiteToRow(demo));
      } catch (error) {
        throw new DemoSiteRepositoryError("Could not save the demo site.", { cause: error });
      }
      return demo;
    },

    async findById(id: string): Promise<DemoSite | null> {
      try {
        const row = await gateway.findRowById(id);
        return row ? rowToDemoSite(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not read the demo site.");
      }
    },

    async listForLead(leadId: string): Promise<DemoSite[]> {
      try {
        return (await gateway.listRowsForLead(leadId)).map(rowToDemoSite);
      } catch (error) {
        throw asRepositoryError(error, "Could not read demo sites for this lead.");
      }
    },

    async listForAnalysis(analysisId: string): Promise<DemoSite[]> {
      try {
        return (await gateway.listRowsForAnalysis(analysisId)).map(rowToDemoSite);
      } catch (error) {
        throw asRepositoryError(error, "Could not read demo sites for this analysis.");
      }
    },

    async latestForLead(leadId: string): Promise<DemoSite | null> {
      // The gateway returns newest first, so the head is the latest.
      const [latest] = await this.listForLead(leadId);
      return latest ?? null;
    },

    async listRecent(limit: number): Promise<DemoSite[]> {
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new DemoSiteRepositoryError("listRecent requires a positive integer limit.");
      }
      try {
        return (await gateway.listRecentRows(limit)).map(rowToDemoSite);
      } catch (error) {
        throw asRepositoryError(error, "Could not read demo sites.");
      }
    },
  };
}

function asRepositoryError(error: unknown, message: string): DemoSiteRepositoryError {
  if (error instanceof DemoSiteRepositoryError) return error;
  return new DemoSiteRepositoryError(message, { cause: error });
}

/** The wired-up production instance. */
export function supabaseDemoSiteRepository(): DemoSiteRepository {
  return createDemoSiteRepository(new SupabaseDemoSiteTableGateway());
}
