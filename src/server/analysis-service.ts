import "server-only";

import type { Analysis } from "@/lib/analysis";
import { deriveAnalysisFacts, toProviderInput } from "@/lib/analysis-facts";
import { getAnalysisProvider } from "@/server/analysis";
import { getAnalysisRepository, getLeadRepository } from "@/server/repo";

import { LeadNotFoundError } from "./service-errors";

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

export { LeadNotFoundError } from "./service-errors";

export async function analyseLead(leadId: string): Promise<Analysis> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  // FACT OWNERSHIP. Facts are derived here, by deterministic application code,
  // from the stored snapshot -- never by the analyser. The analyser then sees
  // only a sanitized subset and can return only recommendations, so there is no
  // path by which a model influences what we record as fact.
  const facts = deriveAnalysisFacts(lead);
  const provider = getAnalysisProvider();

  // Provider errors and invalid output both surface as exceptions; nothing
  // partial is persisted. The repository validates the draft before writing.
  const result = await provider.analyse(toProviderInput(facts));

  return getAnalysisRepository().create(lead.id, {
    // Identity of the analyser is read from the provider itself, not from its
    // output -- a model cannot claim to be a different model.
    provider: { name: provider.name, model: provider.model },
    facts,
    recommendations: result.recommendations,
    assumptions: result.assumptions,
    limitations: result.limitations,
  });
}

/** Analyses for a lead, newest first. */
export async function analysesForLead(leadId: string): Promise<Analysis[]> {
  return getAnalysisRepository().listForLead(leadId);
}
