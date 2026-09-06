/**
 * Persistence contract for demo sites.
 *
 * Append-only, like analyses: there is no update and no delete. Regenerating
 * produces a new row, so a demo that was shown to a prospect stays exactly as
 * it was, and the Supabase grant narrows to SELECT + INSERT.
 */
import type { DemoSite, DemoSiteDraft } from "@/lib/demo-site";

export interface DemoSiteRepository {
  /** Persist a generated demo site and return the stored record. */
  create(leadId: string, analysisId: string, draft: DemoSiteDraft): Promise<DemoSite>;

  /** One demo site by its own id, or null. */
  findById(id: string): Promise<DemoSite | null>;

  /** Every demo site for a lead, newest first. */
  listForLead(leadId: string): Promise<DemoSite[]>;

  /** Every demo site generated from one analysis, newest first. */
  listForAnalysis(analysisId: string): Promise<DemoSite[]>;

  /** The most recent demo site for a lead, or null when never generated. */
  latestForLead(leadId: string): Promise<DemoSite | null>;

  /** The most recent demo sites across all leads, newest first. */
  listRecent(limit: number): Promise<DemoSite[]>;
}

/** Thrown when the demo store cannot be read or written. */
export class DemoSiteRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DemoSiteRepositoryError";
  }
}
