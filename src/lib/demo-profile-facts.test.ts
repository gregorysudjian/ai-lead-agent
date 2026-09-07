import { describe, expect, it } from "vitest";

import type { BusinessProfile } from "./business-profile";
import { emptyProfileFacts } from "./business-profile";
import { deriveDemoSiteBusiness, toDemoGeneratorInput } from "./demo-facts";
import type { AnalysisRecommendations } from "./analysis";
import type { Lead } from "./types";

/**
 * The Phase 13 migration: a demo is built from the business's own site when we
 * have read it, and from the discovery record when we have not.
 */

const AT = "2026-09-07T12:00:00.000Z";

const lead = (over: Partial<Lead["provider"]> = {}): Lead => ({
  id: "lead-1",
  status: "new",
  createdAt: AT,
  updatedAt: AT,
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Crisp",
    category: "Barber shop",
    city: "Montreal",
    address: "1188 Rue Ontario Est",
    phone: "+1 514 934 3300",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
    ...over,
  },
});

function profile(
  facts: Record<string, { value: unknown; sourceId: string; kind: "stated" | "observed" }[]>,
): BusinessProfile {
  const base = emptyProfileFacts();
  for (const [field, observations] of Object.entries(facts)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture indexes by field name
    (base as any)[field] = observations;
  }

  return {
    id: "profile-1",
    leadId: "lead-1",
    status: "complete",
    createdAt: AT,
    updatedAt: AT,
    researcher: { name: "website", version: "homepage-v1" },
    sources: [
      { id: "lead-snapshot", type: "lead-snapshot", reference: "osm:node/1", fetchedAt: AT, title: "OpenStreetMap" },
      { id: "website-homepage", type: "website", reference: "https://www.crispmtl.com/", fetchedAt: AT, title: "CRISP" },
    ],
    facts: base,
    coverage: [{ area: "web", status: "covered", note: "n" }],
    limitations: [],
  };
}

const web = (value: unknown) => ({ value, sourceId: "website-homepage", kind: "observed" as const });

describe("without a profile, nothing changes", () => {
  it("still derives a complete fact set from the lead alone", () => {
    const business = deriveDemoSiteBusiness(lead());

    expect(business).toMatchObject({
      name: "Crisp",
      phone: "+1 514 934 3300",
      address: "1188 Rue Ontario Est",
      socialLinks: [],
      openingHours: [],
      bookingUrl: null,
      ownDescription: null,
      profileSourced: false,
    });
  });
});

describe("with a profile, the business's own material wins", () => {
  it("prefers a phone read on their own page over the directory's copy", () => {
    const business = deriveDemoSiteBusiness(
      lead(),
      profile({ "contact.phone": [{ value: "+1 514 000 1111", sourceId: "website-homepage", kind: "stated" }] }),
    );

    // The whole point: showing an owner a stale number loses the conversation
    // the demo exists to start.
    expect(business.phone).toBe("+1 514 000 1111");
  });

  it("falls back to the lead for anything the profile lacks", () => {
    const business = deriveDemoSiteBusiness(lead(), profile({}));
    expect(business.phone).toBe("+1 514 934 3300");
    expect(business.address).toBe("1188 Rue Ontario Est");
  });

  it("carries every social profile the business links to itself", () => {
    const business = deriveDemoSiteBusiness(
      lead(),
      profile({
        "web.socialLink": [
          web("https://www.instagram.com/crispmtl/"),
          web("https://www.facebook.com/CrispMontreal"),
          web("https://www.tiktok.com/@crispmtl"),
        ],
      }),
    );

    expect(business.socialLinks).toEqual([
      "https://www.instagram.com/crispmtl/",
      "https://www.facebook.com/CrispMontreal",
      "https://www.tiktok.com/@crispmtl",
    ]);
    expect(business.profileSourced).toBe(true);
  });

  it("carries published hours and a booking link", () => {
    const business = deriveDemoSiteBusiness(
      lead(),
      profile({
        "business.openingHours": [web("Mo-Fr 09:00-18:00"), web("Sa 10:00-16:00")],
        "web.bookingUrl": [web("https://getsquire.com/booking/brands/abc")],
      }),
    );

    expect(business.openingHours).toEqual(["Mo-Fr 09:00-18:00", "Sa 10:00-16:00"]);
    expect(business.bookingUrl).toBe("https://getsquire.com/booking/brands/abc");
  });

  it("drops duplicates rather than listing a link twice", () => {
    const business = deriveDemoSiteBusiness(
      lead(),
      profile({
        "web.socialLink": [
          web("https://www.instagram.com/crispmtl/"),
          web("https://www.instagram.com/crispmtl/"),
        ],
      }),
    );
    expect(business.socialLinks).toHaveLength(1);
  });

  it("treats a successful read as a website being listed", () => {
    // The lead says null; research proved a site answered. Both are facts a
    // source gave us, and the stronger one wins.
    const business = deriveDemoSiteBusiness(
      lead({ website: null }),
      profile({ "web.reachable": [web(true)] }),
    );
    expect(business.websiteListed).toBe(true);
  });

  it("reports profileSourced only when the profile actually added something", () => {
    expect(deriveDemoSiteBusiness(lead(), profile({})).profileSourced).toBe(false);
  });
});

describe("the generator still sees presence, never values", () => {
  const recommendations: AnalysisRecommendations = {
    recommendedSiteType: "one-page-site",
    recommendedPages: [],
    homepageSections: [],
    keySellingPoints: [],
    callsToAction: [],
    designDirection: { tone: "warm", palette: "warm-neutrals", imagery: "photography", typography: "classic" },
    draftPositioning: "p",
    businessSummary: "s",
    websiteOpportunity: "o",
  };

  it("passes booleans for the new facts and none of the URLs", () => {
    const business = deriveDemoSiteBusiness(
      lead(),
      profile({
        "web.socialLink": [web("https://www.instagram.com/crispmtl/")],
        "business.openingHours": [web("Mo-Fr 09:00-18:00")],
        "web.bookingUrl": [web("https://getsquire.com/booking/brands/abc")],
      }),
    );
    const input = toDemoGeneratorInput(business, recommendations);

    expect(input).toMatchObject({
      socialLinksListed: true,
      openingHoursListed: true,
      bookingUrlListed: true,
    });

    // A generator that never sees a URL cannot paraphrase or mistype one.
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain("instagram");
    expect(serialized).not.toContain("getsquire");
    expect(serialized).not.toContain("09:00");
  });

  it("reports the new facts as absent when there is no profile", () => {
    const input = toDemoGeneratorInput(deriveDemoSiteBusiness(lead()), recommendations);
    expect(input).toMatchObject({
      socialLinksListed: false,
      openingHoursListed: false,
      bookingUrlListed: false,
    });
  });
});
