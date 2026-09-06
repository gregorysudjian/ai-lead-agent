/**
 * Lead analysis: a website-strategy proposal for one lead.
 *
 * Kept entirely separate from `Lead`. A lead may be analysed many times, and an
 * analysis is a derived artefact of one moment -- not part of the lead's
 * identity. The Lead type is unchanged by this feature.
 *
 * THE CENTRAL RULE OF THIS MODEL is the split between `facts` and
 * `recommendations`:
 *
 *   facts            what the provider actually listed, copied from the lead
 *                    snapshot at analysis time. Nothing here is invented, and
 *                    every field is phrased as a statement about the PROVIDER.
 *   recommendations  what an analyser proposes. Opinion, not evidence.
 *
 * A recommendation may reason FROM a fact ("no website was listed, so a simple
 * site could make contact details easier to find"). It may never assert a new
 * fact about the business ("they lose 40 customers a month"). Keeping the two
 * in different subtrees means the UI can label them differently without relying
 * on anyone remembering to.
 *
 * Structured fields rather than one markdown blob, so the UI can render, filter
 * and validate individual parts, and so a future real model has a schema to
 * conform to.
 */
import type { BusinessSource } from "./types";

/** Only successful analyses are persisted; a failure is reported, not stored. */
export type AnalysisStatus = "complete";

/** Shape of site being proposed. Deliberately a small closed set. */
export type RecommendedSiteType =
  | "one-page-site"
  | "small-brochure-site"
  | "booking-focused-site"
  | "menu-and-location-site"
  | "portfolio-site";

export const RECOMMENDED_SITE_TYPE_LABELS: Record<RecommendedSiteType, string> = {
  "one-page-site": "One-page site",
  "small-brochure-site": "Small brochure site",
  "booking-focused-site": "Booking-focused site",
  "menu-and-location-site": "Menu and location site",
  "portfolio-site": "Portfolio site",
};

/**
 * What the provider listed, as of the snapshot the analysis ran against.
 *
 * Booleans are named `...Listed` on purpose: `websiteListed: false` means the
 * provider returned no website, never that the business has none.
 */
export interface AnalysisFacts {
  businessName: string;
  category: string;
  city: string;
  source: BusinessSource;
  /** ISO-8601 of the provider snapshot these facts came from. */
  snapshotFetchedAt: string;
  websiteListed: boolean;
  phoneListed: boolean;
  addressListed: boolean;
  /** Null when the provider listed none. Never estimated. */
  ratingListed: number | null;
  reviewCountListed: number | null;
}

export interface DesignDirection {
  tone: string;
  palette: string;
  imagery: string;
  typography: string;
}

/** Everything below is proposal, not evidence. */
export interface AnalysisRecommendations {
  businessSummary: string;
  websiteOpportunity: string;
  recommendedSiteType: RecommendedSiteType;
  recommendedPages: string[];
  homepageSections: string[];
  keySellingPoints: string[];
  callsToAction: string[];
  designDirection: DesignDirection;
  draftPositioning: string;
}

/** Which analyser produced this, so old analyses stay interpretable. */
export interface AnalysisProviderInfo {
  /** Implementation name, e.g. "mock". */
  name: string;
  /** Model identifier, or a deterministic ruleset version for the mock. */
  model: string;
}

export interface Analysis {
  id: string;
  /** The lead this analyses. Never embeds the lead itself. */
  leadId: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  provider: AnalysisProviderInfo;
  facts: AnalysisFacts;
  recommendations: AnalysisRecommendations;
  /** What the analyser had to assume because the data did not say. */
  assumptions: string[];
  /** What this analysis explicitly cannot tell you. */
  limitations: string[];
}

/** What the service assembles before the repository assigns identity/timestamps. */
export type AnalysisDraft = Pick<
  Analysis,
  "provider" | "facts" | "recommendations" | "assumptions" | "limitations"
>;

/**
 * Everything an analyser is permitted to RETURN.
 *
 * Note what is absent: no business name, no source, no snapshot timestamp, no
 * `...Listed` flags, no rating or review count, no lead id, no analysis id, no
 * timestamps. Those are derived by application code and merged in afterwards.
 *
 * This is the structural guarantee behind "a language model cannot control
 * provider facts": even a model that tried to assert `websiteListed: true`
 * has nowhere to put it. Facts are not a field it can reach.
 */
export interface AnalysisProviderResult {
  recommendations: AnalysisRecommendations;
  assumptions: string[];
  limitations: string[];
}

/**
 * Everything an analyser RECEIVES. Deliberately minimal.
 *
 * Presence flags rather than values: the analyser reasons about whether a phone
 * or address was listed, and never needs the number or street itself. Nothing
 * here identifies the record in our systems -- no internal UUID, no provider
 * external id, no database metadata, no timestamps.
 *
 * Every string field is UNTRUSTED provider data (it originates in
 * OpenStreetMap, which anyone may edit) and must be passed to a model as data,
 * never as instructions.
 */
export interface AnalysisProviderInput {
  businessName: string;
  category: string;
  city: string;
  /** Human-readable source label, e.g. "OpenStreetMap". Not an internal enum. */
  sourceLabel: string;
  websiteListed: boolean;
  phoneListed: boolean;
  addressListed: boolean;
  /** Only present when the provider actually listed one. */
  rating: number | null;
  reviewCount: number | null;
}
