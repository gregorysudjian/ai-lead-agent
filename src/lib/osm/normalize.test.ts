import { describe, expect, it } from "vitest";

import { findExistingLead } from "../dedupe";
import { classifyWebsite } from "../format";
import {
  buildOsmAddress,
  isUsableOsmElement,
  normalizeOsmElement,
  normalizeOsmElements,
  osmExternalId,
  osmObjectUrl,
  type OsmElement,
} from "./normalize";

const OPTIONS = {
  categoryLabel: "Hair salon",
  cityLabel: "Montreal",
  fetchedAt: "2026-09-05T12:00:00.000Z",
};

const element = (over: Partial<OsmElement> = {}): OsmElement => ({
  type: "node",
  id: 123,
  tags: { name: "Salon Test" },
  ...over,
});

describe("D. OSM element ids", () => {
  it("prefixes the element type so node/123 and way/123 differ", () => {
    expect(osmExternalId(element({ type: "node", id: 123 }))).toBe("node/123");
    expect(osmExternalId(element({ type: "way", id: 123 }))).toBe("way/123");
    expect(osmExternalId(element({ type: "relation", id: 123 }))).toBe("relation/123");
    expect(osmExternalId(element({ type: "node", id: 123 }))).not.toBe(
      osmExternalId(element({ type: "way", id: 123 })),
    );
  });

  it("rejects structurally invalid elements", () => {
    expect(isUsableOsmElement(null)).toBe(false);
    expect(isUsableOsmElement({})).toBe(false);
    expect(isUsableOsmElement({ type: "node" })).toBe(false);
    expect(isUsableOsmElement({ type: "planet", id: 1 })).toBe(false);
    expect(isUsableOsmElement({ type: "node", id: "1" })).toBe(false);
    expect(isUsableOsmElement({ type: "node", id: Number.NaN })).toBe(false);
    expect(isUsableOsmElement({ type: "node", id: 0 })).toBe(false);
    expect(isUsableOsmElement({ type: "node", id: 7 })).toBe(true);
  });
});

describe("E. business name", () => {
  it("keeps a real name", () => {
    expect(normalizeOsmElement(element({ tags: { name: "Coupe Nord" } }), OPTIONS)?.name)
      .toBe("Coupe Nord");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeOsmElement(element({ tags: { name: "  Coupe Nord  " } }), OPTIONS)?.name)
      .toBe("Coupe Nord");
  });

  it.each([[{}], [{ name: "" }], [{ name: "   " }], [{ shop: "hairdresser" }]])(
    "skips an element with no usable name: %j",
    (tags) => {
      expect(normalizeOsmElement(element({ tags: tags as Record<string, string> }), OPTIONS))
        .toBeNull();
    },
  );

  it("falls back through official_name and brand but never invents a name", () => {
    expect(normalizeOsmElement(element({ tags: { official_name: "Legal Name Inc" } }), OPTIONS)?.name)
      .toBe("Legal Name Inc");
    expect(normalizeOsmElement(element({ tags: { brand: "Chain Co" } }), OPTIONS)?.name)
      .toBe("Chain Co");
  });
});

describe("F. phone precedence", () => {
  it("prefers contact:phone over phone", () => {
    const b = normalizeOsmElement(
      element({ tags: { name: "X", "contact:phone": "+1 514 111 1111", phone: "+1 514 222 2222" } }),
      OPTIONS,
    );
    expect(b?.phone).toBe("+1 514 111 1111");
  });

  it.each([
    [{ phone: "+1 514 222 2222" }, "+1 514 222 2222"],
    [{ "contact:mobile": "+1 514 333 3333" }, "+1 514 333 3333"],
    [{ mobile: "+1 514 444 4444" }, "+1 514 444 4444"],
  ])("falls back through the documented order: %j", (tags, expected) => {
    expect(normalizeOsmElement(element({ tags: { name: "X", ...tags } }), OPTIONS)?.phone)
      .toBe(expected);
  });

  it("is null when absent or blank, and is never rewritten", () => {
    expect(normalizeOsmElement(element({ tags: { name: "X" } }), OPTIONS)?.phone).toBeNull();
    expect(normalizeOsmElement(element({ tags: { name: "X", phone: "   " } }), OPTIONS)?.phone)
      .toBeNull();
    // No country code invented, no digits reformatted.
    expect(normalizeOsmElement(element({ tags: { name: "X", phone: "514-555-0123" } }), OPTIONS)?.phone)
      .toBe("514-555-0123");
  });
});

describe("G/H. website precedence and semantics", () => {
  it("prefers contact:website over website", () => {
    const b = normalizeOsmElement(
      element({ tags: { name: "X", "contact:website": "https://a.example.com", website: "https://b.example.com" } }),
      OPTIONS,
    );
    expect(b?.website).toBe("https://a.example.com");
  });

  it("is null when the provider lists none", () => {
    expect(normalizeOsmElement(element({ tags: { name: "X" } }), OPTIONS)?.website).toBeNull();
    expect(normalizeOsmElement(element({ tags: { name: "X", website: "  " } }), OPTIONS)?.website)
      .toBeNull();
  });

  it.each([
    ["example.com"],
    ["www.example.com"],
    ["javascript:alert(1)"],
    ["not a url"],
  ])("keeps a malformed value %j NON-NULL and unrepaired", (raw) => {
    const b = normalizeOsmElement(element({ tags: { name: "X", website: raw } }), OPTIONS);
    expect(b?.website).toBe(raw);
    expect(b?.website).not.toBeNull();
  });

  it("never prepends a scheme", () => {
    const b = normalizeOsmElement(element({ tags: { name: "X", website: "example.com" } }), OPTIONS);
    expect(b?.website?.startsWith("https://")).toBe(false);
  });

  it("leaves link safety entirely to classifyWebsite", () => {
    const unsafe = normalizeOsmElement(
      element({ tags: { name: "X", website: "javascript:alert(1)" } }),
      OPTIONS,
    )!;
    // The parser kept it non-null; the safety layer refuses to link it.
    expect(unsafe.website).toBe("javascript:alert(1)");
    expect(classifyWebsite(unsafe.website).kind).toBe("unlinkable");

    const safe = normalizeOsmElement(
      element({ tags: { name: "X", website: "https://example.com" } }),
      OPTIONS,
    )!;
    expect(classifyWebsite(safe.website).kind).toBe("linkable");
    expect(classifyWebsite(null).kind).toBe("none");
  });
});

describe("I. address", () => {
  it("builds a readable address from complete tags", () => {
    expect(
      buildOsmAddress({
        "addr:housenumber": "4821",
        "addr:street": "Rue Saint-Denis",
        "addr:city": "Montréal",
        "addr:province": "QC",
        "addr:postcode": "H2J 2L4",
      }),
    ).toBe("4821 Rue Saint-Denis, Montréal, QC, H2J 2L4");
  });

  it("includes a unit when present", () => {
    expect(
      buildOsmAddress({ "addr:housenumber": "100", "addr:street": "Rue Sherbrooke", "addr:unit": "3B" }),
    ).toBe("100 Rue Sherbrooke, Unit 3B");
  });

  it("uses only the tags that exist, inventing nothing", () => {
    expect(buildOsmAddress({ "addr:housenumber": "12", "addr:street": "Rue Rachel" }))
      .toBe("12 Rue Rachel");
  });

  it.each([
    [{}],
    [{ "addr:city": "Montréal" }],
    [{ "addr:postcode": "H2J 2L4" }],
    [{ "addr:housenumber": "4821", "addr:city": "Montréal", "addr:postcode": "H2J 2L4" }],
  ])("returns null without both a house number and a street: %j", (tags) => {
    expect(buildOsmAddress(tags as Record<string, string>)).toBeNull();
  });

  it("never reverse-geocodes: coordinates do not produce an address", () => {
    const b = normalizeOsmElement(
      { type: "node", id: 1, tags: { name: "X" } } as OsmElement,
      OPTIONS,
    );
    expect(b?.address).toBeNull();
  });
});

describe("J/K/L/M. fixed provider semantics", () => {
  const business = normalizeOsmElement(
    element({
      tags: {
        name: "Salon Test",
        opening_hours: "Tu-Sa 10:00-19:00; Su off",
        phone: "+1 514 555 0100",
        cuisine: "irrelevant",
        wheelchair: "yes",
        "addr:street": "Rue Test",
      },
    }),
    OPTIONS,
  )!;

  it("J. rating and reviewCount are always null - never fabricated", () => {
    expect(business.rating).toBeNull();
    expect(business.reviewCount).toBeNull();
  });

  it("K. openingHours stays null even when raw opening_hours exists", () => {
    // Deliberate: OSM opening_hours is a rich syntax our model cannot express,
    // and a partial parser would render confident but wrong "Closed" days.
    expect(business.openingHours).toBeNull();
  });

  it("L. source is always osm", () => {
    expect(business.source).toBe("osm");
  });

  it("M. no raw OSM tag object is carried into the domain type", () => {
    const keys = Object.keys(business).sort();
    expect(keys).toEqual([
      "address", "category", "city", "externalId", "fetchedAt", "name",
      "openingHours", "phone", "rating", "reviewCount", "source", "website",
    ]);
    expect(JSON.stringify(business)).not.toContain("wheelchair");
    expect(JSON.stringify(business)).not.toContain("cuisine");
    expect(JSON.stringify(business)).not.toContain("opening_hours");
  });

  it("uses OUR canonical category and city labels, not OSM tag values", () => {
    expect(business.category).toBe("Hair salon");
    expect(business.city).toBe("Montreal");
  });

  it("stamps the supplied fetchedAt, keeping the function pure", () => {
    expect(business.fetchedAt).toBe("2026-09-05T12:00:00.000Z");
  });
});

describe("batch normalization", () => {
  it("drops exact duplicate objects by type + id", () => {
    const out = normalizeOsmElements(
      [
        { type: "node", id: 1, tags: { name: "A" } },
        { type: "node", id: 1, tags: { name: "A" } },
        { type: "way", id: 1, tags: { name: "B" } },
      ],
      OPTIONS,
    );
    expect(out.map((b) => b.externalId)).toEqual(["node/1", "way/1"]);
  });

  it("skips malformed and nameless elements without throwing", () => {
    const out = normalizeOsmElements(
      [null, {}, { type: "node", id: 2 }, { type: "node", id: 3, tags: { name: "Keep" } }, "junk"],
      OPTIONS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Keep");
  });

  it("keeps similarly-named businesses at different addresses separate", () => {
    const out = normalizeOsmElements(
      [
        { type: "node", id: 1, tags: { name: "Salon Nord", "addr:street": "Rue A" } },
        { type: "node", id: 2, tags: { name: "Salon Nord", "addr:street": "Rue B" } },
      ],
      OPTIONS,
    );
    expect(out).toHaveLength(2);
  });
});

describe("N. OSM source link validation", () => {
  it.each([
    ["node/123456789", "https://www.openstreetmap.org/node/123456789"],
    ["way/987654321", "https://www.openstreetmap.org/way/987654321"],
    ["relation/1634158", "https://www.openstreetmap.org/relation/1634158"],
  ])("builds a safe URL for %s", (id, expected) => {
    expect(osmObjectUrl(id)).toBe(expected);
  });

  it.each([
    ["123"], ["node/"], ["/123"], ["node/abc"], ["node/-1"], ["node/0"],
    ["planet/1"], ["node/1/2"], ["node/1?x=2"], ["javascript:alert(1)"],
    ["node/1 onmouseover=alert(1)"], [""], ["mock-mtl-salon-001"],
    ["https://evil.example.com/node/1"], ["node/01"],
  ])("returns null for malformed external id %j", (id) => {
    expect(osmObjectUrl(id)).toBeNull();
  });

  it("only ever produces openstreetmap.org URLs", () => {
    for (const id of ["node/1", "way/22", "relation/333"]) {
      expect(osmObjectUrl(id)!.startsWith("https://www.openstreetmap.org/")).toBe(true);
    }
  });
});

describe("address rule is deliberately strict (protects the dedupe key)", () => {
  it("A. street alone is not enough -> null", () => {
    expect(buildOsmAddress({ "addr:street": "Rue Wellington" })).toBeNull();
  });

  it("B. house number alone is not enough -> null", () => {
    expect(buildOsmAddress({ "addr:housenumber": "12" })).toBeNull();
  });

  it("C. house number + street is sufficient", () => {
    expect(buildOsmAddress({ "addr:housenumber": "12", "addr:street": "Rue Rachel" }))
      .toBe("12 Rue Rachel");
  });

  it("D. optional parts still format correctly when present", () => {
    expect(
      buildOsmAddress({
        "addr:housenumber": "4821",
        "addr:street": "Rue Saint-Denis",
        "addr:unit": "2",
        "addr:city": "Montréal",
        "addr:province": "QC",
        "addr:postcode": "H2J 2L4",
      }),
    ).toBe("4821 Rue Saint-Denis, Unit 2, Montréal, QC, H2J 2L4");
    expect(buildOsmAddress({ "addr:state": "QC", "addr:housenumber": "1", "addr:street": "Rue A" }))
      .toBe("1 Rue A, QC");
  });

  it.each([
    [{ "addr:street": "Rue Notre-Dame", "addr:postcode": "H3C 1K3" }],
    [{ "addr:street": "Rue Notre-Dame", "addr:city": "Montréal" }],
    [{ "addr:street": "Rue Notre-Dame", "addr:unit": "5" }],
    [{ "addr:housenumber": "", "addr:street": "Rue Notre-Dame" }],
    [{ "addr:housenumber": "   ", "addr:street": "Rue Notre-Dame" }],
    [{ "addr:housenumber": "12", "addr:street": "  " }],
  ])("a postcode, city or unit cannot substitute for a house number: %j", (tags) => {
    expect(buildOsmAddress(tags as Record<string, string>)).toBeNull();
  });

  it("E. two same-named businesses on the same street stay unmergeable", () => {
    // Both lack a house number, so both normalize to address: null. Our
    // secondary dedupe rule refuses to match when either address is null, so
    // these two remain separate leads rather than being falsely merged.
    const a = normalizeOsmElement(
      element({ type: "node", id: 1, tags: { name: "Salon Nord", "addr:street": "Rue Sherbrooke" } }),
      OPTIONS,
    )!;
    const b = normalizeOsmElement(
      element({ type: "node", id: 2, tags: { name: "Salon Nord", "addr:street": "Rue Sherbrooke" } }),
      OPTIONS,
    )!;

    expect(a.address).toBeNull();
    expect(b.address).toBeNull();
    expect(a.name).toBe(b.name);

    // Confirm the dedupe layer itself declines the match.
    const lead = {
      id: "lead-a", status: "new" as const,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      provider: a,
    };
    expect(findExistingLead([lead], b)).toBeNull();
  });

  it("but a full address still enables the legitimate re-listing match", () => {
    const a = normalizeOsmElement(
      element({ type: "node", id: 1, tags: { name: "Salon Nord", "addr:housenumber": "10", "addr:street": "Rue Sherbrooke" } }),
      OPTIONS,
    )!;
    const b = normalizeOsmElement(
      element({ type: "way", id: 99, tags: { name: "Salon Nord", "addr:housenumber": "10", "addr:street": "Rue Sherbrooke" } }),
      OPTIONS,
    )!;
    const lead = {
      id: "lead-a", status: "new" as const,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      provider: a,
    };
    expect(findExistingLead([lead], b)?.reason).toBe("name-and-address");
  });
});

describe("OSM element ids must be positive safe integers", () => {
  it.each([
    [1], [123], [476659876], [Number.MAX_SAFE_INTEGER],
  ])("accepts valid id %s", (id) => {
    expect(isUsableOsmElement({ type: "node", id })).toBe(true);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["negative large", -476659876],
    ["decimal", 123.45],
    ["decimal near-integer", 123.0000001],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["beyond safe integer range", Number.MAX_SAFE_INTEGER + 2],
    ["numeric string", "123"],
    ["null", null],
    ["undefined", undefined],
    ["object", {}],
  ])("rejects %s id", (_label, id) => {
    expect(isUsableOsmElement({ type: "node", id })).toBe(false);
  });

  it("rejects unknown element types", () => {
    for (const type of ["planet", "area", "NODE", "", null, 7]) {
      expect(isUsableOsmElement({ type, id: 1 })).toBe(false);
    }
  });

  it("skips malformed-id elements during batch normalization", () => {
    const out = normalizeOsmElements(
      [
        { type: "node", id: 0, tags: { name: "Zero" } },
        { type: "node", id: -5, tags: { name: "Negative" } },
        { type: "node", id: 1.5, tags: { name: "Decimal" } },
        { type: "node", id: Number.NaN, tags: { name: "NaN" } },
        { type: "node", id: Number.POSITIVE_INFINITY, tags: { name: "Infinity" } },
        { type: "node", id: Number.MAX_SAFE_INTEGER + 2, tags: { name: "Unsafe" } },
        { type: "node", id: 7, tags: { name: "Valid" } },
      ],
      OPTIONS,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Valid");
    expect(out[0].externalId).toBe("node/7");
  });

  it("never produces an externalId containing a decimal, sign or exponent", () => {
    const out = normalizeOsmElements(
      [{ type: "way", id: 987654321, tags: { name: "Valid" } }],
      OPTIONS,
    );
    expect(out[0].externalId).toBe("way/987654321");
    expect(out[0].externalId).toMatch(/^(node|way|relation)\/[1-9][0-9]*$/);
  });

  it("an id that survives validation always builds a usable OSM link", () => {
    for (const id of [1, 123, 476659876, Number.MAX_SAFE_INTEGER]) {
      const [business] = normalizeOsmElements(
        [{ type: "node", id, tags: { name: "X" } }],
        OPTIONS,
      );
      expect(osmObjectUrl(business.externalId)).not.toBeNull();
    }
  });
});
