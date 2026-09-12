import { describe, expect, it } from "vitest";

import type { DiscoveredBusiness } from "../types";
import { MONTREAL_ISLAND } from "./area";
import { googleMapsSearchUrl } from "./maps-link";
import {
  catalogHref,
  catalogReleases,
  DEFAULT_QUERY,
  listsNoOwnWebsite,
  parseCatalogQuery,
  searchCatalog,
  toSearchParams,
  type CatalogQuery,
} from "./search";
import type { CatalogBusiness } from "./types";

const AUG = "2026-08-19.0";
const SEP = "2026-09-16.0";

let counter = 0;
function biz(
  provider: Partial<DiscoveredBusiness> = {},
  patch: Partial<CatalogBusiness> = {},
): CatalogBusiness {
  counter += 1;
  return {
    id: `b${counter}`,
    municipality: "Montréal",
    location: null,
    firstSeenAt: "2026-08-20T00:00:00.000Z",
    lastSeenAt: "2026-08-20T00:00:00.000Z",
    firstSeenRelease: AUG,
    lastSeenRelease: AUG,
    leadId: null,
    googleCheck: null,
    provider: {
      externalId: `g${counter}`,
      source: "overture",
      name: `Business ${counter}`,
      category: "Hair salon",
      city: "Montréal",
      address: `${counter} Rue Wellington`,
      phone: "+15145550100",
      website: null,
      rating: null,
      reviewCount: null,
      openingHours: null,
      fetchedAt: "2026-08-20T00:00:00.000Z",
      ...provider,
    },
    ...patch,
  };
}

const q = (patch: Partial<CatalogQuery> = {}): CatalogQuery => ({ ...DEFAULT_QUERY, ...patch });

describe("reading the query from the URL", () => {
  it("defaults everything that is absent", () => {
    expect(parseCatalogQuery({}, MONTREAL_ISLAND)).toEqual(DEFAULT_QUERY);
  });

  it("reads every filter", () => {
    const query = parseCatalogQuery(
      {
        q: "  lumière ",
        trade: "barber",
        area: "Westmount",
        nosite: "1",
        phone: "1",
        new: "1",
        leads: "hide",
        gone: "1",
        sort: "name",
        page: "3",
      },
      MONTREAL_ISLAND,
    );
    expect(query).toEqual({
      q: "lumière",
      trade: "barber",
      area: "Westmount",
      noWebsite: true,
      hasPhone: true,
      fresh: true,
      leads: "hide",
      includeGone: true,
      sort: "name",
      page: 3,
    });
  });

  it("falls back instead of failing on a hand-edited URL", () => {
    const query = parseCatalogQuery(
      { trade: "restaurant", area: "Laval", leads: "everything", sort: "random", page: "-4", nosite: "yes" },
      MONTREAL_ISLAND,
    );
    // A restaurant is a real category but not one the catalog collects.
    expect(query).toEqual(DEFAULT_QUERY);
  });

  it("takes the first value of a repeated parameter and caps free text", () => {
    const query = parseCatalogQuery({ trade: ["barber", "tattoo"], q: "x".repeat(500) }, MONTREAL_ISLAND);
    expect(query.trade).toBe("barber");
    expect(query.q).toHaveLength(100);
  });

  it("round-trips through the URL, omitting defaults", () => {
    const query = q({ trade: "tattoo", noWebsite: true, page: 2 });
    const back = parseCatalogQuery(Object.fromEntries(toSearchParams(query)), MONTREAL_ISLAND);
    expect(back).toEqual(query);
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe("");
  });

  it("returns to page 1 when a filter changes, but not when the page does", () => {
    const query = q({ page: 5 });
    expect(catalogHref(query, { trade: "barber" })).toBe("/businesses?trade=barber");
    expect(catalogHref(query, { page: 6 })).toBe("/businesses?page=6");
    expect(catalogHref(DEFAULT_QUERY)).toBe("/businesses");
  });
});

describe("the website filter agrees with scoring", () => {
  it("counts no website and a social page alike, and a real site as a site", () => {
    expect(listsNoOwnWebsite(biz({ website: null }).provider)).toBe(true);
    expect(listsNoOwnWebsite(biz({ website: "https://www.facebook.com/salon" }).provider)).toBe(true);
    expect(listsNoOwnWebsite(biz({ website: "https://salon.example" }).provider)).toBe(false);
  });
});

describe("filters", () => {
  const catalog = [
    biz({ name: "Salon Lumière", category: "Hair salon", website: null }),
    biz({ name: "Barbier Nord", category: "Barber shop", website: "https://barbier.example" }),
    biz({ name: "Encre Noire", category: "Tattoo & piercing", phone: null }, { municipality: "Westmount" }),
    biz({ name: "Ongles Rose", category: "Nail salon" }, { leadId: "lead-1" }),
  ];

  const names = (query: CatalogQuery) =>
    searchCatalog(catalog, query).results.map((r) => r.business.provider.name).sort();

  it("filters by trade, using the label the snapshot carries", () => {
    expect(names(q({ trade: "barber" }))).toEqual(["Barbier Nord"]);
    expect(names(q({ trade: "tattoo" }))).toEqual(["Encre Noire"]);
  });

  it("filters by municipality", () => {
    expect(names(q({ area: "Westmount" }))).toEqual(["Encre Noire"]);
  });

  it("filters to no website of their own", () => {
    expect(names(q({ noWebsite: true }))).toEqual(["Encre Noire", "Ongles Rose", "Salon Lumière"]);
  });

  it("filters to a listed phone", () => {
    expect(names(q({ hasPhone: true }))).not.toContain("Encre Noire");
  });

  it("hides or isolates businesses already in leads", () => {
    expect(names(q({ leads: "hide" }))).not.toContain("Ongles Rose");
    expect(names(q({ leads: "only" }))).toEqual(["Ongles Rose"]);
  });

  it("matches text in the name or the street, ignoring accents and case", () => {
    expect(names(q({ q: "LUMIERE" }))).toEqual(["Salon Lumière"]);
    expect(names(q({ q: "wellington" }))).toHaveLength(4);
  });
});

describe("counts beside each trade and area", () => {
  const catalog = [
    biz({ category: "Hair salon", website: null }),
    biz({ category: "Hair salon", website: "https://x.example" }),
    biz({ category: "Barber shop", website: null }, { municipality: "Westmount" }),
  ];

  it("counts each trade with every other filter applied, but not the trade itself", () => {
    // Choosing "barber" must not make the hair-salon chip read zero -- the
    // chip is showing what you would get by switching to it.
    const result = searchCatalog(catalog, q({ trade: "barber", noWebsite: true }));
    expect(result.tradeCounts["hair-salon"]).toBe(1);
    expect(result.tradeCounts.barber).toBe(1);
    expect(result.tradeCounts.tattoo).toBe(0);
  });

  it("counts each area with every other filter applied, largest first", () => {
    const result = searchCatalog(catalog, q({ area: "Westmount" }));
    expect(result.areaCounts).toEqual([
      { label: "Montréal", count: 2 },
      { label: "Westmount", count: 1 },
    ]);
  });
});

describe("ranking and paging", () => {
  it("puts businesses with no website of their own first", () => {
    const catalog = [
      biz({ name: "A with site", website: "https://a.example" }),
      biz({ name: "B without", website: null }),
    ];
    const [top] = searchCatalog(catalog, q()).results;
    expect(top.business.provider.name).toBe("B without");
  });

  it("pages and clamps an out-of-range page to the last", () => {
    const catalog = Array.from({ length: 30 }, () => biz());
    const result = searchCatalog(catalog, q({ page: 99 }), { pageSize: 24 });
    expect(result).toMatchObject({ total: 30, pageCount: 2, page: 2 });
    expect(result.results).toHaveLength(6);
  });

  it("reports one empty page rather than zero pages", () => {
    const result = searchCatalog([], q());
    expect(result).toMatchObject({ total: 0, pageCount: 1, page: 1, results: [] });
  });
});

describe("new and gone, across releases", () => {
  it("marks nothing new on the initial load", () => {
    const catalog = [biz(), biz()];
    const result = searchCatalog(catalog, q());
    expect(result.summary.newInLatest).toBe(0);
    expect(result.results.every((r) => !r.isNew)).toBe(true);
  });

  it("marks businesses first seen in the latest release as new", () => {
    const old = biz({ name: "Old" }, { lastSeenRelease: SEP });
    const fresh = biz({ name: "Fresh" }, { firstSeenRelease: SEP, lastSeenRelease: SEP });
    const result = searchCatalog([old, fresh], q({ fresh: true }));
    expect(result.results.map((r) => r.business.provider.name)).toEqual(["Fresh"]);
    expect(result.summary.newInLatest).toBe(1);
  });

  it("hides businesses the latest release no longer lists, unless asked", () => {
    const current = biz({ name: "Current" }, { lastSeenRelease: SEP });
    const gone = biz({ name: "Gone" }, { lastSeenRelease: AUG });

    expect(searchCatalog([current, gone], q()).results.map((r) => r.business.provider.name)).toEqual([
      "Current",
    ]);
    const all = searchCatalog([current, gone], q({ includeGone: true }));
    expect(all.total).toBe(2);
    expect(all.results.find((r) => r.business.provider.name === "Gone")?.isGone).toBe(true);
    expect(all.summary).toMatchObject({ total: 2, current: 1, gone: 1 });
  });

  it("reads the releases from the businesses themselves", () => {
    expect(catalogReleases([])).toEqual({ latest: null, baseline: null });
    expect(
      catalogReleases([biz({}, { firstSeenRelease: AUG, lastSeenRelease: SEP })]),
    ).toEqual({ latest: SEP, baseline: AUG });
  });
});

describe("the Google Maps link", () => {
  it("searches for the listing by name, street and district", () => {
    const url = googleMapsSearchUrl({ name: "Salon Lumière", address: "4500 Rue Wellington", city: "Verdun" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Salon Lumière, 4500 Rue Wellington, Verdun, QC"),
    );
  });

  it("skips a missing address rather than writing an empty part", () => {
    const url = googleMapsSearchUrl({ name: "Encre Noire", address: null, city: "Westmount" });
    expect(decodeURIComponent(url.split("query=")[1])).toBe("Encre Noire, Westmount, QC");
  });

  it("opens the exact listing once the Google check knows its place id", () => {
    const url = googleMapsSearchUrl({ name: "Encre Noire", address: null, city: "Westmount" }, "ChIJabc123-_xyz");
    expect(url.endsWith("&query_place_id=ChIJabc123-_xyz")).toBe(true);
  });
});

describe("hiding what the catalog does not offer", () => {
  it("hides chains, pharmacies and broken names, but never a lead", () => {
    const salon = biz({ name: "Salon Lumière" });
    const pharmacy = biz({ name: "Uniprix Clinique Maria Deich (Pharmacie affiliée)", category: "Beauty salon" });
    const chainLead = biz({ name: "SEPHORA", category: "Beauty salon" }, { leadId: "lead-1" });
    const junk = biz({ name: "6r5dxckulcvbol/.", category: "Beauty salon" });

    const result = searchCatalog([salon, pharmacy, chainLead, junk], q());
    const shown = result.results.map((item) => item.business.provider.name);

    expect(shown).toContain("Salon Lumière");
    expect(shown).toContain("SEPHORA");
    expect(shown).not.toContain("6r5dxckulcvbol/.");
    expect(shown.some((name) => name.startsWith("Uniprix"))).toBe(false);
    expect(result.summary.total).toBe(2);
  });
});
