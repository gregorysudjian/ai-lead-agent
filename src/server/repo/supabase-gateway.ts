/**
 * The narrow data-access seam between the Supabase repository and the database.
 *
 * Everything the repository needs, expressed as six explicit operations. The
 * repository holds the deduplication and preservation RULES; this interface
 * holds only the row access. Splitting them means the rules can be unit-tested
 * against an in-memory fake with no network, no credentials and no mocking of
 * the Supabase query builder.
 */
import type { DedupeColumns, LeadRefreshPatch, LeadRow } from "./supabase-mapping";

/**
 * A unique index rejected the write.
 *
 * This is the database enforcing deduplication, and it is expected under
 * concurrency: two requests can both find no existing row and both try to
 * insert. The repository catches it and converts the insert into a refresh.
 */
export class UniqueViolationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UniqueViolationError";
  }
}

/** The only other update this repository performs. */
export interface LeadStatusPatch {
  status: string;
  updated_at: string;
}

export interface LeadTableGateway {
  listRows(): Promise<LeadRow[]>;
  findRowById(id: string): Promise<LeadRow | null>;

  /**
   * Find the row that already represents this business, by either rule:
   * primary  = provider_source + provider_external_id
   * secondary= normalized_name + normalized_address, ONLY when the address is
   *            non-null. A null address must never match anything.
   */
  findMatchingRow(dedupe: DedupeColumns): Promise<LeadRow | null>;

  /** Insert a new row. Throws UniqueViolationError if an index rejects it. */
  insertRow(row: LeadRow): Promise<void>;

  /**
   * Apply a partial update. Returns the updated row, or null if absent.
   *
   * The patch is typed as one of the two updates this repository performs, so
   * no caller can invent an arbitrary column write -- there is no path here to
   * overwrite an id or a created_at.
   */
  updateRow(
    id: string,
    patch: LeadRefreshPatch | LeadStatusPatch,
  ): Promise<LeadRow | null>;
}
