import type { DemoShareRow } from "./share-mapping";

/**
 * The narrow data-access seam for demo shares.
 *
 * Same split as every other store: the repository holds the rules, the gateway
 * holds row access. That is what lets the repository be tested against an
 * in-memory fake with no network and no credentials.
 */
export interface DemoShareTableGateway {
  insertRow(row: DemoShareRow): Promise<void>;
  findRowByToken(token: string): Promise<DemoShareRow | null>;
  findRowById(id: string): Promise<DemoShareRow | null>;
  /** Newest first. */
  listRowsForDemo(demoId: string): Promise<DemoShareRow[]>;
  /**
   * Set `revoked_at` on one share.
   *
   * Deliberately narrower than a general update: this is the only mutation the
   * contract allows, and expressing it as its own operation means no caller
   * can reach for a broader one. A token cannot be rewritten and an expiry
   * cannot be extended after a link has been handed out.
   */
  markRevoked(id: string, revokedAt: string): Promise<void>;
}

/**
 * In-memory shares, for local development.
 *
 * Explicitly not durable -- it dies with the process, exactly like the local
 * demo gateway it sits beside. The JSON lead store has no file backing for
 * shares, and inventing one would imply a persistence guarantee that
 * CLAUDE.md is clear the JSON store does not offer.
 */
class LocalDemoShareGateway implements DemoShareTableGateway {
  private rows: DemoShareRow[] = [];

  async insertRow(row: DemoShareRow): Promise<void> {
    // A token collision is a database error in Supabase; mirror that here so
    // the two backings fail the same way rather than only one of them.
    if (this.rows.some((existing) => existing.token === row.token)) {
      throw new Error("demo_shares_token_unique");
    }
    this.rows.push({ ...row });
  }

  async findRowByToken(token: string): Promise<DemoShareRow | null> {
    return this.rows.find((row) => row.token === token) ?? null;
  }

  async findRowById(id: string): Promise<DemoShareRow | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async listRowsForDemo(demoId: string): Promise<DemoShareRow[]> {
    return this.rows
      .filter((row) => row.demo_id === demoId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .map((row) => ({ ...row }));
  }

  async markRevoked(id: string, revokedAt: string): Promise<void> {
    const row = this.rows.find((entry) => entry.id === id);
    // Already revoked keeps its original timestamp: the moment it stopped
    // working is the fact worth keeping, not the moment someone clicked twice.
    if (row && row.revoked_at === null) row.revoked_at = revokedAt;
  }
}

export const localDemoShareGateway: DemoShareTableGateway = new LocalDemoShareGateway();
