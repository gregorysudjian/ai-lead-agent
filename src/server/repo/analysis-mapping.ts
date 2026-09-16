/**
 * Explicit mapping between lead_analyses rows and the Analysis domain type.
 *
 * Same contract as the lead mapping: snake_case never escapes this layer, and a
 * row is untrusted input validated field by field before it becomes a domain
 * object. `jsonb` guarantees only that the value is JSON -- not that it matches
 * our schema.
 *
 * Pure, no I/O, no secrets, so it is directly unit-testable.
 */
import type {
  Analysis,
  AnalysisDraft,
  AnalysisFacts,
  AnalysisRecommendations,
  AnalysisStatus,
  DesignDirection,
  RecommendedSiteType,
} from "@/lib/analysis";
import { RECOMMENDED_SITE_TYPE_LABELS } from "@/lib/analysis";
import { BUSINESS_SOURCES, type BusinessSource } from "@/lib/types";

/** The `lead_analyses` table shape. Database implementation detail. */
export interface AnalysisRow {
  id: string;
  lead_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  provider_name: string;
  provider_model: string;
  analysis: unknown;
}

export class AnalysisRowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisRowMappingError";
  }
}

function fail(field: string, why: string): never {
  throw new AnalysisRowMappingError(`Analysis row field "${field}" ${why}.`);
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(field, "is missing or not a non-empty string");
  }
  return value;
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(field, "must be a boolean");
  return value;
}

function numOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(field, "must be a finite number or null");
  }
  return value;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(field, "must be an array");
  return value.map((entry, i) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      fail(`${field}[${i}]`, "must be a non-empty string");
    }
    return entry;
  });
}

// The one list of sources, never a copy: a hand-written "mock, osm, google"
// here once made every business added from the Overture catalog fail at the
// moment its analysis or demo was saved.
const SOURCES: readonly string[] = BUSINESS_SOURCES;

function toFacts(value: unknown): AnalysisFacts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("analysis.facts", "is not an object");
  }
  const f = value as Record<string, unknown>;

  const source = str(f.source, "analysis.facts.source");
  if (!SOURCES.includes(source)) fail("analysis.facts.source", "has an unknown value");

  return {
    businessName: str(f.businessName, "analysis.facts.businessName"),
    category: str(f.category, "analysis.facts.category"),
    city: str(f.city, "analysis.facts.city"),
    source: source as BusinessSource,
    snapshotFetchedAt: str(f.snapshotFetchedAt, "analysis.facts.snapshotFetchedAt"),
    websiteListed: bool(f.websiteListed, "analysis.facts.websiteListed"),
    phoneListed: bool(f.phoneListed, "analysis.facts.phoneListed"),
    addressListed: bool(f.addressListed, "analysis.facts.addressListed"),
    ratingListed: numOrNull(f.ratingListed, "analysis.facts.ratingListed"),
    reviewCountListed: numOrNull(f.reviewCountListed, "analysis.facts.reviewCountListed"),
  };
}

function toDesignDirection(value: unknown): DesignDirection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("analysis.recommendations.designDirection", "is not an object");
  }
  const d = value as Record<string, unknown>;
  return {
    tone: str(d.tone, "analysis.recommendations.designDirection.tone"),
    palette: str(d.palette, "analysis.recommendations.designDirection.palette"),
    imagery: str(d.imagery, "analysis.recommendations.designDirection.imagery"),
    typography: str(d.typography, "analysis.recommendations.designDirection.typography"),
  };
}

function toRecommendations(value: unknown): AnalysisRecommendations {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("analysis.recommendations", "is not an object");
  }
  const r = value as Record<string, unknown>;

  const siteType = str(r.recommendedSiteType, "analysis.recommendations.recommendedSiteType");
  if (!(siteType in RECOMMENDED_SITE_TYPE_LABELS)) {
    fail("analysis.recommendations.recommendedSiteType", "is not a known site type");
  }

  return {
    businessSummary: str(r.businessSummary, "analysis.recommendations.businessSummary"),
    websiteOpportunity: str(r.websiteOpportunity, "analysis.recommendations.websiteOpportunity"),
    recommendedSiteType: siteType as RecommendedSiteType,
    recommendedPages: stringList(r.recommendedPages, "analysis.recommendations.recommendedPages"),
    homepageSections: stringList(r.homepageSections, "analysis.recommendations.homepageSections"),
    keySellingPoints: stringList(r.keySellingPoints, "analysis.recommendations.keySellingPoints"),
    callsToAction: stringList(r.callsToAction, "analysis.recommendations.callsToAction"),
    designDirection: toDesignDirection(r.designDirection),
    draftPositioning: str(r.draftPositioning, "analysis.recommendations.draftPositioning"),
  };
}

/** Database row -> Analysis. Throws on anything malformed. */
export function rowToAnalysis(row: AnalysisRow): Analysis {
  if (row.status !== "complete") {
    fail("status", "is not a valid AnalysisStatus");
  }

  const doc = row.analysis;
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    fail("analysis", "is not an object");
  }
  const d = doc as Record<string, unknown>;

  const analysis: Analysis = {
    id: str(row.id, "id"),
    leadId: str(row.lead_id, "lead_id"),
    status: row.status as AnalysisStatus,
    createdAt: str(row.created_at, "created_at"),
    updatedAt: str(row.updated_at, "updated_at"),
    provider: {
      name: str(row.provider_name, "provider_name"),
      model: str(row.provider_model, "provider_model"),
    },
    facts: toFacts(d.facts),
    recommendations: toRecommendations(d.recommendations),
    assumptions: stringList(d.assumptions, "analysis.assumptions"),
    limitations: stringList(d.limitations, "analysis.limitations"),
  };

  return analysis;
}

/** Validate a provider draft before it is ever persisted. */
export function assertValidDraft(draft: AnalysisDraft): AnalysisDraft {
  return {
    provider: {
      name: str(draft.provider?.name, "provider_name"),
      model: str(draft.provider?.model, "provider_model"),
    },
    facts: toFacts(draft.facts),
    recommendations: toRecommendations(draft.recommendations),
    assumptions: stringList(draft.assumptions, "analysis.assumptions"),
    limitations: stringList(draft.limitations, "analysis.limitations"),
  };
}

/** Analysis -> database row, ready to insert. */
export function analysisToRow(analysis: Analysis): AnalysisRow {
  return {
    id: analysis.id,
    lead_id: analysis.leadId,
    status: analysis.status,
    created_at: analysis.createdAt,
    updated_at: analysis.updatedAt,
    provider_name: analysis.provider.name,
    provider_model: analysis.provider.model,
    // The jsonb document holds exactly the four analysis subtrees. Identity and
    // timestamps live in real columns, not duplicated inside the JSON.
    analysis: {
      facts: analysis.facts,
      recommendations: analysis.recommendations,
      assumptions: analysis.assumptions,
      limitations: analysis.limitations,
    },
  };
}
