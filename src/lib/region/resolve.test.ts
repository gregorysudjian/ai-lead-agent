import { describe, expect, it } from "vitest";

import { normalizeTerm } from "../normalize";

import { COUNTRIES, SUBDIVISIONS } from "./registry";
import { chooseRegion, regionKey, resolveRegion, type KnownLocality } from "./resolve";

/**
 * The Region Resolver.
 *
 * Most of these assert the boring path works. The ones that matter are the
 * collisions: "CA" is Canada and California, and a resolver that silently
 * picks one will eventually search the wrong half of a continent.
 */

const MONTREAL: KnownLocality = {
  label: "Montreal",
  country: "CA",
  subdivision: "QC",
  aliases: ["montreal", "montréal", "ville de montreal"],
};

const ONTARIO_CA: KnownLocality = {
  label: "Ontario",
  country: "US",
  subdivision: "CA",
  aliases: ["ontario"],
};

describe("countries", () => {
  it("resolves a country by name and by code", () => {
    for (const input of ["United States", "USA", "us", "america", "united states of america"]) {
      const result = resolveRegion(input);
      expect(result.status, input).toBe("resolved");
      if (result.status !== "resolved") throw new Error("unreachable");
      expect(result.region.country).toBe("US");
      expect(result.region.kind).toBe("country");
      expect(result.region.subdivision).toBeNull();
    }
  });

  it("carries a bounding box wide enough to include Alaska and Hawaii", () => {
    const result = resolveRegion("United States");
    if (result.status !== "resolved") throw new Error("unreachable");
    const [west, south, , north] = result.region.bbox!;
    expect(west).toBeLessThan(-170); // Aleutians
    expect(south).toBeLessThan(20); // Hawaii
    expect(north).toBeGreaterThan(70); // north slope
  });
});

describe("subdivisions", () => {
  it("resolves a state by full name and by code", () => {
    for (const input of ["Texas", "texas", "TX", "tx", "  Texas  "]) {
      const result = resolveRegion(input);
      expect(result.status, input).toBe("resolved");
      if (result.status !== "resolved") throw new Error("unreachable");
      expect(result.region.subdivision).toBe("TX");
      expect(result.region.country).toBe("US");
      expect(result.region.kind).toBe("subdivision");
    }
  });

  it("resolves a Canadian province, accents and all", () => {
    for (const input of ["Quebec", "québec", "QC", "pq"]) {
      const result = resolveRegion(input);
      expect(result.status, input).toBe("resolved");
      if (result.status !== "resolved") throw new Error("unreachable");
      expect(result.region.subdivision).toBe("QC");
      expect(result.region.country).toBe("CA");
    }
  });

  it("covers every US state, DC and the inhabited territories", () => {
    // 50 states + DC + 5 territories.
    expect(SUBDIVISIONS.filter((s) => s.country === "US")).toHaveLength(56);
    expect(SUBDIVISIONS.filter((s) => s.country === "CA")).toHaveLength(13);
  });
});

describe("localities", () => {
  it("resolves a known locality, keeping its parent codes", () => {
    const result = resolveRegion("Montreal", { localities: [MONTREAL] });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error("unreachable");
    expect(result.region).toEqual({
      kind: "locality",
      label: "Montreal",
      country: "CA",
      subdivision: "QC",
      locality: "Montreal",
      bbox: null,
    });
  });

  it("matches a locality through its accented spelling", () => {
    expect(resolveRegion("Montréal", { localities: [MONTREAL] }).status).toBe("resolved");
  });

  it("says plainly that city search needs the region import, when it has none", () => {
    // The honest failure. A resolver with no locality data must not imply the
    // city does not exist -- it must say it cannot look one up yet.
    const result = resolveRegion("Austin");
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") throw new Error("unreachable");
    expect(result.reason).toMatch(/region data import/i);
  });
});

describe("collisions are reported, never guessed", () => {
  it('treats "CA" as ambiguous between Canada and California', () => {
    // The one everybody hits. Silently preferring either is how a search for
    // California ends up covering three thousand miles of Canada.
    const result = resolveRegion("CA");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") throw new Error("unreachable");

    const labels = result.candidates.map((c) => c.label).sort();
    expect(labels).toEqual(["California", "Canada"]);
  });

  it("offers the smaller area first", () => {
    // A user who types something that could be a city or a country almost
    // always means the city, so it leads the list a prompt renders.
    const result = resolveRegion("Ontario", { localities: [ONTARIO_CA] });
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") throw new Error("unreachable");
    expect(result.candidates[0].kind).toBe("locality");
    expect(result.candidates[1].kind).toBe("subdivision");
  });

  it("distinguishes the two Ontarios by their codes, not their names", () => {
    const result = resolveRegion("Ontario", { localities: [ONTARIO_CA] });
    if (result.status !== "ambiguous") throw new Error("unreachable");

    const city = result.candidates.find((c) => c.kind === "locality")!;
    const province = result.candidates.find((c) => c.kind === "subdivision")!;
    expect(city.country).toBe("US");
    expect(city.subdivision).toBe("CA");
    expect(province.country).toBe("CA");
    expect(province.subdivision).toBe("ON");
  });

  it("resolves cleanly when only one reading exists", () => {
    // Ambiguity handling must not make the common case ceremonious.
    expect(resolveRegion("Texas").status).toBe("resolved");
    expect(resolveRegion("Canada").status).toBe("resolved");
  });
});

describe("chooseRegion", () => {
  it("narrows an ambiguous result to the candidate that was offered", () => {
    const result = resolveRegion("CA");
    if (result.status !== "ambiguous") throw new Error("unreachable");

    const california = chooseRegion(result, {
      kind: "subdivision",
      country: "US",
      subdivision: "CA",
      locality: null,
    });
    expect(california?.label).toBe("California");
  });

  it("refuses a pick that was never offered", () => {
    // A stale form post must not resolve to something the user never saw.
    const result = resolveRegion("CA");
    if (result.status !== "ambiguous") throw new Error("unreachable");

    expect(
      chooseRegion(result, {
        kind: "subdivision",
        country: "US",
        subdivision: "TX",
        locality: null,
      }),
    ).toBeNull();
  });

  it("returns null for a resolution that was never ambiguous", () => {
    const result = resolveRegion("Texas");
    expect(
      chooseRegion(result, { kind: "subdivision", country: "US", subdivision: "TX", locality: null }),
    ).toBeNull();
  });
});

describe("rejects what it cannot place", () => {
  it("rejects empty and whitespace input", () => {
    for (const input of ["", "   ", "\t"]) {
      const result = resolveRegion(input);
      expect(result.status, JSON.stringify(input)).toBe("unsupported");
    }
  });

  it("rejects a country outside the covered scope", () => {
    // Real places, deliberately not covered. Saying so is better than a
    // partial answer built from a name that happens to collide.
    for (const input of ["France", "Mexico", "Australia"]) {
      expect(resolveRegion(input).status, input).toBe("unsupported");
    }
  });

  it("rejects free text without throwing", () => {
    for (const input of ["asdf", "<script>", "1234", "Tex", "Texa"]) {
      expect(() => resolveRegion(input)).not.toThrow();
      expect(resolveRegion(input).status, input).toBe("unsupported");
    }
  });

  it("does not match on a prefix", () => {
    // "Tex" is not Texas. Loose matching here would make "CA" vs "California"
    // vastly more ambiguous than it already is.
    expect(resolveRegion("Tex").status).toBe("unsupported");
    expect(resolveRegion("Can").status).toBe("unsupported");
  });
});

describe("regionKey", () => {
  it("identifies an area by its codes, not its label", () => {
    const texas = resolveRegion("Texas");
    if (texas.status !== "resolved") throw new Error("unreachable");
    expect(regionKey(texas.region)).toBe("US:TX");
  });

  it("omits empty trailing levels", () => {
    const canada = resolveRegion("Canada");
    if (canada.status !== "resolved") throw new Error("unreachable");
    expect(regionKey(canada.region)).toBe("CA");
  });

  it("distinguishes a city from its province", () => {
    const montreal = resolveRegion("Montreal", { localities: [MONTREAL] });
    if (montreal.status !== "resolved") throw new Error("unreachable");
    expect(regionKey(montreal.region)).toBe("CA:QC:Montreal");
  });

  it("is stable for the same region", () => {
    const a = resolveRegion("TX");
    const b = resolveRegion("Texas");
    if (a.status !== "resolved" || b.status !== "resolved") throw new Error("unreachable");
    expect(regionKey(a.region)).toBe(regionKey(b.region));
  });
});

describe("registry integrity", () => {
  it("gives every subdivision a unique code within its country", () => {
    for (const country of COUNTRIES) {
      const codes = SUBDIVISIONS.filter((s) => s.country === country.code).map((s) => s.code);
      expect(new Set(codes).size, country.code).toBe(codes.length);
    }
  });

  it("lists no duplicate aliases within one entry", () => {
    // "Quebec" is both a generated label alias and an explicit extra one. A
    // duplicate would make an entry look twice as matchable to a future
    // scoring change.
    for (const subdivision of SUBDIVISIONS) {
      expect(new Set(subdivision.aliases).size, subdivision.code).toBe(
        subdivision.aliases.length,
      );
    }
  });

  it("keeps every alias normalised, so a lookup can never miss one", () => {
    // Aliases are compared after `normalizeTerm`. One stored with an accent or
    // a capital would simply never match, silently.
    for (const entry of [...SUBDIVISIONS, ...COUNTRIES]) {
      for (const alias of entry.aliases) {
        expect(normalizeTerm(alias), `${entry.label}: ${alias}`).toBe(alias);
      }
    }
  });
});
