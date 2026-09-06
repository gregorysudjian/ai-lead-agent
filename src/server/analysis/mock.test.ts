import { describe, expect, it } from "vitest";

import { deriveAnalysisFacts, toProviderInput } from "@/lib/analysis-facts";
import type { Lead } from "@/lib/types";

import { mockAnalysisProvider } from "./mock";
import { AnalysisProviderError } from "./types";

/** Build the sanitized provider input the way the service does. */
const input = (over: Partial<Lead["provider"]> = {}) =>
  toProviderInput(deriveAnalysisFacts(lead(over)));

const lead = (over: Partial<Lead["provider"]> = {}, id = "lead-1"): Lead => ({
  id,
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Salon Test",
    category: "Hair salon",
    city: "Montreal",
    address: "100 Rue Test",
    phone: "+1 514 555 0100",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-09-05T00:00:00.000Z",
    ...over,
  },
});

describe("facts are derived deterministically, outside any provider", () => {
  it("mirrors the provider snapshot exactly", () => {
    expect(deriveAnalysisFacts(lead())).toEqual({
      businessName: "Salon Test",
      category: "Hair salon",
      city: "Montreal",
      source: "osm",
      snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
      websiteListed: false,
      phoneListed: true,
      addressListed: true,
      ratingListed: null,
      reviewCountListed: null,
    });
  });

  it("websiteListed reflects only whether the provider listed one", () => {
    expect(deriveAnalysisFacts(lead({ website: null })).websiteListed).toBe(false);
    expect(deriveAnalysisFacts(lead({ website: "https://x.example.com" })).websiteListed).toBe(true);
    // A malformed but present value is still "listed" -- same rule as scoring.
    expect(deriveAnalysisFacts(lead({ website: "not a url" })).websiteListed).toBe(true);
  });

  it("treats whitespace-only phone and address as not listed", () => {
    const facts = deriveAnalysisFacts(lead({ phone: "   ", address: "" }));
    expect(facts.phoneListed).toBe(false);
    expect(facts.addressListed).toBe(false);
  });

  it("never invents a rating or review count", () => {
    const facts = deriveAnalysisFacts(lead({ rating: null, reviewCount: null }));
    expect(facts.ratingListed).toBeNull();
    expect(facts.reviewCountListed).toBeNull();
  });

  it("is the same derivation for every provider path", () => {
    // One source of truth: mock and Anthropic workflows both call this.
    expect(deriveAnalysisFacts(lead())).toEqual(deriveAnalysisFacts(lead()));
  });
});

describe("the sanitized provider input withholds identifiers and contact values", () => {
  const sent = input({ phone: "+1 514 555 0100", address: "100 Rue Test", website: "https://x.example.com" });

  it("contains only the nine permitted fields", () => {
    expect(Object.keys(sent).sort()).toEqual([
      "addressListed", "businessName", "category", "city", "phoneListed",
      "rating", "reviewCount", "sourceLabel", "websiteListed",
    ]);
  });

  it("never carries the phone number, street address or website URL", () => {
    const serialized = JSON.stringify(sent);
    expect(serialized).not.toContain("514 555 0100");
    expect(serialized).not.toContain("100 Rue Test");
    expect(serialized).not.toContain("x.example.com");
  });

  it("never carries internal or provider identifiers, or timestamps", () => {
    const serialized = JSON.stringify(sent);
    expect(serialized).not.toContain("lead-1");
    expect(serialized).not.toContain("node/1");
    expect(serialized).not.toContain("2026-09-05");
    expect(serialized).not.toContain("externalId");
  });

  it("uses a human source label rather than the internal enum", () => {
    expect(sent.sourceLabel).toBe("OpenStreetMap");
  });
});

describe("recommendations never assert new facts about the business", () => {
  /** Claims the data cannot support. */
  const FABRICATION_PATTERNS = [
    /\b\d+\s*(customers|clients|visitors|sales|leads)\b/i,
    /\b(revenue|profit|turnover|earns?|\$\d)/i,
    /\blos(e|es|ing)\b.*\b(customers|business|money|sales)\b/i,
    /\b\d+\s*%/,
    /\bcompetitors?\b/i,
    /\b(is losing|will gain|guaranteed|proven to)\b/i,
    /\bhas no website\b/i,
    /\bdoes not have a website\b/i,
  ];

  const allText = (draft: Awaited<ReturnType<typeof mockAnalysisProvider.analyse>>) =>
    JSON.stringify(draft.recommendations) + JSON.stringify(draft.assumptions);

  it.each([
    ["no website listed", { website: null }],
    ["website listed", { website: "https://x.example.com" }],
    ["nothing listed", { website: null, phone: null, address: null }],
    ["restaurant", { category: "Restaurant" }],
    ["with reviews", { rating: 4.6, reviewCount: 128 }],
  ])("makes no fabricated claim for a lead with %s", async (_label, over) => {
    const text = allText(await mockAnalysisProvider.analyse(input(over)));
    for (const pattern of FABRICATION_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("phrases the no-website case as a provider signal, not a fact", async () => {
    const draft = await mockAnalysisProvider.analyse(input({ website: null }));
    const opportunity = draft.recommendations.websiteOpportunity;
    expect(opportunity).toContain("No website was listed by the provider");
    expect(opportunity).toContain("not proof that none exists");
    expect(opportunity).not.toMatch(/\bhas no website\b/i);
  });

  it("always states its limitations, including the website caveat", async () => {
    const draft = await mockAnalysisProvider.analyse(input());
    expect(draft.limitations.length).toBeGreaterThan(0);
    expect(draft.limitations.join(" ")).toContain("listed none, not that none exists");
    expect(draft.limitations.join(" ")).toContain("no estimate of revenue");
  });
});

describe("determinism and purity", () => {
  it("produces identical output for the same lead", async () => {
    const i = input();
    expect(await mockAnalysisProvider.analyse(i)).toEqual(await mockAnalysisProvider.analyse(i));
  });

  it("does not mutate its input", async () => {
    const i = input();
    const before = structuredClone(i);
    await mockAnalysisProvider.analyse(i);
    expect(i).toEqual(before);
  });

  it("does not mutate the lead the input was derived from", async () => {
    const l = lead();
    const before = structuredClone(l);
    await mockAnalysisProvider.analyse(toProviderInput(deriveAnalysisFacts(l)));
    expect(l).toEqual(before);
  });

  it("ignores application-owned fields entirely", async () => {
    const asNew = lead();
    const asReviewed: Lead = { ...asNew, status: "reviewed", updatedAt: "2030-01-01T00:00:00.000Z" };
    // Status and timestamps are not even present in the sanitized input.
    expect(await mockAnalysisProvider.analyse(toProviderInput(deriveAnalysisFacts(asReviewed))))
      .toEqual(await mockAnalysisProvider.analyse(toProviderInput(deriveAnalysisFacts(asNew))));
  });

  it("declares its identity as properties, not in its output", () => {
    // The service reads name/model from the provider itself, so a model cannot
    // claim to be a different model.
    expect(mockAnalysisProvider.name).toBe("mock");
    expect(mockAnalysisProvider.model).toBe("deterministic-rules-v1");
  });

  it("cannot return provider facts at all", async () => {
    const result = await mockAnalysisProvider.analyse(input());
    expect(Object.keys(result).sort()).toEqual([
      "assumptions", "limitations", "recommendations",
    ]);
    const asAny = result as unknown as Record<string, unknown>;
    for (const forbidden of ["facts", "provider", "leadId", "id", "createdAt", "updatedAt"]) {
      expect(asAny[forbidden]).toBeUndefined();
    }
  });
});

describe("category shapes the recommendation", () => {
  it.each([
    ["Restaurant", "menu-and-location-site"],
    ["Cafe", "menu-and-location-site"],
    ["Bakery", "menu-and-location-site"],
    ["Hair salon", "booking-focused-site"],
    ["Barber shop", "booking-focused-site"],
    ["Dentist", "booking-focused-site"],
    ["Florist", "small-brochure-site"],
    ["Car repair", "small-brochure-site"],
  ])("%s -> %s", async (category, expected) => {
    const draft = await mockAnalysisProvider.analyse(input({ category }));
    expect(draft.recommendations.recommendedSiteType).toBe(expected);
  });

  it("always returns non-empty structured lists", async () => {
    const draft = await mockAnalysisProvider.analyse(input());
    const r = draft.recommendations;
    for (const list of [r.recommendedPages, r.homepageSections, r.keySellingPoints, r.callsToAction]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((s) => s.trim().length > 0)).toBe(true);
    }
    expect(draft.assumptions.length).toBeGreaterThan(0);
  });
});

describe("failure", () => {
  it("refuses to analyse a lead with no usable name", async () => {
    await expect(mockAnalysisProvider.analyse(input({ name: "   " }))).rejects.toBeInstanceOf(
      AnalysisProviderError,
    );
  });
});
