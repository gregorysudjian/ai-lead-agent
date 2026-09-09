import { describe, expect, it } from "vitest";

import {
  MIN_CONFIDENCE,
  normalizeOverturePlace,
  normalizeOverturePlaces,
  shouldIngest,
  type OverturePlace,
} from "./normalize";

/**
 * The Overture normaliser.
 *
 * The fixtures below are real rows, copied from the Quebec slice, not invented
 * shapes -- a normaliser tested only against tidy data is a normaliser that
 * breaks on the first real batch.
 */

const OPTIONS = { fetchedAt: "2026-09-09T00:00:00.000Z", cityLabel: "Montreal" };

/** A real row, as the parquet yields it. */
function place(over: Partial<OverturePlace> = {}): OverturePlace {
  return {
    id: "08f2ab1c3d4e5f60123456789abcdef0",
    names: { primary: "Legendaire Coiffure" },
    categories: { primary: "hair_salon" },
    confidence: 0.5975598692893982,
    websites: null,
    phones: ["+14388820352"],
    addresses: [
      {
        freeform: "3886 Chem. d'Oka",
        locality: "St-Joseph-du-Lac",
        region: "QC",
        country: "CA",
      },
    ],
    ...over,
  };
}

describe("a real row", () => {
  it("becomes a DiscoveredBusiness", () => {
    expect(normalizeOverturePlace(place(), OPTIONS)).toEqual({
      externalId: "08f2ab1c3d4e5f60123456789abcdef0",
      source: "overture",
      name: "Legendaire Coiffure",
      category: "Hair salon",
      city: "St-Joseph-du-Lac",
      address: "3886 Chem. d'Oka",
      phone: "+14388820352",
      website: null,
      rating: null,
      reviewCount: null,
      openingHours: null,
      fetchedAt: "2026-09-09T00:00:00.000Z",
    });
  });

  it("uses the canonical category label, not Overture's spelling", () => {
    expect(normalizeOverturePlace(place(), OPTIONS)?.category).toBe("Hair salon");
  });

  it("carries the GERS id as the external reference", () => {
    // Overture's own identifier, stable across releases -- and, like the OSM
    // id, never our primary key.
    expect(normalizeOverturePlace(place(), OPTIONS)?.externalId).toBe(
      "08f2ab1c3d4e5f60123456789abcdef0",
    );
  });
});

describe("what Overture does not have stays null", () => {
  it("never invents a rating or a review count", () => {
    // Overture is not a review platform. Fabricating either would poison the
    // deterministic score with data no source supplied.
    const business = normalizeOverturePlace(place(), OPTIONS);
    expect(business?.rating).toBeNull();
    expect(business?.reviewCount).toBeNull();
  });

  it("never invents opening hours", () => {
    // A real gap against OSM, and precisely why an OSM lead and an Overture
    // lead for the same shop are both worth having.
    expect(normalizeOverturePlace(place(), OPTIONS)?.openingHours).toBeNull();
  });
});

describe("missing fields degrade rather than break", () => {
  it("falls back to the supplied city when an address has no locality", () => {
    const business = normalizeOverturePlace(
      place({ addresses: [{ freeform: "1 Rue Example", region: "QC" }] }),
      OPTIONS,
    );
    expect(business?.city).toBe("Montreal");
  });

  it("keeps a null address rather than guessing one", () => {
    expect(normalizeOverturePlace(place({ addresses: null }), OPTIONS)?.address).toBeNull();
  });

  it("keeps a null phone", () => {
    expect(normalizeOverturePlace(place({ phones: [] }), OPTIONS)?.phone).toBeNull();
  });

  it("takes the first usable entry from an array field", () => {
    const business = normalizeOverturePlace(
      place({ phones: ["", "   ", "+15145550100"], websites: ["https://salon.example"] }),
      OPTIONS,
    );
    expect(business?.phone).toBe("+15145550100");
    expect(business?.website).toBe("https://salon.example");
  });

  it("survives an address array holding junk", () => {
    const business = normalizeOverturePlace(
      place({ addresses: [null, "not an object", { locality: "Laval" }] as unknown[] }),
      OPTIONS,
    );
    expect(business?.city).toBe("Laval");
  });
});

describe("a listed website is preserved exactly", () => {
  it("keeps a directory link rather than erasing it", () => {
    // Whether a link is actually their own site is `social-hosts.ts`'s
    // judgement, made later and in one place. Erasing it here would hide the
    // fact from the operator entirely.
    const business = normalizeOverturePlace(
      place({ websites: ["https://www.pagesjaunes.ca/bus/Quebec/Montreal/salon/1.html"] }),
      OPTIONS,
    );
    expect(business?.website).toContain("pagesjaunes.ca");
  });

  it("does not repair a malformed URL", () => {
    expect(normalizeOverturePlace(place({ websites: ["salon.example"] }), OPTIONS)?.website).toBe(
      "salon.example",
    );
  });
});

describe("unusable rows are dropped", () => {
  it("drops a place with no name", () => {
    for (const names of [null, {}, { primary: "" }, { primary: "   " }, { primary: 42 }]) {
      expect(normalizeOverturePlace(place({ names: names as never }), OPTIONS), JSON.stringify(names))
        .toBeNull();
    }
  });

  it("drops a place with no id", () => {
    // Without an external reference there is nothing to dedupe or refresh on.
    for (const id of [null, undefined, "", "   ", 123]) {
      expect(normalizeOverturePlace(place({ id }), OPTIONS)).toBeNull();
    }
  });

  it("drops a trade we do not sell to", () => {
    for (const category of ["lake", "real_estate_agent", "car_wash", null]) {
      expect(
        normalizeOverturePlace(place({ categories: { primary: category } }), OPTIONS),
        String(category),
      ).toBeNull();
    }
  });

  it("never throws on a hostile or malformed row", () => {
    for (const bad of [
      {},
      { names: { primary: "<script>alert(1)</script>" }, id: "x".repeat(32), categories: { primary: "cafe" } },
      { id: 1, names: [], categories: [], addresses: "no", phones: 7, websites: {} },
    ]) {
      expect(() => normalizeOverturePlace(bad as OverturePlace, OPTIONS)).not.toThrow();
    }
  });

  it("does not sanitise a hostile name, it just carries it as text", () => {
    // Same rule as everywhere else: React escapes on render. Rewriting data at
    // the boundary would make the stored record disagree with the source.
    const business = normalizeOverturePlace(
      place({ names: { primary: "<script>alert(1)</script>" } }),
      OPTIONS,
    );
    expect(business?.name).toBe("<script>alert(1)</script>");
  });
});

describe("shouldIngest", () => {
  it("accepts a place at or above the threshold", () => {
    expect(shouldIngest(place({ confidence: MIN_CONFIDENCE }))).toBe(true);
    expect(shouldIngest(place({ confidence: 0.95 }))).toBe(true);
  });

  it("rejects a place below it", () => {
    // A low score often means the place may not exist. Approaching a business
    // that is not there wastes the operator's time and looks careless.
    expect(shouldIngest(place({ confidence: 0.49 }))).toBe(false);
    expect(shouldIngest(place({ confidence: 0.1 }))).toBe(false);
  });

  it("rejects a place with no confidence at all", () => {
    // Overture supplies one on every place, so its absence means the row is
    // not what we think it is. Fails closed.
    for (const confidence of [null, undefined, "high", Number.NaN]) {
      expect(shouldIngest(place({ confidence })), String(confidence)).toBe(false);
    }
  });

  it("honours a caller-supplied threshold", () => {
    expect(shouldIngest(place({ confidence: 0.35 }), 0.3)).toBe(true);
    expect(shouldIngest(place({ confidence: 0.35 }), 0.8)).toBe(false);
  });
});

describe("normalizeOverturePlaces", () => {
  it("drops unusable rows and keeps the rest", () => {
    const businesses = normalizeOverturePlaces(
      [place(), place({ names: null }), place({ id: "second", categories: { primary: "bakery" } })],
      OPTIONS,
    );
    expect(businesses).toHaveLength(2);
    expect(businesses.map((b) => b.category)).toEqual(["Hair salon", "Bakery"]);
  });

  it("collapses a repeated id", () => {
    // Overture can list the same GERS id twice when a query spans partitions.
    const businesses = normalizeOverturePlaces([place(), place(), place()], OPTIONS);
    expect(businesses).toHaveLength(1);
  });

  it("keeps two different businesses with the same name", () => {
    // A chain has many branches. Identity is the id, never the name.
    const businesses = normalizeOverturePlaces(
      [place({ id: "a" }), place({ id: "b" })],
      OPTIONS,
    );
    expect(businesses).toHaveLength(2);
  });

  it("returns an empty array for an empty batch", () => {
    expect(normalizeOverturePlaces([], OPTIONS)).toEqual([]);
  });
});
