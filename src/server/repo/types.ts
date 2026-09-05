/**
 * Persistence contract for leads.
 *
 * The application depends on this interface, never on a storage engine. No
 * method mentions files, paths, JSON, SQL or connections -- swapping the
 * development JSON store for Supabase in a later phase means writing one new
 * implementation and changing nothing upstream.
 */
import type { DiscoveredBusiness, Lead, LeadStatus } from "@/lib/types";

/** Outcome of persisting one batch of discovered businesses. */
export interface UpsertSummary {
  /** Businesses that became new leads. */
  created: number;
  /** Businesses that matched an existing lead and refreshed it. */
  updated: number;
  /** The resulting leads, in the order the businesses were supplied. */
  leads: Lead[];
}

export interface LeadRepository {
  /** Every stored lead. Ordering is the store's own; callers must not rely on it. */
  list(): Promise<Lead[]>;

  /** Look up one lead by OUR internal id. Returns null when absent. */
  findById(id: string): Promise<Lead | null>;

  /**
   * Persist a batch of discovered businesses, creating or refreshing leads.
   *
   * Deduplication happens here, so no caller can bypass it. Each business either
   * creates a lead or refreshes the matching one; duplicates within a single
   * batch collapse together rather than producing two leads.
   */
  upsertDiscovered(businesses: readonly DiscoveredBusiness[]): Promise<UpsertSummary>;

  /**
   * Change the application-owned status of one lead.
   *
   * Returns the updated lead, or `null` when no lead has that id -- a missing
   * lead is a normal outcome the caller reports as 404, not an exception.
   *
   * Status is the only mutable field. Provider data, `id` and `createdAt` are
   * preserved; `updatedAt` changes. There is deliberately no general-purpose
   * `update(lead)` method: a narrow operation cannot be misused to overwrite
   * provider data or rewrite an id.
   */
  updateStatus(id: string, status: LeadStatus): Promise<Lead | null>;
}

/**
 * Thrown when the store cannot be read or written.
 *
 * Carries a message safe for server logs only. Route handlers catch this and
 * return something generic -- the message may contain a filesystem path.
 */
export class LeadRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LeadRepositoryError";
  }
}
