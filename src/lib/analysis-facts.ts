/**
 * The single source of truth for deriving analysis facts from a lead.
 *
 * Pure and deterministic. Used by BOTH the mock and the real analyser paths, so
 * facts cannot diverge between providers -- and, critically, so no provider
 * ever derives them itself.
 */
import type { AnalysisFacts, AnalysisProviderInput } from "./analysis";
import { isUsableText } from "./scoring";
import type { Lead } from "./types";

/** Human-readable source labels. Internal enum values never reach a model. */
const SOURCE_LABELS: Record<string, string> = {
  mock: "Mock fixture data",
  osm: "OpenStreetMap",
  google: "Google Places",
};

/**
 * Derive the factual record from a stored lead snapshot.
 *
 * Every field restates what the PROVIDER listed. `websiteListed: false` means
 * the provider returned no website -- never that the business has none.
 */
export function deriveAnalysisFacts(lead: Lead): AnalysisFacts {
  const p = lead.provider;
  return {
    businessName: p.name,
    category: p.category,
    city: p.city,
    source: p.source,
    snapshotFetchedAt: p.fetchedAt,
    websiteListed: p.website !== null,
    phoneListed: isUsableText(p.phone),
    addressListed: isUsableText(p.address),
    ratingListed: p.rating,
    reviewCountListed: p.reviewCount,
  };
}

/**
 * Reduce facts to the sanitized payload an analyser may see.
 *
 * Drops the internal source enum (replaced by a label) and the snapshot
 * timestamp, which is bookkeeping the analyser cannot reason usefully about.
 * Contact VALUES were never in `AnalysisFacts` to begin with -- only presence
 * flags -- so there is nothing here to leak.
 */
export function toProviderInput(facts: AnalysisFacts): AnalysisProviderInput {
  return {
    businessName: facts.businessName,
    category: facts.category,
    city: facts.city,
    sourceLabel: SOURCE_LABELS[facts.source] ?? facts.source,
    websiteListed: facts.websiteListed,
    phoneListed: facts.phoneListed,
    addressListed: facts.addressListed,
    rating: facts.ratingListed,
    reviewCount: facts.reviewCountListed,
  };
}
