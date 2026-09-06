import "server-only";

import type { Analysis } from "@/lib/analysis";
import { getAnalysisProvider } from "@/server/analysis";
import { getAnalysisRepository, getLeadRepository } from "@/server/repo";

/**
 * Analyse one lead and persist the result.
 *
 * The business rule lives here rather than in the route handler, so a future
 * background job or CLI can reuse it without going through HTTP.
 *
 * The lead snapshot is loaded from the DATABASE, never accepted from the
 * caller. A browser cannot supply provider "facts" for an analysis to reason
 * from -- it only names which lead to analyse.
 */

/** The lead named does not exist. A normal outcome the caller reports as 404. */
export class LeadNotFoundError extends Error {
  constructor(leadId: string) {
    super(`No lead with id ${leadId}.`);
    this.name = "LeadNotFoundError";
  }
}

export async function analyseLead(leadId: string): Promise<Analysis> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  // Provider errors and invalid output both surface as exceptions; nothing
  // partial is persisted. The repository validates the draft before writing.
  const draft = await getAnalysisProvider().analyse(lead);

  return getAnalysisRepository().create(lead.id, draft);
}

/** Analyses for a lead, newest first. */
export async function analysesForLead(leadId: string): Promise<Analysis[]> {
  return getAnalysisRepository().listForLead(leadId);
}
