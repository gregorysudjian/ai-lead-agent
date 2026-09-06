import { describe, expect, it } from "vitest";

import {
  resolveSupportedCategory,
  SUPPORTED_CATEGORIES,
  supportedCategoryLabels,
} from "./categories";
import { resolveSupportedCity, SUPPORTED_CITIES, supportedCityLabels } from "./cities";
import { buildOverpassQuery, OVERPASS_QUERY_LIMIT } from "./query";

describe("A. city aliases", () => {
  it.each([
    ["Montreal"], ["Montréal"], ["montreal"], ["MONTRÉAL"],
    ["  Montreal  "], ["montreal   qc"], ["Ville de Montreal"],
  ])("resolves %j to the canonical Montreal entry", (input) => {
    const city = resolveSupportedCity(input);
    expect(city?.key).toBe("montreal");
    expect(city?.label).toBe("Montreal");
  });

  it("accented and unaccented spellings resolve to the SAME object", () => {
    expect(resolveSupportedCity("Montréal")).toBe(resolveSupportedCity("Montreal"));
  });

  it.each([["Toronto"], ["Laval"], ["Paris"], [""], ["   "], ["Montreal West"]])(
    "rejects unsupported city %j",
    (input) => {
      expect(resolveSupportedCity(input)).toBeNull();
    },
  );

  it("pins Montreal to the city boundary, not the wider region", () => {
    const montreal = resolveSupportedCity("Montreal");
    // Verified against live OSM: relation 1634158 is admin_level=8, wikidata Q340.
    // Q1474984 / relation 1571328 is the admin_level=5 region and is NOT this.
    expect(montreal?.wikidataId).toBe("Q340");
    expect(montreal?.osmRelationId).toBe(1634158);
  });

  it("exposes labels for client-safe validation messages", () => {
    expect(supportedCityLabels()).toEqual(["Montreal"]);
  });
});

describe("B. category aliases", () => {
  it.each([
    ["hair salon", "hair-salon"], ["Hair Salons", "hair-salon"],
    ["HAIRDRESSER", "hair-salon"], ["  coiffure ", "hair-salon"],
    ["barber", "barber"], ["Barber Shop", "barber"], ["barbershop", "barber"],
    ["cafe", "cafe"], ["café", "cafe"], ["Cafés", "cafe"], ["coffee shop", "cafe"],
    ["dentist", "dentist"], ["Dental Clinic", "dentist"],
    ["nail salon", "nail-salon"], ["restaurants", "restaurant"],
    ["pharmacies", "pharmacy"], ["bakeries", "bakery"],
    ["fitness center", "gym"], ["fitness centre", "gym"],
    ["flower shop", "florist"], ["auto repair", "car-repair"],
  ])("resolves %j to category %s", (input, key) => {
    expect(resolveSupportedCategory(input)?.key).toBe(key);
  });

  it.each([["tattoo parlour"], ["laundromat"], [""], ["   "], ["hair"]])(
    "rejects unsupported category %j",
    (input) => {
      expect(resolveSupportedCategory(input)).toBeNull();
    },
  );

  it("every category has a key, label, aliases and at least one selector", () => {
    for (const category of SUPPORTED_CATEGORIES) {
      expect(category.key).toMatch(/^[a-z-]+$/);
      expect(category.label.length).toBeGreaterThan(0);
      expect(category.aliases.length).toBeGreaterThan(0);
      expect(category.selectors.length).toBeGreaterThan(0);
    }
  });

  it("category keys and city keys are unique", () => {
    const keys = SUPPORTED_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const cityKeys = SUPPORTED_CITIES.map((c) => c.key);
    expect(new Set(cityKeys).size).toBe(cityKeys.length);
  });

  it("dentist carries both widely-used OSM selectors", () => {
    const dentist = resolveSupportedCategory("dentist");
    expect(dentist?.selectors).toEqual([
      { amenity: "dentist" },
      { healthcare: "dentist" },
    ]);
  });

  it("barber refines hairdresser rather than using the near-unused shop=barber", () => {
    expect(resolveSupportedCategory("barber")?.selectors).toEqual([
      { shop: "hairdresser", hairdresser: "barber" },
    ]);
  });

  it("nail salon uses beauty=nails rather than shop=nail_salon", () => {
    expect(resolveSupportedCategory("nail salon")?.selectors).toEqual([
      { shop: "beauty", beauty: "nails" },
    ]);
  });

  it("exposes labels for client-safe validation messages", () => {
    expect(supportedCategoryLabels()).toContain("Hair salon");
    expect(supportedCategoryLabels().length).toBe(SUPPORTED_CATEGORIES.length);
  });
});

describe("C. query safety", () => {
  const city = resolveSupportedCity("Montreal")!;

  it("builds a bounded query pinned by Wikidata id", () => {
    const query = buildOverpassQuery(city, resolveSupportedCategory("hair salon")!);
    expect(query).toContain("[out:json][timeout:25];");
    expect(query).toContain('area["boundary"="administrative"]["wikidata"="Q340"]->.searchArea;');
    expect(query).toContain('node["shop"="hairdresser"](area.searchArea);');
    expect(query).toContain('way["shop"="hairdresser"](area.searchArea);');
    expect(query).toContain('relation["shop"="hairdresser"](area.searchArea);');
    expect(query).toContain(`out center tags ${OVERPASS_QUERY_LIMIT};`);
    // 60 shown, 61 requested: the extra element is the truncation sentinel.
    expect(OVERPASS_QUERY_LIMIT).toBe(61);
  });

  it("requests centre points and tags, never full geometry", () => {
    const query = buildOverpassQuery(city, resolveSupportedCategory("cafe")!);
    expect(query).toContain("out center tags");
    expect(query).not.toContain("out geom");
    expect(query).not.toContain("out body");
    expect(query).not.toContain("out meta");
  });

  it("emits one clause trio per selector for multi-selector categories", () => {
    const query = buildOverpassQuery(city, resolveSupportedCategory("dentist")!);
    expect(query).toContain('node["amenity"="dentist"](area.searchArea);');
    expect(query).toContain('node["healthcare"="dentist"](area.searchArea);');
    // 2 selectors x 3 element types
    expect(query.split("(area.searchArea);").length - 1).toBe(6);
  });

  it("ANDs the tags within a single selector", () => {
    const query = buildOverpassQuery(city, resolveSupportedCategory("barber")!);
    expect(query).toContain('node["shop"="hairdresser"]["hairdresser"="barber"](area.searchArea);');
  });

  /**
   * The important guarantee: hostile text cannot become executable Overpass QL,
   * because it never resolves to a registry entry and so no query is ever built.
   */
  it.each([
    ['");out;node["shop"="hairdresser"];//'],
    ["hair salon\"](area.searchArea);out count;//"],
    ["*"],
    ["[out:json];relation;out;"],
    ["'; DROP TABLE leads; --"],
    ["hairdresser\"]->.x;("],
  ])("malicious category text %j resolves to nothing and builds no query", (evil) => {
    expect(resolveSupportedCategory(evil)).toBeNull();
  });

  it.each([['Montreal"]->.x;('], ["*"], ["Q340"], ['" or "1"="1']])(
    "malicious city text %j resolves to nothing",
    (evil) => {
      expect(resolveSupportedCity(evil)).toBeNull();
    },
  );

  it("only registry-derived tokens ever appear in a query", () => {
    for (const category of SUPPORTED_CATEGORIES) {
      const query = buildOverpassQuery(city, category);
      // Every quoted token must be a plain tag-safe identifier.
      for (const token of query.match(/"[^"]*"/g) ?? []) {
        expect(token.slice(1, -1)).toMatch(/^[A-Za-z0-9_:.-]+$/);
      }
    }
  });

  it("rejects out-of-range timeout and limit values", () => {
    const category = resolveSupportedCategory("cafe")!;
    expect(() => buildOverpassQuery(city, category, { timeoutSeconds: 0 })).toThrow();
    expect(() => buildOverpassQuery(city, category, { timeoutSeconds: 9999 })).toThrow();
    expect(() => buildOverpassQuery(city, category, { limit: 0 })).toThrow();
    expect(() => buildOverpassQuery(city, category, { limit: 100000 })).toThrow();
  });

  it("is deterministic", () => {
    const category = resolveSupportedCategory("bakery")!;
    expect(buildOverpassQuery(city, category)).toBe(buildOverpassQuery(city, category));
  });
});
