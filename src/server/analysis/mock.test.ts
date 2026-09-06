import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/types";

import { mockAnalysisProvider } from "./mock";
import { AnalysisProviderError } from "./types";

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

describe("facts are copied from the snapshot, never inferred", () => {
  it("mirrors the provider snapshot exactly", async () => {
    const draft = await mockAnalysisProvider.analyse(lead());
    expect(draft.facts).toEqual({
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

  it("websiteListed reflects only whether the provider listed one", async () => {
    expect((await mockAnalysisProvider.analyse(lead({ website: null }))).facts.websiteListed)
      .toBe(false);
    expect(
      (await mockAnalysisProvider.analyse(lead({ website: "https://x.example.com" }))).facts
        .websiteListed,
    ).toBe(true);
    // A malformed but present value is still "listed" -- same rule as scoring.
    expect((await mockAnalysisProvider.analyse(lead({ website: "not a url" }))).facts.websiteListed)
      .toBe(true);
  });

  it("treats whitespace-only phone and address as not listed", async () => {
    const draft = await mockAnalysisProvider.analyse(lead({ phone: "   ", address: "" }));
    expect(draft.facts.phoneListed).toBe(false);
    expect(draft.facts.addressListed).toBe(false);
  });

  it("never invents a rating or review count", async () => {
    const draft = await mockAnalysisProvider.analyse(lead({ rating: null, reviewCount: null }));
    expect(draft.facts.ratingListed).toBeNull();
    expect(draft.facts.reviewCountListed).toBeNull();
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
    const text = allText(await mockAnalysisProvider.analyse(lead(over)));
    for (const pattern of FABRICATION_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("phrases the no-website case as a provider signal, not a fact", async () => {
    const draft = await mockAnalysisProvider.analyse(lead({ website: null }));
    const opportunity = draft.recommendations.websiteOpportunity;
    expect(opportunity).toContain("No website was listed by the provider");
    expect(opportunity).toContain("not proof that none exists");
    expect(opportunity).not.toMatch(/\bhas no website\b/i);
  });

  it("always states its limitations, including the website caveat", async () => {
    const draft = await mockAnalysisProvider.analyse(lead());
    expect(draft.limitations.length).toBeGreaterThan(0);
    expect(draft.limitations.join(" ")).toContain("listed none, not that none exists");
    expect(draft.limitations.join(" ")).toContain("no estimate of revenue");
  });
});

describe("determinism and purity", () => {
  it("produces identical output for the same lead", async () => {
    const l = lead();
    expect(await mockAnalysisProvider.analyse(l)).toEqual(await mockAnalysisProvider.analyse(l));
  });

  it("does not mutate the lead", async () => {
    const l = lead();
    const before = structuredClone(l);
    await mockAnalysisProvider.analyse(l);
    expect(l).toEqual(before);
  });

  it("ignores application-owned fields entirely", async () => {
    const asNew = lead();
    const asReviewed: Lead = { ...asNew, status: "reviewed", updatedAt: "2030-01-01T00:00:00.000Z" };
    expect(await mockAnalysisProvider.analyse(asReviewed)).toEqual(
      await mockAnalysisProvider.analyse(asNew),
    );
  });

  it("reports its provider name and model for the stored record", async () => {
    const draft = await mockAnalysisProvider.analyse(lead());
    expect(draft.provider).toEqual({ name: "mock", model: "deterministic-rules-v1" });
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
    const draft = await mockAnalysisProvider.analyse(lead({ category }));
    expect(draft.recommendations.recommendedSiteType).toBe(expected);
  });

  it("always returns non-empty structured lists", async () => {
    const draft = await mockAnalysisProvider.analyse(lead());
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
    await expect(mockAnalysisProvider.analyse(lead({ name: "   " }))).rejects.toBeInstanceOf(
      AnalysisProviderError,
    );
  });
});
