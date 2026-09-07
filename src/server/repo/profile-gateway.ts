/**
 * The narrow data-access seam for business profiles.
 *
 * Same split as leads, analyses and demo sites: the repository holds the
 * rules, the gateway holds row access. That is what lets the repository be
 * tested against an in-memory fake with no network and no credentials.
 */
import type { BusinessProfileRow } from "./profile-mapping";

export interface BusinessProfileTableGateway {
  insertRow(row: BusinessProfileRow): Promise<void>;
  findRowById(id: string): Promise<BusinessProfileRow | null>;
  /** Newest first. */
  listRowsForLead(leadId: string): Promise<BusinessProfileRow[]>;
  /** Newest first, across every lead. */
  listRecentRows(limit: number): Promise<BusinessProfileRow[]>;
}
