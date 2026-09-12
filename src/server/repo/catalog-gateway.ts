import type { BusinessRow, IngestRunRow } from "./catalog-mapping";

export type GoogleCheckColumns = Pick<BusinessRow, "google_place_id" | "google_check" | "google_checked_at">;

/**
 * The narrow data-access seam for the catalog.
 *
 * Same split as every other store: the repository holds the rules, the gateway
 * holds row access. That is what lets the repository be tested against the
 * in-memory fake below with no network and no credentials.
 */
export interface CatalogTableGateway {
  /** Every business row. Implementations page internally; callers get all. */
  listRows(): Promise<BusinessRow[]>;
  findRowById(id: string): Promise<BusinessRow | null>;
  /** Insert-or-replace each row by id, in bulk. Every column is written. */
  upsertRows(rows: readonly BusinessRow[]): Promise<void>;
  /**
   * Set `lead_id` on one business, only while it is still null.
   *
   * The only mutation of an existing row outside a refresh. Expressed as its
   * own operation so "a link is set once and never repointed" is a property of
   * the query, not of a read-then-write the database cannot see.
   */
  setLeadIfUnlinked(id: string, leadId: string): Promise<void>;
  /** Set `lead_id` to null on whichever row links to this lead. */
  clearLead(leadId: string): Promise<void>;
  /** Write the three Google check columns of one row, and nothing else. */
  setGoogleCheck(id: string, patch: GoogleCheckColumns): Promise<void>;

  insertRun(row: IngestRunRow): Promise<void>;
  updateRun(id: string, patch: Partial<IngestRunRow>): Promise<void>;
  /** Most recent first. */
  listRuns(limit: number): Promise<IngestRunRow[]>;
}

/**
 * In-memory catalog, for local development and tests.
 *
 * Explicitly not durable -- it dies with the process, like the other local
 * gateways. In JSON mode the catalog therefore starts empty on every restart;
 * loading it is a Supabase feature, and CLAUDE.md is clear that the JSON store
 * is not production persistence.
 */
export class InMemoryCatalogTableGateway implements CatalogTableGateway {
  private rows = new Map<string, BusinessRow>();
  private runs: IngestRunRow[] = [];

  async listRows(): Promise<BusinessRow[]> {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  async findRowById(id: string): Promise<BusinessRow | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async upsertRows(rows: readonly BusinessRow[]): Promise<void> {
    // Mirror the database's unique indexes, so the two backings refuse the
    // same writes rather than only one of them.
    for (const row of rows) {
      for (const other of this.rows.values()) {
        if (other.id === row.id) continue;
        if (
          other.provider_source === row.provider_source &&
          other.provider_external_id === row.provider_external_id
        ) {
          throw new Error("businesses_provider_identity_idx");
        }
        if (
          row.normalized_address !== null &&
          other.normalized_name === row.normalized_name &&
          other.normalized_address === row.normalized_address
        ) {
          throw new Error("businesses_normalized_identity_idx");
        }
      }
      this.rows.set(row.id, { ...row });
    }
  }

  async setLeadIfUnlinked(id: string, leadId: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row || row.lead_id !== null) return;
    for (const other of this.rows.values()) {
      if (other.lead_id === leadId) throw new Error("businesses_lead_id_idx");
    }
    row.lead_id = leadId;
  }

  async clearLead(leadId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.lead_id === leadId) row.lead_id = null;
    }
  }

  async setGoogleCheck(id: string, patch: GoogleCheckColumns): Promise<void> {
    const row = this.rows.get(id);
    if (row) Object.assign(row, patch);
  }

  async insertRun(row: IngestRunRow): Promise<void> {
    this.runs.push({ ...row });
  }

  async updateRun(id: string, patch: Partial<IngestRunRow>): Promise<void> {
    const run = this.runs.find((entry) => entry.id === id);
    if (run) Object.assign(run, patch);
  }

  async listRuns(limit: number): Promise<IngestRunRow[]> {
    return [...this.runs]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, limit)
      .map((run) => ({ ...run }));
  }
}
