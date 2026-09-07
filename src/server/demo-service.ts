import "server-only";

import type { DemoSite } from "@/lib/demo-site";
import { deriveDemoSiteBusiness, toDemoGeneratorInput } from "@/lib/demo-facts";
import { getDemoSiteProvider } from "@/server/demo";
import {
  getAnalysisRepository,
  getBusinessProfileRepository,
  getDemoSiteRepository,
  getLeadRepository,
} from "@/server/repo";

import { LeadNotFoundError } from "./service-errors";

/**
 * Generate one demo site for one lead, from one analysis, and persist it.
 *
 * The business rule lives here rather than in the route handler, so a future
 * CLI or batch job can reuse it without going through HTTP.
 *
 * BOTH inputs are loaded from the DATABASE. The caller supplies identities
 * only -- which lead, and optionally which analysis. A browser cannot pass in
 * business facts, recommendations or a spec for us to store.
 */

/** The lead has never been analysed, or the named analysis does not exist. */
export class AnalysisNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisNotFoundError";
  }
}

/**
 * The named analysis exists but belongs to a different lead.
 *
 * Treated as a distinct failure rather than a not-found, because it is the
 * shape a deliberate attempt to graft one business's analysis onto another
 * business's demo would take.
 */
export class AnalysisLeadMismatchError extends Error {
  constructor(analysisId: string, leadId: string) {
    super(`Analysis ${analysisId} does not belong to lead ${leadId}.`);
    this.name = "AnalysisLeadMismatchError";
  }
}

export { LeadNotFoundError } from "./service-errors";

export async function generateDemoSite(
  leadId: string,
  analysisId?: string,
): Promise<DemoSite> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  const analyses = getAnalysisRepository();

  const analysis = analysisId
    ? await analyses.findById(analysisId)
    : await analyses.latestForLead(leadId);

  if (!analysis) {
    throw new AnalysisNotFoundError(
      analysisId
        ? `No analysis with id ${analysisId}.`
        : `Lead ${leadId} has no analysis to generate a demo from.`,
    );
  }

  // An analysis names its lead. Checking it here means a mismatched pair is
  // rejected before any generation happens, rather than producing a demo that
  // describes one business using another's recommendations.
  if (analysis.leadId !== lead.id) {
    throw new AnalysisLeadMismatchError(analysis.id, lead.id);
  }

  // FACT OWNERSHIP. Business facts are derived here, by deterministic
  // application code, from the stored lead -- never by the generator. The
  // generator receives a sanitized subset and returns only presentation, so
  // there is no path by which it influences what the demo states as fact.
  // The business's own researched profile, when it has one. This is the step
  // CLAUDE.md flagged as deliberate rather than incidental: a demo built from
  // the business's own site -- its real hours, its real social profiles, its
  // own words -- looks like their business instead of a template with their
  // name dropped into it. A read failure here must not fail generation, so the
  // demo falls back to the lead snapshot, exactly as before.
  let profile = null;
  try {
    profile = await getBusinessProfileRepository().latestForLead(lead.id);
  } catch (error) {
    console.error(`[demo ${lead.id}] could not read the business profile:`, error);
  }

  const business = deriveDemoSiteBusiness(lead, profile);
  const generator = getDemoSiteProvider();

  // Generator errors and invalid output both surface as exceptions; nothing
  // partial is persisted. The repository validates the spec before writing.
  const content = await generator.generate(toDemoGeneratorInput(business, analysis.recommendations));

  return getDemoSiteRepository().create(lead.id, analysis.id, {
    // Identity of the generator is read from the generator itself, not from its
    // output -- it cannot claim to be a different one.
    generator: { name: generator.name, model: generator.model },
    spec: { business, content },
  });
}

/** Demo sites for a lead, newest first. */
export async function demoSitesForLead(leadId: string): Promise<DemoSite[]> {
  return getDemoSiteRepository().listForLead(leadId);
}

/** The most recent demo sites across every lead, newest first. */
export async function recentDemoSites(limit = 100): Promise<DemoSite[]> {
  return getDemoSiteRepository().listRecent(limit);
}
