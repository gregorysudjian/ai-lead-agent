/**
 * Persistence contract for lead analyses.
 *
 * Deliberately append-only: there is no update and no delete. A re-analysis
 * creates a new row, so history is preserved by construction and the Supabase
 * grant can be narrowed to SELECT + INSERT.
 */
import type { Analysis, AnalysisDraft } from "@/lib/analysis";

export interface AnalysisRepository {
  /** Persist a completed analysis for a lead and return the stored record. */
  create(leadId: string, draft: AnalysisDraft): Promise<Analysis>;

  /** One analysis by its own id, or null. */
  findById(id: string): Promise<Analysis | null>;

  /** Every analysis for a lead, newest first. */
  listForLead(leadId: string): Promise<Analysis[]>;

  /** The most recent analysis for a lead, or null when never analysed. */
  latestForLead(leadId: string): Promise<Analysis | null>;
}

/** Thrown when the analysis store cannot be read or written. */
export class AnalysisRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnalysisRepositoryError";
  }
}
