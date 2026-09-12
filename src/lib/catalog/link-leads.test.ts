import { describe, expect, it } from "vitest";

import type { DiscoveredBusiness, Lead } from "../types";
import { linkLeadsToCatalog } from "./link-leads";
import type { CatalogBusiness } from "./types";

const AT = "2026-09-01T00:00:00.000Z";

function snapshot(patch: Partial<DiscoveredBusiness>): DiscoveredBusiness {
  return {
    externalId: "x",
    source: "overture",
    name: "Name",
    category: "Hair salon",
    city: "Montréal",
    address: null,
    phone: null,
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
    ...patch,
  };
}

function business(id: string, patch: Partial<DiscoveredBusiness>, leadId: string | null = null): CatalogBusiness {
  return {
    id,
    municipality: "Montréal",
    location: null,
    firstSeenAt: AT,
    lastSeenAt: AT,
    firstSeenRelease: "r",
    lastSeenRelease: "r",
    leadId,
    googleCheck: null,
    provider: snapshot(patch),
  };
}

function lead(id: string, patch: Partial<DiscoveredBusiness>): Lead {
  return { id, status: "new", createdAt: AT, updatedAt: AT, provider: snapshot(patch) };
}

describe("linking the leads that predate the catalog", () => {
  it("links an OpenStreetMap lead to its Overture record despite a differently written address", () => {
    // A real pair from the stored leads and the extract.
    const catalog = [business("b1", { externalId: "gers-1", name: "CAJH Maîtres Coiffeurs", address: "743 Atwater Ave" })];
    const leads = [lead("l1", { source: "osm", externalId: "node/1", name: "CAJH Maîtres Coiffeurs", address: "743 Avenue Atwater" })];
    expect(linkLeadsToCatalog(catalog, leads)).toEqual(new Map([["b1", "l1"]]));
  });

  it("links on the same provider id even when the address changed", () => {
    const catalog = [business("b1", { externalId: "gers-1", name: "Salon A", address: "1 Rue Neuve" })];
    const leads = [lead("l1", { externalId: "gers-1", name: "Salon A", address: "99 Rue Vieille" })];
    expect(linkLeadsToCatalog(catalog, leads).get("b1")).toBe("l1");
  });

  it("does not link on a name alone", () => {
    const catalog = [business("b1", { name: "Coupe Ozone", address: "1294 Ontario St E" })];
    const leads = [lead("l1", { source: "osm", externalId: "n", name: "Coupe Ozone", address: "4828 Rue Saint-Denis" })];
    expect(linkLeadsToCatalog(catalog, leads).size).toBe(0);
  });

  it("does not link when the lead has no address to compare", () => {
    const catalog = [business("b1", { name: "Studio Trendz", address: "9505 Bd des Galeries d'Anjou" })];
    const leads = [lead("l1", { source: "osm", externalId: "n", name: "Studio Trendz", address: null })];
    expect(linkLeadsToCatalog(catalog, leads).size).toBe(0);
  });
});

describe("ambiguity links nothing", () => {
  it("skips a lead that matches two catalog businesses", () => {
    const catalog = [
      business("b1", { externalId: "g1", name: "Salon X", address: "100 Rue Wellington" }),
      business("b2", { externalId: "g2", name: "Salon X", address: "100 Wellington St" }),
    ];
    const leads = [lead("l1", { source: "osm", externalId: "n", name: "Salon X", address: "100 rue Wellington" })];
    expect(linkLeadsToCatalog(catalog, leads).size).toBe(0);
  });

  it("skips a business that two leads both claim", () => {
    const catalog = [business("b1", { externalId: "g1", name: "Salon X", address: "100 Wellington St" })];
    const leads = [
      lead("l1", { source: "osm", externalId: "n1", name: "Salon X", address: "100 Rue Wellington" }),
      lead("l2", { source: "osm", externalId: "n2", name: "Salon X", address: "100 rue Wellington" }),
    ];
    expect(linkLeadsToCatalog(catalog, leads).size).toBe(0);
  });
});

describe("existing links are left alone", () => {
  it("never relinks a business or reuses a lead that is already linked", () => {
    const catalog = [
      business("b1", { externalId: "g1", name: "Salon A", address: "1 Rue A" }, "l1"),
      business("b2", { externalId: "g2", name: "Salon A", address: "1 Rue A" }),
    ];
    const leads = [lead("l1", { source: "osm", externalId: "n", name: "Salon A", address: "1 Rue A" })];
    expect(linkLeadsToCatalog(catalog, leads).size).toBe(0);
  });
});
