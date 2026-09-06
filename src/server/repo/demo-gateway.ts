/**
 * The narrow data-access seam for demo sites.
 *
 * Same split as leads and analyses: the repository holds the rules, the gateway
 * holds row access. That is what lets the repository be tested against an
 * in-memory fake with no network and no credentials.
 */
import type { DemoSiteRow } from "./demo-mapping";

export interface DemoSiteTableGateway {
  insertRow(row: DemoSiteRow): Promise<void>;
  findRowById(id: string): Promise<DemoSiteRow | null>;
  /** Newest first. */
  listRowsForLead(leadId: string): Promise<DemoSiteRow[]>;
  /** Newest first. */
  listRowsForAnalysis(analysisId: string): Promise<DemoSiteRow[]>;
  /** Newest first, across every lead. */
  listRecentRows(limit: number): Promise<DemoSiteRow[]>;
}
