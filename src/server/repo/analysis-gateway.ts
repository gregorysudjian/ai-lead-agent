/**
 * The narrow data-access seam for analyses.
 *
 * Same split as the lead repository: the repository holds the rules, the
 * gateway holds row access. That is what makes the repository testable against
 * an in-memory fake with no network and no credentials.
 */
import type { AnalysisRow } from "./analysis-mapping";

export interface AnalysisTableGateway {
  insertRow(row: AnalysisRow): Promise<void>;
  findRowById(id: string): Promise<AnalysisRow | null>;
  /** Newest first. */
  listRowsForLead(leadId: string): Promise<AnalysisRow[]>;
}
