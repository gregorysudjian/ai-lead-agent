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
  /**
   * The ids of the leads that were CREATED by this batch.
   *
   * `created` says how many; this says which. A search needs that to tell the
   * operator which results are new to them and which they have already seen --
   * without it, re-running a search shows the same sixty businesses with no
   * indication that fifty-eight of them are already in the store.
   *
   * Ids rather than indices, so it stays meaningful if `leads` is reordered.
   */
  createdIds: string[];
}

export interface LeadRepository {
  /**
   * Every lead on the operator's list: removed leads are left out. Ordering is
   * the store's own; callers must not rely on it.
   */
  list(): Promise<Lead[]>;

  /**
   * Look up one lead by OUR internal id, removed or not -- its page, research
   * and demos stay reachable. Returns null when absent.
   */
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

  /**
   * Take a lead off the list, keeping it and everything made for it.
   *
   * Never a delete: every table of research, analyses, demos and outreach
   * cascades from leads, so deleting one would erase what was prepared for a
   * real business. Returns the lead as stored, or null for an unknown id.
   */
  markRemoved(id: string, reason: string): Promise<Lead | null>;

  /** Put a removed lead back on the list. Returns null for an unknown id. */
  restore(id: string): Promise<Lead | null>;
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
