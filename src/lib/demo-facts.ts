/**
 * The single source of truth for demo-site facts.
 *
 * Pure and deterministic. The same lead always yields the same
 * `DemoSiteBusiness`, and no generator is ever consulted — exactly as
 * `deriveAnalysisFacts` works for analyses.
 */
import type { AnalysisRecommendations } from "./analysis";
import type { DemoSiteBusiness, DemoSiteGeneratorInput } from "./demo-site";
import { isUsableText } from "./scoring";
import type { Lead } from "./types";

/** Trim to a usable value, or null when the provider listed nothing usable. */
function listed(value: string | null): string | null {
  return isUsableText(value) ? (value as string).trim() : null;
}

/**
 * Copy the business facts a demo site is allowed to state.
 *
 * Read from the LEAD, not from the analysis. The analysis carries a snapshot of
 * how things looked when it ran; the lead carries the current provider data,
 * which is what a demo shown to a prospect today should reflect.
 *
 * `websiteListed` records only what the provider listed. It is never rendered
 * as a claim that the business has or lacks a website.
 */
export function deriveDemoSiteBusiness(lead: Lead): DemoSiteBusiness {
  const p = lead.provider;
  return {
    name: p.name,
    category: p.category,
    city: p.city,
    phone: listed(p.phone),
    address: listed(p.address),
    websiteListed: p.website !== null,
    source: p.source,
    snapshotFetchedAt: p.fetchedAt,
  };
}

/**
 * Reduce facts plus analysis recommendations to what a generator may see.
 *
 * Contact VALUES are dropped here even though the demo will display them: the
 * generator writes wording and structure, and the renderer reads the number
 * from `spec.business`. A generator that never sees the phone number cannot
 * paraphrase, reformat or mistype it into body copy.
 */
export function toDemoGeneratorInput(
  business: DemoSiteBusiness,
  recommendations: AnalysisRecommendations,
): DemoSiteGeneratorInput {
  return {
    businessName: business.name,
    category: business.category,
    city: business.city,
    phoneListed: business.phone !== null,
    addressListed: business.address !== null,
    websiteListed: business.websiteListed,
    recommendedSiteType: recommendations.recommendedSiteType,
    recommendedPages: recommendations.recommendedPages,
    homepageSections: recommendations.homepageSections,
    keySellingPoints: recommendations.keySellingPoints,
    callsToAction: recommendations.callsToAction,
    designDirection: recommendations.designDirection,
    draftPositioning: recommendations.draftPositioning,
    businessSummary: recommendations.businessSummary,
  };
}
