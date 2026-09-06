import { describe, expect, it } from "vitest";

import {
  isUsableRating,
  isUsableReviewCount,
  MAX_SCORE,
  priorityForScore,
  rankLeads,
  scoreLead,
} from "./scoring";
import type { Lead, ProviderSnapshot } from "./types";

/** Build a lead with explicit provider fields. Nothing is inferred. */
function makeLead(provider: Partial<ProviderSnapshot>, id = "lead-1"): Lead {
  return {
    id,
    status: "new",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: {
      externalId: "ext-1",
      source: "mock",
      name: "Test Business",
      category: "hair salon",
      city: "Montreal",
      address: "1 Test Street",
      phone: null,
      website: null,
      rating: null,
      reviewCount: null,
      openingHours: null,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      ...provider,
    },
  };
}

const points = (lead: Lead, key: string) =>
  scoreLead(lead).factors.find((f) => f.key === key)!.points;

describe("scoreLead V2 - documented scenarios", () => {
  it("E. maximum possible valid lead scores 100 and is high priority", () => {
    // 50 website + 20 phone + 10 address + 15 reviews + 5 rating
    const score = scoreLead(
      makeLead({
        website: null, reviewCount: 250, rating: 4.8,
        phone: "+1 514-555-0100", address: "1 Test Street",
      }),
    );
    expect(score.total).toBe(100);
    expect(score.priority).toBe("high");
  });

  it("A. OSM-shaped lead: no website listed + phone + address scores 80 (high)", () => {
    // The case V1 could not reach: real providers supply no reputation data.
    const score = scoreLead(
      makeLead({
        website: null, phone: "+1 514-555-0100", address: "1 Test Street",
        rating: null, reviewCount: null,
      }),
    );
    expect(score.total).toBe(80);
    expect(score.priority).toBe("high");
  });

  it("B. no website listed + phone, no address scores 70 (high)", () => {
    const score = scoreLead(
      makeLead({
        website: null, phone: "+1 514-555-0100", address: null,
        rating: null, reviewCount: null,
      }),
    );
    expect(score.total).toBe(70);
    expect(score.priority).toBe("high");
  });

  it("a listed website costs the full 50-point signal even with max reputation", () => {
    const score = scoreLead(
      makeLead({
        website: "https://example.com", reviewCount: 250, rating: 4.8,
        phone: "+1 514-555-0100", address: "1 Test Street",
      }),
    );
    // 0 + 20 + 10 + 15 + 5
    expect(score.total).toBe(50);
    expect(score.priority).toBe("medium");
  });

  it("C. no website listed and nothing else known scores 50 (medium)", () => {
    // NOT "empty data scores zero": an absent website is itself the strongest
    // single signal in the rubric, worth 50 on its own.
    const score = scoreLead(
      makeLead({
        website: null, reviewCount: null, rating: null, phone: null, address: null,
      }),
    );
    expect(score.total).toBe(50);
    expect(score.priority).toBe("medium");
  });

  it("F. a lead with every field absent still scores 50 because website is null", () => {
    const score = scoreLead(
      makeLead({
        website: null, phone: null, address: null, rating: null, reviewCount: 0,
      }),
    );
    expect(score.total).toBe(50);
    expect(score.priority).toBe("medium");
  });

  it("D. website listed + phone + address, no reputation scores 30 (low)", () => {
    const score = scoreLead(
      makeLead({
        website: "https://example.com", phone: "+1 514-555-0100",
        address: "1 Test Street", rating: null, reviewCount: null,
      }),
    );
    expect(score.total).toBe(30);
    expect(score.priority).toBe("low");
  });

  it("a lead with a website and nothing else scores 0 (low)", () => {
    const score = scoreLead(
      makeLead({
        website: "https://example.com", reviewCount: 0, rating: 2.1,
        phone: null, address: null,
      }),
    );
    expect(score.total).toBe(0);
    expect(score.priority).toBe("low");
  });
});

describe("E. website signal is presence-based, not link-safety-based", () => {
  it("null website earns the full 50 points", () => {
    expect(points(makeLead({ website: null }), "website")).toBe(50);
  });

  it.each([
    ["a valid https URL", "https://example.com"],
    ["a valid http URL", "http://example.com"],
    ["an unsafe javascript: value", "javascript:alert(1)"],
    ["an unsafe data: value", "data:text/html,test"],
    ["a malformed value", "not a valid url"],
    ["an empty string", ""],
  ])("%s is non-null and therefore earns 0 website points", (_label, website) => {
    expect(points(makeLead({ website }), "website")).toBe(0);
  });

  it("distinguishes 'no website listed' from an unusable value in its reason", () => {
    const none = scoreLead(makeLead({ website: null })).factors.find(
      (f) => f.key === "website",
    )!;
    const broken = scoreLead(makeLead({ website: "javascript:alert(1)" })).factors.find(
      (f) => f.key === "website",
    )!;
    expect(none.reason).toBe("No website listed by provider");
    expect(broken.reason).not.toContain("No website listed");
  });
});

describe("F. review volume boundaries", () => {
  it.each([
    [null, 0], [0, 0], [1, 2], [4, 2], [5, 4], [19, 4],
    [20, 7], [49, 7], [50, 10], [99, 10],
    [100, 12], [199, 12], [200, 15], [10000, 15],
    [Number.MAX_SAFE_INTEGER, 15],
  ])("reviewCount %s -> %i points", (reviewCount, expected) => {
    expect(points(makeLead({ reviewCount }), "reviews")).toBe(expected);
  });

  it("treats a negative review count defensively as 0", () => {
    expect(points(makeLead({ reviewCount: -5 }), "reviews")).toBe(0);
  });

  it("says 'not listed' for null but 'no reviews' for zero", () => {
    const notListed = scoreLead(makeLead({ reviewCount: null })).factors[3];
    const zero = scoreLead(makeLead({ reviewCount: 0 })).factors[3];
    expect(notListed.reason).toBe("Review count not listed by provider");
    expect(zero.reason).toBe("No reviews listed by provider");
  });

  it("uses singular wording for exactly one review", () => {
    expect(scoreLead(makeLead({ reviewCount: 1 })).factors[3].reason).toBe(
      "1 review listed by provider",
    );
  });
});

describe("G. rating boundaries", () => {
  it.each([
    [null, 0], [0, 0], [3.49, 0], [3.5, 1], [3.99, 1],
    [4.0, 2], [4.39, 2], [4.4, 4], [4.69, 4], [4.7, 5], [5.0, 5],
  ])("rating %s -> %i points", (rating, expected) => {
    expect(points(makeLead({ rating }), "rating")).toBe(expected);
  });

  it.each([[5.1], [9.9], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "out-of-range rating %s scores 0 rather than being clamped upward",
    (rating) => {
      expect(points(makeLead({ rating }), "rating")).toBe(0);
    },
  );

  it("explains a missing rating without inventing one", () => {
    expect(scoreLead(makeLead({ rating: null })).factors[4].reason).toBe(
      "Rating not listed by provider",
    );
  });
});

describe("H. phone", () => {
  it.each([
    [null, 0], ["", 0], ["   ", 0], ["\t\n ", 0],
    ["+1 514-555-0100", 20], ["514-555-0100", 20],
  ])("phone %j -> %i points", (phone, expected) => {
    expect(points(makeLead({ phone }), "phone")).toBe(expected);
  });
});

describe("I. score range", () => {
  const values = {
    website: [null, "https://example.com", "javascript:alert(1)", ""],
    reviewCount: [null, -5, 0, 1, 50, 250, 1e9, Number.NaN],
    rating: [null, -1, 0, 3.5, 4.7, 5, 9.9, Number.NaN],
    phone: [null, "", "   ", "+1 514-555-0100"],
    address: [null, "", "1 Test Street"],
  } as const;

  it("never produces a total below 0 or above 100 across the full matrix", () => {
    let checked = 0;
    for (const website of values.website)
      for (const reviewCount of values.reviewCount)
        for (const rating of values.rating)
          for (const phone of values.phone)
            for (const address of values.address) {
              const { total } = scoreLead(
                makeLead({ website, reviewCount, rating, phone, address }),
              );
              expect(total).toBeGreaterThanOrEqual(0);
              expect(total).toBeLessThanOrEqual(MAX_SCORE);
              checked += 1;
            }
    expect(checked).toBe(4 * 8 * 8 * 4 * 3);
  });

  it("factor points never exceed their own maximum", () => {
    for (const factor of scoreLead(
      makeLead({ website: null, reviewCount: 1e9, rating: 5, phone: "x", address: "y" }),
    ).factors) {
      expect(factor.points).toBeLessThanOrEqual(factor.maxPoints);
      expect(factor.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("factor maximums sum to exactly 100", () => {
    const sum = scoreLead(makeLead({})).factors.reduce((t, f) => t + f.maxPoints, 0);
    expect(sum).toBe(MAX_SCORE);
  });
});

describe("priority bands", () => {
  it.each([
    [0, "low"], [39, "low"], [40, "medium"], [69, "medium"],
    [70, "high"], [100, "high"],
  ])("total %i -> %s", (total, expected) => {
    expect(priorityForScore(total)).toBe(expected);
  });
});

describe("J. purity", () => {
  it("does not mutate the lead or its provider snapshot", () => {
    const lead = makeLead({ website: null, reviewCount: 128, rating: 4.6, phone: "x" });
    const snapshot = structuredClone(lead);
    scoreLead(lead);
    expect(lead).toEqual(snapshot);
  });

  it("returns the same result for repeated calls on the same lead", () => {
    const lead = makeLead({ reviewCount: 128, rating: 4.6, phone: "x" });
    expect(scoreLead(lead)).toEqual(scoreLead(lead));
  });

  it("ignores application-owned fields entirely", () => {
    const asNew = makeLead({ website: null, reviewCount: 128, rating: 4.6 });
    const asReviewed: Lead = {
      ...asNew,
      status: "reviewed",
      updatedAt: "2030-06-06T12:00:00.000Z",
    };
    expect(scoreLead(asReviewed).total).toBe(scoreLead(asNew).total);
  });
});

describe("rankLeads", () => {
  it("orders by score descending", () => {
    const ranked = rankLeads([
      makeLead({ website: "https://a.example.com" }, "low"),
      makeLead({ website: null, reviewCount: 250, rating: 4.9, phone: "x" }, "high"),
      makeLead({ website: null }, "mid"),
    ]);
    expect(ranked.map((r) => r.lead.id)).toEqual(["high", "mid", "low"]);
  });

  it("breaks score ties by review count, then rating, then name", () => {
    // All four score 45 + 15 (reviews) = identical totals, forcing each tie-break.
    const base = { website: null, phone: null } as const;
    const ranked = rankLeads([
      makeLead({ ...base, reviewCount: 20, rating: 4.0, name: "B Salon" }, "b"),
      makeLead({ ...base, reviewCount: 20, rating: 4.0, name: "A Salon" }, "a"),
      makeLead({ ...base, reviewCount: 20, rating: 4.3, name: "Z Salon" }, "z"),
      makeLead({ ...base, reviewCount: 49, rating: 4.0, name: "Y Salon" }, "y"),
    ]);
    // y wins on reviews; z then wins on rating; a before b alphabetically.
    expect(ranked.map((r) => r.lead.id)).toEqual(["y", "z", "a", "b"]);
  });

  it("sorts a null review count below a zero review count", () => {
    const ranked = rankLeads([
      makeLead({ website: null, reviewCount: null, name: "A" }, "null-count"),
      makeLead({ website: null, reviewCount: 0, name: "B" }, "zero-count"),
    ]);
    expect(ranked.map((r) => r.lead.id)).toEqual(["zero-count", "null-count"]);
  });

  it("does not mutate the input array", () => {
    const leads = [
      makeLead({ website: "https://a.example.com" }, "low"),
      makeLead({ website: null }, "high"),
    ];
    const before = leads.map((l) => l.id);
    rankLeads(leads);
    expect(leads.map((l) => l.id)).toEqual(before);
  });

  it("is stable across repeated runs", () => {
    const leads = [
      makeLead({ website: null, reviewCount: 20, name: "B" }, "b"),
      makeLead({ website: null, reviewCount: 20, name: "A" }, "a"),
    ];
    expect(rankLeads(leads).map((r) => r.lead.id)).toEqual(
      rankLeads(leads).map((r) => r.lead.id),
    );
  });
});

describe("ranking tie-breaks reject unusable provider numbers", () => {
  /**
   * Ratings that score 0 for different reasons: 3.0 is a real rating below the
   * lowest band, 9.9 is impossible. Both contribute 0 points, so the totals tie
   * and the rating tie-break decides.
   *
   * The INVALID lead is named "A" and the valid one "Z" on purpose: if the
   * rating comparison stopped distinguishing them, the alphabetical tie-break
   * would put the invalid lead first and this test would fail. That keeps the
   * assertion meaningful rather than accidentally passing.
   */
  it("A. a valid 3.0 rating outranks an impossible 9.9 rating", () => {
    const ranked = rankLeads([
      makeLead(
        { website: null, reviewCount: 50, rating: 9.9, phone: null, name: "A Salon" },
        "invalid-rating",
      ),
      makeLead(
        { website: null, reviewCount: 50, rating: 3.0, phone: null, name: "Z Salon" },
        "valid-rating",
      ),
    ]);
    // Sanity: the totals really are tied, so the rating tie-break is reached.
    expect(ranked[0].score.total).toBe(ranked[1].score.total);
    expect(ranked.map((r) => r.lead.id)).toEqual(["valid-rating", "invalid-rating"]);
  });

  it.each([[9.9], [5.1], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "A2. a valid 0 rating outranks the invalid rating %s",
    (rating) => {
      const ranked = rankLeads([
        makeLead(
          { website: null, reviewCount: 50, rating, phone: null, name: "A Salon" },
          "invalid",
        ),
        makeLead(
          { website: null, reviewCount: 50, rating: 0, phone: null, name: "Z Salon" },
          "valid-zero",
        ),
      ]);
      expect(ranked[0].score.total).toBe(ranked[1].score.total);
      expect(ranked.map((r) => r.lead.id)).toEqual(["valid-zero", "invalid"]);
    },
  );

  it.each([[-5], [Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY]])(
    "B. a valid reviewCount of 0 outranks the invalid count %s",
    (reviewCount) => {
      const ranked = rankLeads([
        makeLead(
          { website: null, reviewCount, rating: null, phone: null, name: "A Salon" },
          "invalid",
        ),
        makeLead(
          { website: null, reviewCount: 0, rating: null, phone: null, name: "Z Salon" },
          "valid-zero",
        ),
      ]);
      expect(ranked[0].score.total).toBe(ranked[1].score.total);
      expect(ranked.map((r) => r.lead.id)).toEqual(["valid-zero", "invalid"]);
    },
  );

  it("B2. a valid reviewCount of 0 outranks a null review count", () => {
    const ranked = rankLeads([
      makeLead({ website: null, reviewCount: null, name: "A Salon" }, "null-count"),
      makeLead({ website: null, reviewCount: 0, name: "Z Salon" }, "valid-zero"),
    ]);
    expect(ranked.map((r) => r.lead.id)).toEqual(["valid-zero", "null-count"]);
  });

  it("C. no unusable value ever outranks a usable one in either tie-break", () => {
    const unusableRatings = [null, 9.9, 5.1, -1, Number.NaN, Number.POSITIVE_INFINITY];
    const unusableCounts = [null, -5, Number.NaN, Number.POSITIVE_INFINITY];

    for (const rating of unusableRatings) {
      const ranked = rankLeads([
        makeLead({ website: null, reviewCount: 10, rating, name: "A" }, "bad"),
        makeLead({ website: null, reviewCount: 10, rating: 0, name: "Z" }, "good"),
      ]);
      expect(ranked[0].lead.id).toBe("good");
    }

    for (const reviewCount of unusableCounts) {
      const ranked = rankLeads([
        makeLead({ website: null, reviewCount, rating: null, name: "A" }, "bad"),
        makeLead({ website: null, reviewCount: 0, rating: null, name: "Z" }, "good"),
      ]);
      expect(ranked[0].lead.id).toBe("good");
    }
  });

  it("C2. invalid values are not clamped into range for ranking", () => {
    // If 9.9 were clamped to 5, it would beat the genuinely excellent 4.9.
    const ranked = rankLeads([
      makeLead({ website: null, reviewCount: 50, rating: 9.9, name: "A" }, "impossible"),
      makeLead({ website: null, reviewCount: 50, rating: 4.9, name: "Z" }, "excellent"),
    ]);
    expect(ranked[0].lead.id).toBe("excellent");
    // And it earns no rating points either.
    expect(points(makeLead({ rating: 9.9 }), "rating")).toBe(0);
  });

  it("C3. scoring and ranking agree on what is usable", () => {
    for (const rating of [null, -0.1, 5.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isUsableRating(rating)).toBe(false);
      expect(points(makeLead({ rating }), "rating")).toBe(0);
    }
    for (const value of [0, 3.5, 4.9, 5]) expect(isUsableRating(value)).toBe(true);

    for (const count of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isUsableReviewCount(count)).toBe(false);
      expect(points(makeLead({ reviewCount: count }), "reviews")).toBe(0);
    }
    for (const value of [0, 1, 250]) expect(isUsableReviewCount(value)).toBe(true);
  });
});

describe("H2. address factor", () => {
  it.each([
    [null, 0], ["", 0], ["   ", 0],
    ["100 Rue Test", 10], ["100 Rue Test, Montreal, QC", 10],
  ])("address %j -> %i points", (address, expected) => {
    expect(points(makeLead({ address }), "address")).toBe(expected);
  });

  it("whitespace-only address earns nothing", () => {
    expect(points(makeLead({ address: "\t\n " }), "address")).toBe(0);
  });

  it("is described as a provider listing, not a quality claim", () => {
    const factor = scoreLead(makeLead({ address: "100 Rue Test" })).factors.find(
      (f) => f.key === "address",
    )!;
    expect(factor.reason).toBe("Address listed by provider");
    expect(factor.maxPoints).toBe(10);
  });
});

describe("V2 rubric shape", () => {
  it("has exactly five factors with the documented maximums", () => {
    const factors = scoreLead(makeLead({})).factors;
    expect(factors.map((f) => [f.key, f.maxPoints])).toEqual([
      ["website", 50],
      ["phone", 20],
      ["address", 10],
      ["reviews", 15],
      ["rating", 5],
    ]);
  });

  it("maximums sum to exactly 100", () => {
    expect(scoreLead(makeLead({})).factors.reduce((t, f) => t + f.maxPoints, 0)).toBe(100);
  });

  it("reputation is capped at 20 of 100, so it cannot dominate", () => {
    const factors = scoreLead(makeLead({})).factors;
    const reputation = factors
      .filter((f) => f.key === "reviews" || f.key === "rating")
      .reduce((t, f) => t + f.maxPoints, 0);
    expect(reputation).toBe(20);
  });

  it("never says a business HAS a website - only what the provider listed", () => {
    const listed = scoreLead(makeLead({ website: "https://example.com" })).factors[0];
    expect(listed.reason).toBe("Website listed by provider");
    expect(listed.reason).not.toMatch(/has a website|has no website|does not have/i);
    const absent = scoreLead(makeLead({ website: null })).factors[0];
    expect(absent.reason).toBe("No website listed by provider");
  });
});

describe("the score is provider-independent - source awards zero points", () => {
  const fields = {
    website: null,
    phone: "+1 514-555-0100",
    address: "1 Test Street",
    rating: 4.8,
    reviewCount: 250,
  } as const;

  it("mock, osm and google produce identical scores for identical fields", () => {
    const mock = scoreLead(makeLead({ ...fields, source: "mock" }));
    const osm = scoreLead(makeLead({ ...fields, source: "osm" }));
    const google = scoreLead(makeLead({ ...fields, source: "google" }));

    expect(mock.total).toBe(100);
    expect(osm.total).toBe(100);
    expect(google.total).toBe(100);
    expect(osm).toEqual(mock);
    expect(google).toEqual(mock);
  });

  it("holds for a sparse lead too", () => {
    const sparse = { website: null, phone: null, address: null, rating: null, reviewCount: null } as const;
    expect(scoreLead(makeLead({ ...sparse, source: "osm" })).total)
      .toBe(scoreLead(makeLead({ ...sparse, source: "mock" })).total);
  });

  it("no factor reason mentions the provider by name", () => {
    for (const source of ["mock", "osm", "google"] as const) {
      for (const factor of scoreLead(makeLead({ ...fields, source })).factors) {
        expect(factor.reason.toLowerCase()).not.toContain("openstreetmap");
        expect(factor.reason.toLowerCase()).not.toContain("google");
        expect(factor.reason.toLowerCase()).not.toContain("mock");
      }
    }
  });
});

describe("priority boundaries under V2", () => {
  it.each([
    [39, "low"], [40, "medium"], [69, "medium"], [70, "high"], [100, "high"],
  ])("total %i -> %s", (total, expected) => {
    expect(priorityForScore(total)).toBe(expected);
  });

  it("realistic combinations land in the intended bands", () => {
    // 50 + 20 + 10 = 80 high; 50 + 20 = 70 high; 50 = 50 medium; 20 + 10 = 30 low
    const combos: [Partial<Parameters<typeof makeLead>[0]>, number, string][] = [
      [{ website: null, phone: "x", address: "y" }, 80, "high"],
      [{ website: null, phone: "x", address: null }, 70, "high"],
      [{ website: null, phone: null, address: null }, 50, "medium"],
      [{ website: "https://e.example.com", phone: "x", address: "y" }, 30, "low"],
      [{ website: "https://e.example.com", phone: null, address: null }, 0, "low"],
    ];
    for (const [fieldsUnderTest, total, priority] of combos) {
      const score = scoreLead(makeLead({ rating: null, reviewCount: null, ...fieldsUnderTest }));
      expect(score.total).toBe(total);
      expect(score.priority).toBe(priority);
    }
  });
});
