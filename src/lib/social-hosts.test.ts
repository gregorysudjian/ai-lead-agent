import { describe, expect, it } from "vitest";

import { scoreLead } from "./scoring";
import {
  SOCIAL_PAGE_HOSTS,
  SOCIAL_PROFILE_HOSTS,
  isSocialProfileUrl,
} from "./social-hosts";
import type { Lead } from "./types";

const AT = "2026-09-07T12:00:00.000Z";

const lead = (website: string | null): Lead => ({
  id: "lead-1",
  status: "new",
  createdAt: AT,
  updatedAt: AT,
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Salon Test",
    category: "Hair salon",
    city: "Montreal",
    address: "1 Rue Test",
    phone: "+1 514 000 0000",
    website,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
  },
});

const websiteFactor = (website: string | null) =>
  scoreLead(lead(website)).factors.find((f) => f.key === "website")!;

describe("a social page is recognised as a page, not a website", () => {
  it("recognises the hosts a small business actually uses", () => {
    // Every one of these appeared as a "website" on a real lead, or is the
    // obvious neighbour of one that did.
    for (const url of [
      "https://www.facebook.com/letraditionnelbarbier/",
      "https://www.facebook.com/people/Salon-Profil-2001-Enr/100063703504356/",
      "https://instagram.com/someshop",
      "https://www.tiktok.com/@someshop",
      "https://linktr.ee/someshop",
      "https://www.yelp.ca/biz/someshop",
      "http://fb.me/someshop",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(true);
    }
  });

  it("matches a subdomain but not a lookalike domain", () => {
    expect(isSocialProfileUrl("https://business.facebook.com/shop")).toBe(true);
    // Not facebook.com. Treating it as one would be a guess.
    expect(isSocialProfileUrl("https://facebook.com.evil.example/shop")).toBe(false);
    expect(isSocialProfileUrl("https://notfacebook.com/shop")).toBe(false);
  });

  it("treats an unrecognised host as a real website", () => {
    // The safe direction: an unknown host must never be promoted into the
    // prospect pool on a guess.
    for (const url of [
      "https://ggbarbershop.com/",
      "https://www.crispmtl.com/",
      "https://some-agency-builder.example/shop",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(false);
    }
  });

  it("treats nothing, junk and non-http as not a social page", () => {
    for (const value of [null, "", "   ", "not a url", "javascript:alert(1)", "ftp://x.example"]) {
      expect(isSocialProfileUrl(value), String(value)).toBe(false);
    }
  });
});

describe("scoring stops counting a Facebook page as a website", () => {
  it("awards the full website signal when only a social page is listed", () => {
    const factor = websiteFactor("https://www.facebook.com/letraditionnelbarbier/");

    expect(factor.points).toBe(factor.maxPoints);
    // Its own reason: the UI must never render this as "no website listed",
    // because the provider did list something.
    expect(factor.reason).toContain("Only a social media page");
  });

  it("keeps the three cases distinct in their wording", () => {
    expect(websiteFactor(null).reason).toBe("No website listed by provider");
    expect(websiteFactor("https://ggbarbershop.com/").reason).toBe(
      "Website listed by provider",
    );
    expect(websiteFactor("https://facebook.com/shop").reason).toContain(
      "not a website",
    );
  });

  it("still scores a real website at zero", () => {
    expect(websiteFactor("https://ggbarbershop.com/").points).toBe(0);
  });

  it("moves a social-only business up the review order", () => {
    // The bug this fixes: seven real leads whose only web presence is a
    // Facebook page were losing the largest factor in the rubric and sinking.
    const social = scoreLead(lead("https://facebook.com/shop"));
    const real = scoreLead(lead("https://ggbarbershop.com/"));

    expect(social.total).toBeGreaterThan(real.total);
    expect(social.total).toBe(scoreLead(lead(null)).total);
  });
});

describe("the lead list and the score tell the same story", () => {
  it("labels a social-only listing distinctly from a real website", async () => {
    const { websiteBadgeLabel } = await import("./format");

    // The bug this pins: before, a Facebook page read "Website listed" on a
    // lead the score had ranked as a top prospect for having no website.
    expect(websiteBadgeLabel("https://www.facebook.com/letraditionnelbarbier/")).toBe(
      "Social page only",
    );
    expect(websiteBadgeLabel("https://ggbarbershop.com/")).toBe("Website listed");
    expect(websiteBadgeLabel(null)).toBe("No website listed");
    expect(websiteBadgeLabel("not a url")).toBe("Website value unusable");
  });

  it("keeps all four outcomes distinct from one another", async () => {
    const { websiteBadgeLabel } = await import("./format");
    const labels = [
      websiteBadgeLabel(null),
      websiteBadgeLabel("not a url"),
      websiteBadgeLabel("https://facebook.com/shop"),
      websiteBadgeLabel("https://ggbarbershop.com/"),
    ];
    expect(new Set(labels).size).toBe(4);
  });

  it("agrees with scoring on which listings are still prospects", async () => {
    const { websiteBadgeLabel } = await import("./format");

    for (const website of [null, "https://facebook.com/shop"]) {
      const factor = websiteFactor(website);
      // Full marks from scoring, and a label that does not claim a website.
      expect(factor.points, String(website)).toBe(factor.maxPoints);
      expect(websiteBadgeLabel(website), String(website)).not.toBe("Website listed");
    }

    expect(websiteFactor("https://ggbarbershop.com/").points).toBe(0);
    expect(websiteBadgeLabel("https://ggbarbershop.com/")).toBe("Website listed");
  });
});

describe("directory listings are not websites", () => {
  /**
   * These arrived from real data. Probing Overture's Montreal coverage found
   * Yellow Pages among the most common "websites" for salons and garages --
   * 532 businesses across six categories listed a link that was not their own
   * site, every one of them counted as already having a website and dropped
   * out of the prospect list.
   */
  it("recognises the Yellow Pages family", () => {
    for (const url of [
      "https://pj.ca/some-salon",
      "https://www.pagesjaunes.ca/bus/Quebec/Montreal/salon/1234.html",
      "https://yp.ca/listing",
      "https://www.yellowpages.ca/bus/x",
      "https://yellowpages.com/x",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(true);
    }
  });

  it("recognises other directories", () => {
    for (const url of ["https://411.ca/x", "https://foursquare.com/v/x", "https://tripadvisor.ca/x"]) {
      expect(isSocialProfileUrl(url), url).toBe(true);
    }
  });
});

describe("booking platforms are not websites", () => {
  it("recognises the booking pages salons actually use", () => {
    // A Fresha page takes appointments; it does not say who the business is.
    for (const url of [
      "https://www.fresha.com/a/salon-montreal",
      "https://gorendezvous.com/salon",
      "https://booksy.com/en-us/x",
      "https://setmore.com/x",
      "https://planity.com/x",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(true);
    }
  });

  it("recognises Google's auto-generated placeholder site", () => {
    // Google creates business.site pages FOR businesses that have none. It is
    // the strongest prospect signal in the whole list.
    expect(isSocialProfileUrl("https://my-salon.business.site")).toBe(true);
  });

  it("recognises a WhatsApp link", () => {
    expect(isSocialProfileUrl("https://wa.me/15145550100")).toBe(true);
  });
});

describe("a site built on a platform is still a site", () => {
  /**
   * The line this module must not cross. A business that built something on
   * Squarespace HAS a website -- it may be poor, and still worth a
   * conversation, but calling it "no website" is the same overstatement this
   * module exists to prevent, pointed the other way.
   */
  it("does not treat platform site builders as pages", () => {
    for (const url of [
      "https://salon.squarespace.com",
      "https://salon.wixsite.com/home",
      "https://salon.square.site",
      "https://sites.google.com/view/salon",
      "https://salon.godaddysites.com",
    ]) {
      expect(isSocialProfileUrl(url), url).toBe(false);
    }
  });

  it("still treats an unknown host as a real website", () => {
    // The module's standing rule: guessing the other way would quietly promote
    // businesses we know nothing about.
    expect(isSocialProfileUrl("https://salonbella.ca")).toBe(false);
  });
});

describe("the two lists answer two different questions", () => {
  /**
   * A regression guard for a real coupling bug.
   *
   * Booking hosts were added to the broad list -- correctly, because a salon
   * whose only web presence is a Fresha page is a prospect. But the research
   * extractor used that same list to decide which links on a business's page
   * are social profiles, and its social check returns BEFORE its booking
   * check. Every booking link was filed as a social profile and
   * `web.bookingUrl` silently vanished from every researched business.
   *
   * The same host gives opposite answers to the two questions, so one list
   * cannot serve both.
   */
  it("counts a booking page as not-their-website", () => {
    expect(isSocialProfileUrl("https://www.fresha.com/a/salon")).toBe(true);
  });

  it("does NOT count a booking page as a social profile", () => {
    // What the extractor asks. A Fresha link is a booking link.
    for (const host of ["fresha.com", "booksy.com", "gorendezvous.com", "setmore.com", "planity.com"]) {
      expect(SOCIAL_PROFILE_HOSTS, host).not.toContain(host);
      expect(SOCIAL_PAGE_HOSTS, host).toContain(host);
    }
  });

  it("does NOT count a directory as a social profile either", () => {
    for (const host of ["pj.ca", "yp.ca", "pagesjaunes.ca", "yellowpages.com"]) {
      expect(SOCIAL_PROFILE_HOSTS, host).not.toContain(host);
      expect(SOCIAL_PAGE_HOSTS, host).toContain(host);
    }
  });

  it("keeps genuine social hosts in both", () => {
    for (const host of ["facebook.com", "instagram.com", "linktr.ee"]) {
      expect(SOCIAL_PROFILE_HOSTS, host).toContain(host);
      expect(SOCIAL_PAGE_HOSTS, host).toContain(host);
    }
  });

  it("keeps the narrow list a strict subset of the broad one", () => {
    for (const host of SOCIAL_PROFILE_HOSTS) {
      expect(SOCIAL_PAGE_HOSTS, host).toContain(host);
    }
    expect(SOCIAL_PAGE_HOSTS.length).toBeGreaterThan(SOCIAL_PROFILE_HOSTS.length);
  });
});
