import "server-only";

import { deriveAnalysisFacts, toProviderInput } from "@/lib/analysis-facts";
import type { CatalogBusiness } from "@/lib/catalog/types";
import { deriveDemoSiteBusiness, toDemoGeneratorInput } from "@/lib/demo-facts";
import { enforceSampleFlags } from "@/lib/demo-sample-policy";
import type { DemoSiteSpec } from "@/lib/demo-site";
import type { Lead } from "@/lib/types";
import { mockAnalysisProvider } from "@/server/analysis/mock";
import { mockDemoSiteProvider } from "@/server/demo/mock";
import { getCatalogRepository } from "@/server/repo";

/**
 * The demo lab: a website for ANY catalog business, rendered in memory.
 *
 * ── WHAT IT IS FOR ────────────────────────────────────────────────────────
 *
 * Two jobs. For the operator, "what could this business's site look like?"
 * answered before deciding it is worth a lead. For whoever works on the
 * generator, a way to see a design for any of the 2,839 businesses in the
 * catalog -- every trade, every neighbourhood, long names and short, with and
 * without a phone -- without first creating leads and demos for them.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 *   - It writes nothing. No lead, no analysis, no demo row. A lab page is a
 *     rendering, not a record, so refreshing it a hundred times leaves the
 *     database exactly as it was.
 *   - It never calls a paid provider. The MOCK analyser and the MOCK demo
 *     generator are imported by name rather than through the configured
 *     providers, so no environment setting can turn a lab preview into an
 *     Anthropic call.
 *
 * Everything else is the real pipeline: the same fact derivation, the same
 * generator input, the same sample-flag enforcement a stored demo goes
 * through. What the lab shows is what generation would store.
 */

export interface LabDemo {
  business: CatalogBusiness;
  spec: DemoSiteSpec;
}

/**
 * The catalog business as the lead it would become.
 *
 * In memory only. The id is marked as a lab id so that nothing downstream can
 * mistake it for a stored lead.
 */
function asLead(business: CatalogBusiness): Lead {
  return {
    id: `lab-${business.id}`,
    status: "new",
    createdAt: business.firstSeenAt,
    updatedAt: business.lastSeenAt,
    provider: business.provider,
  };
}

/** The demo generation would produce for this business, or null if unknown. */
export async function labDemoForBusiness(businessId: string): Promise<LabDemo | null> {
  const business = await getCatalogRepository().findById(businessId);
  if (business === null) return null;

  const lead = asLead(business);
  const analysis = await mockAnalysisProvider.analyse(toProviderInput(deriveAnalysisFacts(lead)));
  // No research profile: the lab shows what a demo looks like from the
  // discovery record alone, which is what a first demo is built from.
  const facts = deriveDemoSiteBusiness(lead, null);
  const generated = await mockDemoSiteProvider.generate(
    toDemoGeneratorInput(facts, analysis.recommendations),
  );

  return { business, spec: { business: facts, content: enforceSampleFlags(generated, facts) } };
}
