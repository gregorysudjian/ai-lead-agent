import { describe, expect, it } from "vitest";

import type { Analysis, AnalysisDraft } from "@/lib/analysis";
import { BUSINESS_SOURCES } from "@/lib/types";

import {
  analysisToRow,
  assertValidDraft,
  AnalysisRowMappingError,
  rowToAnalysis,
  type AnalysisRow,
} from "./analysis-mapping";

const facts = {
  businessName: "Salon Test",
  category: "Hair salon",
  city: "Montreal",
  source: "osm" as const,
  snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
  websiteListed: false,
  phoneListed: true,
  addressListed: true,
  ratingListed: null,
  reviewCountListed: null,
};

const recommendations = {
  businessSummary: "A summary.",
  websiteOpportunity: "An opportunity.",
  recommendedSiteType: "booking-focused-site" as const,
  recommendedPages: ["Home", "Contact"],
  homepageSections: ["Hero"],
  keySellingPoints: ["Point"],
  callsToAction: ["Call"],
  designDirection: { tone: "t", palette: "p", imagery: "i", typography: "ty" },
  draftPositioning: "Positioning.",
};

const doc = { facts, recommendations, assumptions: ["A1"], limitations: ["L1"] };

const row = (over: Partial<AnalysisRow> = {}): AnalysisRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  lead_id: "22222222-2222-4222-8222-222222222222",
  status: "complete",
  created_at: "2026-09-06T00:00:00.000Z",
  updated_at: "2026-09-06T00:00:00.000Z",
  provider_name: "mock",
  provider_model: "deterministic-rules-v1",
  analysis: doc,
  ...over,
});

describe("row -> Analysis", () => {
  it("maps a well-formed row", () => {
    const analysis = rowToAnalysis(row());
    expect(analysis.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(analysis.leadId).toBe("22222222-2222-4222-8222-222222222222");
    expect(analysis.provider).toEqual({ name: "mock", model: "deterministic-rules-v1" });
    expect(analysis.facts).toEqual(facts);
    expect(analysis.recommendations).toEqual(recommendations);
  });

  it("never leaks snake_case columns into the domain object", () => {
    const analysis = rowToAnalysis(row()) as unknown as Record<string, unknown>;
    for (const column of ["lead_id", "created_at", "updated_at", "provider_name", "provider_model"]) {
      expect(analysis[column]).toBeUndefined();
    }
    expect(Object.keys(analysis).sort()).toEqual([
      "assumptions", "createdAt", "facts", "id", "leadId",
      "limitations", "provider", "recommendations", "status", "updatedAt",
    ]);
  });

  it.each([["pending"], ["failed"], [""], ["COMPLETE"]])(
    "rejects invalid status %j",
    (status) => {
      expect(() => rowToAnalysis(row({ status }))).toThrow(AnalysisRowMappingError);
    },
  );

  it.each([
    ["analysis not an object", { analysis: "nope" }],
    ["analysis null", { analysis: null }],
    ["analysis an array", { analysis: [] }],
    ["missing id", { id: "" }],
    ["missing lead_id", { lead_id: "" }],
    ["missing provider_name", { provider_name: "" }],
  ])("rejects a malformed row: %s", (_label, patch) => {
    expect(() => rowToAnalysis(row(patch as Partial<AnalysisRow>))).toThrow(AnalysisRowMappingError);
  });

  it.each([
    ["facts missing", { ...doc, facts: undefined }],
    ["unknown source", { ...doc, facts: { ...facts, source: "yelp" } }],
    ["websiteListed not boolean", { ...doc, facts: { ...facts, websiteListed: "no" } }],
    ["rating a string", { ...doc, facts: { ...facts, ratingListed: "4.5" } }],
    ["recommendations missing", { ...doc, recommendations: undefined }],
    ["unknown site type", { ...doc, recommendations: { ...recommendations, recommendedSiteType: "mega-site" } }],
    ["pages not an array", { ...doc, recommendations: { ...recommendations, recommendedPages: "Home" } }],
    ["page entry empty", { ...doc, recommendations: { ...recommendations, recommendedPages: [""] } }],
    ["designDirection missing field", { ...doc, recommendations: { ...recommendations, designDirection: { tone: "t" } } }],
    ["assumptions not an array", { ...doc, assumptions: "none" }],
    ["limitations entry not a string", { ...doc, limitations: [42] }],
  ])("rejects a malformed analysis document: %s", (_label, analysis) => {
    expect(() => rowToAnalysis(row({ analysis }))).toThrow(AnalysisRowMappingError);
  });
});

describe("Analysis -> row", () => {
  const analysis: Analysis = {
    id: "11111111-1111-4111-8111-111111111111",
    leadId: "22222222-2222-4222-8222-222222222222",
    status: "complete",
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    provider: { name: "mock", model: "deterministic-rules-v1" },
    facts,
    recommendations,
    assumptions: ["A1"],
    limitations: ["L1"],
  };

  it("writes identity and timestamps as columns, the rest as one jsonb document", () => {
    const written = analysisToRow(analysis);
    expect(Object.keys(written).sort()).toEqual([
      "analysis", "created_at", "id", "lead_id", "provider_model", "provider_name", "status", "updated_at",
    ]);
    expect(written.analysis).toEqual(doc);
  });

  it("round-trips through the database shape unchanged", () => {
    expect(rowToAnalysis(analysisToRow(analysis))).toEqual(analysis);
  });

  it("does not duplicate identity inside the jsonb document", () => {
    const written = analysisToRow(analysis).analysis as Record<string, unknown>;
    expect(written.id).toBeUndefined();
    expect(written.leadId).toBeUndefined();
    expect(written.createdAt).toBeUndefined();
  });
});

describe("draft validation before persistence", () => {
  const draft: AnalysisDraft = {
    provider: { name: "mock", model: "m1" },
    facts,
    recommendations,
    assumptions: ["A"],
    limitations: ["L"],
  };

  it("accepts a well-formed draft", () => {
    expect(assertValidDraft(draft)).toEqual(draft);
  });

  it.each([
    ["missing provider name", { ...draft, provider: { name: "", model: "m" } }],
    ["missing recommendations", { ...draft, recommendations: undefined }],
    ["empty page entry", { ...draft, recommendations: { ...recommendations, homepageSections: ["  "] } }],
    ["assumptions not an array", { ...draft, assumptions: null }],
  ])("rejects an invalid draft: %s", (_label, bad) => {
    expect(() => assertValidDraft(bad as AnalysisDraft)).toThrow(AnalysisRowMappingError);
  });
});

describe("every business source can be analysed", () => {
  // Every source a lead can carry must pass, or every lead from that source
  // fails at the moment its analysis is saved -- which is what happened to
  // the whole Overture catalog when this list was a hand-written copy.
  it.each(BUSINESS_SOURCES)("accepts facts from %s", (source) => {
    const draft: AnalysisDraft = {
      provider: { name: "mock", model: "m1" },
      facts: { ...facts, source },
      recommendations,
      assumptions: ["A"],
      limitations: ["L"],
    };
    expect(assertValidDraft(draft).facts.source).toBe(source);
  });
});
