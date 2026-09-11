import { describe, expect, it } from "vitest";

import { MONTREAL_ISLAND } from "./area";
import { buildCatalogRecords, catalogOvertureCategories, type FlatOvertureRow } from "./overture-records";

const AT = "2026-09-11T00:00:00.000Z";

function row(patch: Partial<FlatOvertureRow> = {}): FlatOvertureRow {
  return {
    id: "gers-1",
    name: "Salon Lumière",
    category: "hair_salon",
    confidence: 0.9,
    website: null,
    phone: "+15145550100",
    street: "4500 Rue Wellington",
    locality: "Verdun",
    latitude: 45.46,
    longitude: -73.57,
    ...patch,
  };
}

const build = (rows: FlatOvertureRow[]) => buildCatalogRecords(rows, MONTREAL_ISLAND, AT);

describe("what the extract reads", () => {
  it("asks Overture only for categories that land in a catalog trade", () => {
    const categories = catalogOvertureCategories();
    expect(categories).toEqual(expect.arrayContaining(["hair_salon", "barber", "nail_salon", "tattoo_and_piercing", "spas"]));
    for (const excluded of ["restaurant", "dentist", "automotive_repair", "florist"]) {
      expect(categories).not.toContain(excluded);
    }
  });
});

describe("building records", () => {
  it("keeps the district as the city and files it under its municipality", () => {
    const { records } = build([row()]);
    expect(records).toHaveLength(1);
    expect(records[0].business.city).toBe("Verdun");
    expect(records[0].municipality).toBe("Montréal");
    expect(records[0].location).toEqual({ latitude: 45.46, longitude: -73.57 });
  });

  it("writes one canonical spelling for a place however the provider spelled it", () => {
    const { records } = build([
      row({ id: "a", locality: "MONTREAL" }),
      row({ id: "b", locality: "Montréal, QC", name: "B" }),
      row({ id: "c", locality: "La Salle", name: "C" }),
      row({ id: "d", locality: "Cote-St-Luc", name: "D" }),
    ]);
    expect(records.map((r) => [r.business.city, r.municipality])).toEqual([
      ["Montréal", "Montréal"],
      ["Montréal", "Montréal"],
      ["LaSalle", "Montréal"],
      ["Côte-Saint-Luc", "Côte-Saint-Luc"],
    ]);
  });

  it("maps the category onto the trade label the rest of the app uses", () => {
    const { records } = build([row({ category: "tattoo_and_piercing" }), row({ id: "2", category: "spas", name: "Spa" })]);
    expect(records.map((r) => r.business.category)).toEqual(["Tattoo & piercing", "Beauty salon"]);
  });

  it("drops rows outside the area and tallies them by spelling", () => {
    const result = build([
      row({ id: "1", locality: "Laval" }),
      row({ id: "2", locality: "Laval" }),
      row({ id: "3", locality: "Drummondville" }),
      row({ id: "4", locality: null }),
    ]);
    expect(result.records).toHaveLength(0);
    expect(Object.fromEntries(result.outsideArea)).toEqual({
      Laval: 2,
      Drummondville: 1,
      "(no locality)": 1,
    });
  });

  it("drops rows outside the catalog's trades and rows with no name", () => {
    const result = build([row({ category: "restaurant" }), row({ id: "2", name: null }), row({ id: "3", category: null })]);
    expect(result.records).toHaveLength(0);
    expect(result.unusable).toBe(3);
  });

  it("keeps the first of two rows sharing a provider id", () => {
    const result = build([row({ phone: "+1514" }), row({ phone: "+1438" })]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].business.phone).toBe("+1514");
    expect(result.duplicateIds).toBe(1);
  });

  it("stores no location rather than a broken one", () => {
    const { records } = build([
      row({ id: "1", latitude: null, longitude: -73.5 }),
      row({ id: "2", latitude: Number.NaN, longitude: -73.5, name: "B" }),
      // Inside Montreal by its label, but the coordinate is sixty km away.
      row({ id: "3", latitude: 45.88, longitude: -72.48, name: "C" }),
    ]);
    expect(records.map((r) => r.location)).toEqual([null, null, null]);
  });
});
