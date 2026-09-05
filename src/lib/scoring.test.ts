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

describe("scoreLead - documented scenarios", () => {
  it("A. maximum-score lead scores 100 and is high priority", () => {
    const score = scoreLead(
      makeLead({ website: null, reviewCount: 250, rating: 4.8, phone: "+1 514-555-0100" }),
    );
    expect(score.total).toBe(100);
    expect(score.priority).toBe("high");
  });

  it("B. existing website with otherwise maximum signals scores 55 (medium)", () => {
    const score = scoreLead(
      makeLead({
        website: "https://example.com",
        reviewCount: 250,
        rating: 4.8,
        phone: "+1 514-555-0100",
      }),
    );
    expect(score.total).toBe(55);
    expect(score.priority).toBe("medium");
  });

  it("C. only the no-website-listed signal scores 45 (medium)", () => {
    const score = scoreLead(
      makeLead({ website: null, reviewCount: null, rating: null, phone: null }),
    );
    expect(score.total).toBe(45);
    expect(score.priority).toBe("medium");
  });

  it("D. low-signal lead with a website listed scores 0 (low)", () => {
    const score = scoreLead(
      makeLead({
        website: "https://example.com",
        reviewCount: 0,
        rating: 2.1,
        phone: null,
      }),
    );
    expect(score.total).toBe(0);
    expect(score.priority).toBe("low");
  });
});

describe("E. website signal is presence-based, not link-safety-based", () => {
  it("null website earns the full 45 points", () => {
    expect(points(makeLead({ website: null }), "website")).toBe(45);
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
    [null, 0], [0, 0], [1, 5], [4, 5], [5, 10], [19, 10],
    [20, 15], [49, 15], [50, 20], [99, 20],
    [100, 25], [199, 25], [200, 30], [10000, 30],
  ])("reviewCount %s -> %i points", (reviewCount, expected) => {
    expect(points(makeLead({ reviewCount }), "reviews")).toBe(expected);
  });

  it("treats a negative review count defensively as 0", () => {
    expect(points(makeLead({ reviewCount: -5 }), "reviews")).toBe(0);
  });

  it("says 'not listed' for null but 'no reviews' for zero", () => {
    const notListed = scoreLead(makeLead({ reviewCount: null })).factors[1];
    const zero = scoreLead(makeLead({ reviewCount: 0 })).factors[1];
    expect(notListed.reason).toBe("Review count not listed by provider");
    expect(zero.reason).toBe("No reviews listed by provider");
  });

  it("uses singular wording for exactly one review", () => {
    expect(scoreLead(makeLead({ reviewCount: 1 })).factors[1].reason).toBe(
      "1 review listed by provider",
    );
  });
});

describe("G. rating boundaries", () => {
  it.each([
    [null, 0], [0, 0], [3.49, 0], [3.5, 4], [3.99, 4],
    [4.0, 8], [4.39, 8], [4.4, 12], [4.69, 12], [4.7, 15], [5.0, 15],
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
    expect(scoreLead(makeLead({ rating: null })).factors[2].reason).toBe(
      "Rating not listed by provider",
    );
  });
});

describe("H. contactability", () => {
  it.each([
    [null, 0], ["", 0], ["   ", 0], ["\t\n ", 0],
    ["+1 514-555-0100", 10], ["514-555-0100", 10],
  ])("phone %j -> %i points", (phone, expected) => {
    expect(points(makeLead({ phone }), "contactability")).toBe(expected);
  });
});

describe("I. score range", () => {
  const values = {
    website: [null, "https://example.com", "javascript:alert(1)", ""],
    reviewCount: [null, -5, 0, 1, 50, 250, 1e9, Number.NaN],
    rating: [null, -1, 0, 3.5, 4.7, 5, 9.9, Number.NaN],
    phone: [null, "", "   ", "+1 514-555-0100"],
  } as const;

  it("never produces a total below 0 or above 100 across the full matrix", () => {
    let checked = 0;
    for (const website of values.website)
      for (const reviewCount of values.reviewCount)
        for (const rating of values.rating)
          for (const phone of values.phone) {
            const { total } = scoreLead(makeLead({ website, reviewCount, rating, phone }));
            expect(total).toBeGreaterThanOrEqual(0);
            expect(total).toBeLessThanOrEqual(MAX_SCORE);
            checked += 1;
          }
    expect(checked).toBe(4 * 8 * 8 * 4);
  });

  it("factor points never exceed their own maximum", () => {
    for (const factor of scoreLead(
      makeLead({ website: null, reviewCount: 1e9, rating: 5, phone: "x" }),
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
