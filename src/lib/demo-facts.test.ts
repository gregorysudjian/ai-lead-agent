import { describe, expect, it } from "vitest";

import type { AnalysisRecommendations } from "./analysis";
import { deriveDemoSiteBusiness, toDemoGeneratorInput } from "./demo-facts";
import type { Lead } from "./types";

/**
 * Demo facts are derived by application code from the stored lead, and by
 * nothing else. These tests pin that: what the demo may state, and what the
 * generator is allowed to see.
 */

const lead = (over: Partial<Lead["provider"]> = {}): Lead => ({
  id: "lead-1",
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
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

const recommendations: AnalysisRecommendations = {
  businessSummary: "A hair salon listed in Montreal.",
  websiteOpportunity: "No website was listed by the provider.",
  recommendedSiteType: "booking-focused-site",
  recommendedPages: ["Home", "Services", "Contact"],
  homepageSections: ["Intro", "Services", "Contact"],
  keySellingPoints: ["Local", "Listed phone number"],
  callsToAction: ["Call the shop"],
  designDirection: {
    tone: "Warm and local",
    palette: "Two neutrals plus one accent",
    imagery: "Photographs of the premises",
    typography: "One readable sans-serif",
  },
  draftPositioning: "A hair salon in Montreal, easy to find.",
};

describe("demo facts mirror the lead snapshot", () => {
  it("copies exactly the fields a demo is allowed to state", () => {
    expect(deriveDemoSiteBusiness(lead())).toEqual({
      name: "Salon Test",
      category: "Hair salon",
      city: "Montreal",
      phone: "+1 514 555 0100",
      address: "100 Rue Test",
      websiteListed: false,
      source: "osm",
      snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    });
  });

  it("carries no internal ids or application timestamps", () => {
    const business = deriveDemoSiteBusiness(lead());
    expect(business).not.toHaveProperty("id");
    expect(business).not.toHaveProperty("externalId");
    expect(business).not.toHaveProperty("status");
    expect(business).not.toHaveProperty("createdAt");
    expect(business).not.toHaveProperty("updatedAt");
  });

  it("websiteListed reflects only whether the provider listed one", () => {
    expect(deriveDemoSiteBusiness(lead({ website: null })).websiteListed).toBe(false);
    expect(deriveDemoSiteBusiness(lead({ website: "https://x.example" })).websiteListed).toBe(true);
  });

  it("treats whitespace-only contact values as not listed", () => {
    const business = deriveDemoSiteBusiness(lead({ phone: "   ", address: "" }));
    expect(business.phone).toBeNull();
    expect(business.address).toBeNull();
  });

  it("trims a listed contact value rather than storing padding", () => {
    const business = deriveDemoSiteBusiness(lead({ phone: "  514 555 0100  " }));
    expect(business.phone).toBe("514 555 0100");
  });

  it("is deterministic", () => {
    expect(deriveDemoSiteBusiness(lead())).toEqual(deriveDemoSiteBusiness(lead()));
  });

  it("keeps a hostile business name verbatim, as data", () => {
    const hostile = "<script>alert(1)</script>";
    expect(deriveDemoSiteBusiness(lead({ name: hostile })).name).toBe(hostile);
  });
});

describe("what a generator is allowed to see", () => {
  const business = deriveDemoSiteBusiness(lead());
  const input = toDemoGeneratorInput(business, recommendations);

  it("carries presence flags, never the contact values themselves", () => {
    expect(input.phoneListed).toBe(true);
    expect(input.addressListed).toBe(true);
    expect(JSON.stringify(input)).not.toContain("555 0100");
    expect(JSON.stringify(input)).not.toContain("Rue Test");
  });

  it("carries no ids, no source enum and no timestamps", () => {
    const serialised = JSON.stringify(input);
    expect(serialised).not.toContain("lead-1");
    expect(serialised).not.toContain("node/1");
    expect(serialised).not.toContain("2026-09-05");
    expect(input).not.toHaveProperty("source");
    expect(input).not.toHaveProperty("snapshotFetchedAt");
  });

  it("exposes exactly the permitted field set", () => {
    expect(Object.keys(input).sort()).toEqual([
      "addressListed",
      "businessName",
      "businessSummary",
      "callsToAction",
      "category",
      "city",
      "designDirection",
      "draftPositioning",
      "homepageSections",
      "keySellingPoints",
      "phoneListed",
      "recommendedPages",
      "recommendedSiteType",
      "websiteListed",
    ]);
  });

  it("reports a missing phone as not listed", () => {
    const missing = toDemoGeneratorInput(
      deriveDemoSiteBusiness(lead({ phone: null })),
      recommendations,
    );
    expect(missing.phoneListed).toBe(false);
  });
});
