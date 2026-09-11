/**
 * Persistence contract for the business catalog and its refresh log.
 *
 * ── DEDUPE LIVES BEHIND THIS INTERFACE ────────────────────────────────────
 *
 * Exactly as with `LeadRepository.upsertDiscovered`: `refresh` is the only way
 * businesses enter the catalog, and it runs `planCatalogUpsert` itself, so no
 * caller can write a business beside the rules rather than through them.
 *
 * ── NARROW WRITES ─────────────────────────────────────────────────────────
 *
 * There is no general `update(business)`. A refresh replaces provider data and
 * preserves ours by construction; `linkLead` sets a link that is not already
 * set, and nothing can repoint one. There is no delete at all: the catalog
 * keeps every business it has recorded, and a lead removed elsewhere clears
 * its link through the foreign key rather than through this interface.
 */
import type { CatalogConflict } from "@/lib/catalog/plan-upsert";
import type { CatalogBusiness, CatalogRecord, IngestRun, IngestRunState } from "@/lib/catalog/types";

export interface CatalogRefreshSummary {
  added: number;
  refreshed: number;
  collapsed: number;
  conflicts: CatalogConflict[];
  /** Businesses already in the catalog that this release did not contain. */
  unseen: number;
}

export interface OpenRunInput {
  dataset: string;
  release: string;
  area: string;
  sourceFile: string;
  sourceSha256: string;
  records: number;
}

export interface IngestRunProgress {
  businessesAdded?: number;
  businessesRefreshed?: number;
  recordsCollapsed?: number;
  recordsSkipped?: number;
  businessesUnseen?: number;
  leadsLinked?: number;
  finishedAt?: string;
  state?: IngestRunState;
  detail?: string;
}

export interface CatalogRepository {
  /** Every business, including those the latest release no longer lists. */
  listAll(): Promise<CatalogBusiness[]>;

  findById(id: string): Promise<CatalogBusiness | null>;

  /**
   * Bring the catalog up to date with one extract.
   *
   * Refuses a release older than the newest one already loaded: replaying an
   * old extract would move "last seen" backwards and mark genuinely current
   * businesses as no longer listed.
   */
  refresh(records: readonly CatalogRecord[], release: string): Promise<CatalogRefreshSummary>;

  /**
   * Record that a business became a lead.
   *
   * Sets the link only when none is set. Returns the business as stored
   * afterwards -- which may carry a DIFFERENT lead if another request linked
   * it first -- or null when no business has that id.
   */
  linkLead(businessId: string, leadId: string): Promise<CatalogBusiness | null>;

  openRun(input: OpenRunInput): Promise<IngestRun>;
  updateRun(id: string, progress: IngestRunProgress): Promise<void>;
  /** Most recent first. */
  recentRuns(limit: number): Promise<IngestRun[]>;
}

/** Thrown when the catalog store cannot be read or written. */
export class CatalogRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CatalogRepositoryError";
  }
}
