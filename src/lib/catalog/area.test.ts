import { describe, expect, it } from "vitest";

import { localityKey, MONTREAL_ISLAND, placeLocality, resolveCatalogArea, withinBbox } from "./area";

/**
 * Which localities count as the island of Montreal.
 *
 * The spellings in these tables are not invented: every one is a raw
 * `addresses[0].locality` value from the 2026-08-19.0 Overture release, read
 * from inside the island's bounding box. If the folding rule ever stops
 * collapsing them, a real business silently drops out of the catalog.
 */

const island = MONTREAL_ISLAND;

describe("localityKey folds the spellings Overture actually uses", () => {
  it.each([
    ["Côte-St-Luc", "Cote Saint-Luc", "Côte Saint-Luc,", "Cote-St-Luc"],
    ["Dollard-des Ormeaux", "Dollard-des-Ormeaux", "Dollard Des Ormeaux", "Dollard-Des Ormeaux"],
    ["LaSalle", "Lasalle", "La Salle"],
    ["Montréal", "Montreal", "MONTREAL", "montreal", "Montréal, QC", "Montreal,"],
    ["Sainte-Anne-de-Bellevue", "Ste-Anne-de-Bellevue", "Sainte-Anne-De-Bellevue"],
    ["Montréal-Nord", "Montreal-Nord", "MONTREAL-NORD", "Montreal-nord"],
    ["Côte-des-Neiges–Notre-Dame-de-Grâce", "Côte-des-Neiges-Notre-Dame-de-Grâce"],
  ])("%s and its variants share one key", (...spellings) => {
    const keys = new Set(spellings.map(localityKey));
    expect(keys.size).toBe(1);
  });

  it("does not collapse genuinely different places", () => {
    expect(localityKey("Montréal-Nord")).not.toBe(localityKey("Montréal"));
    expect(localityKey("Montréal-Est")).not.toBe(localityKey("Montréal-Ouest"));
    expect(localityKey("Mont-Royal")).not.toBe(localityKey("Le Plateau-Mont-Royal"));
    // "Quebec" on its own is a city, not a province suffix to strip.
    expect(localityKey("Quebec")).toBe("quebec");
  });

  it("returns an empty key for blank input", () => {
    expect(localityKey("")).toBe("");
    expect(localityKey("  ,  ")).toBe("");
  });
});

describe("the City of Montréal and its districts", () => {
  it.each(["Montréal", "Montreal", "MONTREAL", "Montréal, QC", "montreal", "Montreal,"])(
    "%j is the city itself",
    (raw) => {
      expect(placeLocality(island, raw)).toEqual({ municipality: "Montréal", place: "Montréal" });
    },
  );

  it.each([
    ["Verdun", "Verdun"],
    ["Montreal-Nord", "Montréal-Nord"],
    ["Montréal-Nord", "Montréal-Nord"],
    ["Saint-Laurent", "Saint-Laurent"],
    ["St-Laurent", "Saint-Laurent"],
    ["Anjou", "Anjou"],
    ["Pierrefonds", "Pierrefonds"],
    ["Lasalle", "LaSalle"],
    ["La Salle", "LaSalle"],
    ["LACHINE", "Lachine"],
    ["Outremont", "Outremont"],
    ["Roxboro", "Roxboro"],
    ["Sainte-Genevieve", "Sainte-Geneviève"],
    ["Saint-Léonard", "Saint-Léonard"],
    ["L'Ile-Bizard", "L'Île-Bizard"],
  ])("%j is a district of Montréal, kept as %j", (raw, place) => {
    // The more specific name survives, but filtering still files it under the
    // city -- otherwise a "Montréal" filter would silently miss Verdun.
    expect(placeLocality(island, raw)).toEqual({ municipality: "Montréal", place });
  });
});

describe("the demerged municipalities are on the island", () => {
  it.each([
    ["Westmount", "Westmount"],
    ["Pointe-Claire", "Pointe-Claire"],
    ["POINTE-CLAIRE", "Pointe-Claire"],
    ["Dorval", "Dorval"],
    ["Kirkland", "Kirkland"],
    ["Beaconsfield", "Beaconsfield"],
    ["Mont-Royal", "Mont-Royal"],
    ["MONT-ROYAL", "Mont-Royal"],
    ["Hampstead", "Hampstead"],
    ["Côte-St-Luc", "Côte-Saint-Luc"],
    ["Cote Saint-Luc", "Côte-Saint-Luc"],
    ["Côte Saint-Luc,", "Côte-Saint-Luc"],
    ["Dollard-des Ormeaux", "Dollard-Des Ormeaux"],
    ["Dollard Des Ormeaux", "Dollard-Des Ormeaux"],
    ["Montréal-Ouest", "Montréal-Ouest"],
    ["Montréal-Est", "Montréal-Est"],
    ["Montreal-Est", "Montréal-Est"],
    ["Ste-Anne-de-Bellevue", "Sainte-Anne-de-Bellevue"],
    ["Baie-D'Urfé", "Baie-D'Urfé"],
  ])("%j is %j", (raw, municipality) => {
    expect(placeLocality(island, raw)).toEqual({ municipality, place: municipality });
  });
});

describe("everything else inside the box is refused", () => {
  // All of these appear inside the island's bounding box in the real release.
  // The last four are misfiled rows: a Drummondville address on Montreal
  // coordinates. The box admits them; the locality list must not.
  it.each([
    "Laval", "LAVAL", "Laval,", "Longueuil", "longueuil", "Brossard", "Terrebonne",
    "St-Eustache", "Blainville", "Vaudreuil-Dorion", "Châteauguay", "Saint-Lambert",
    "St-Hubert", "Greenfield Park", "Boucherville", "L'Île-Perrot", "Repentigny",
    "Drummondville", "St-Hyacinthe", "Cowansville", "St-Jean-sur-Richelieu",
  ])("rejects %j", (raw) => {
    expect(placeLocality(island, raw)).toBeNull();
  });

  it("rejects a missing or blank locality rather than assuming it is inside", () => {
    expect(placeLocality(island, null)).toBeNull();
    expect(placeLocality(island, undefined)).toBeNull();
    expect(placeLocality(island, "")).toBeNull();
    expect(placeLocality(island, " , ")).toBeNull();
  });
});

describe("the bounding box", () => {
  it("contains the island's extremities", () => {
    expect(withinBbox(island, 45.46, -73.97)).toBe(true); // Senneville / Ste-Anne
    expect(withinBbox(island, 45.65, -73.48)).toBe(true); // Pointe-aux-Trembles
    expect(withinBbox(island, 45.5, -73.57)).toBe(true); // downtown
  });

  it("excludes the two same-named towns elsewhere in Quebec", () => {
    expect(withinBbox(island, 45.32, -73.75)).toBe(false); // Mercier, Montérégie
    expect(withinBbox(island, 47.33, -79.44)).toBe(false); // Ville-Marie, Abitibi
  });
});

describe("area registry", () => {
  it("resolves the island by key and refuses anything else", () => {
    expect(resolveCatalogArea("montreal-island")).toBe(island);
    expect(resolveCatalogArea("laval")).toBeNull();
  });

  it("has sixteen municipalities: the city plus the fifteen that demerged", () => {
    expect(island.municipalities).toHaveLength(16);
    expect(new Set(island.municipalities.map((m) => m.label)).size).toBe(16);
  });

  it("gives no two places the same key", () => {
    // A shared key would file a business under whichever came first in the
    // list, which is a silent and order-dependent bug.
    const keys: string[] = [];
    for (const municipality of island.municipalities) {
      keys.push(...[municipality.label, ...municipality.aliases].map(localityKey));
      for (const district of municipality.districts) {
        keys.push(...[district.label, ...district.aliases].map(localityKey));
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
  });
});
