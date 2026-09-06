import "server-only";

import { randomUUID } from "node:crypto";

import type { Analysis, AnalysisDraft } from "@/lib/analysis";

import type { AnalysisTableGateway } from "./analysis-gateway";
import { analysisToRow, assertValidDraft, rowToAnalysis } from "./analysis-mapping";
import { AnalysisRepositoryError, type AnalysisRepository } from "./analysis-types";
import { SupabaseAnalysisTableGateway } from "./analysis-table";

/**
 * Analysis persistence, backed by whichever gateway is supplied.
 *
 * Validates the provider's draft BEFORE writing. A malformed analysis is
 * rejected rather than stored: a bad row would fail validation on every later
 * read, and a store full of unreadable rows is worse than a failed run.
 */
export function createAnalysisRepository(
  gateway: AnalysisTableGateway,
  options: { now?: () => Date } = {},
): AnalysisRepository {
  const now = options.now ?? (() => new Date());

  return {
    async create(leadId: string, draft: AnalysisDraft): Promise<Analysis> {
      const validated = assertValidDraft(draft);
      const timestamp = now().toISOString();

      const analysis: Analysis = {
        id: randomUUID(),
        leadId,
        status: "complete",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...validated,
      };

      try {
        await gateway.insertRow(analysisToRow(analysis));
      } catch (error) {
        throw new AnalysisRepositoryError("Could not save the analysis.", { cause: error });
      }
      return analysis;
    },

    async findById(id: string): Promise<Analysis | null> {
      try {
        const row = await gateway.findRowById(id);
        return row ? rowToAnalysis(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not read the analysis.");
      }
    },

    async listForLead(leadId: string): Promise<Analysis[]> {
      try {
        return (await gateway.listRowsForLead(leadId)).map(rowToAnalysis);
      } catch (error) {
        throw asRepositoryError(error, "Could not read analyses for this lead.");
      }
    },

    async latestForLead(leadId: string): Promise<Analysis | null> {
      // The gateway returns newest first, so the head is the latest.
      const [latest] = await this.listForLead(leadId);
      return latest ?? null;
    },
  };
}

function asRepositoryError(error: unknown, message: string): AnalysisRepositoryError {
  if (error instanceof AnalysisRepositoryError) return error;
  return new AnalysisRepositoryError(message, { cause: error });
}

/** The wired-up production instance. */
export function supabaseAnalysisRepository(): AnalysisRepository {
  return createAnalysisRepository(new SupabaseAnalysisTableGateway());
}
