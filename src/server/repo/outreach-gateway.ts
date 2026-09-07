/**
 * The narrow data-access seam for outreach records.
 *
 * Same split as every other store: the repository holds the rules, the gateway
 * holds row access, so the repository can be tested against an in-memory fake
 * with no network and no credentials.
 */
import type { OutreachRow } from "./outreach-mapping";

export interface OutreachTableGateway {
  insertRow(row: OutreachRow): Promise<void>;
  findRowById(id: string): Promise<OutreachRow | null>;
  /** Newest first. */
  listRowsForLead(leadId: string): Promise<OutreachRow[]>;
  /** Newest first, across every lead. */
  listRecentRows(limit: number): Promise<OutreachRow[]>;
  /** Write the whole row back. Returns null when the id is unknown. */
  updateRow(row: OutreachRow): Promise<OutreachRow | null>;
}
