import { describe, expect, it } from "vitest";

import { parseStreetAddress, sameStreetAddress } from "./street-address";

/**
 * Cross-dataset address matching.
 *
 * The first table is not invented: each pair is an OpenStreetMap lead and the
 * Overture record for the same shop, taken from the stored leads and the
 * 2026-08-19.0 extract. Exact matching caught four of seventy-three such pairs.
 */

describe("the same shop, written by two datasets", () => {
  it.each([
    ["743 Avenue Atwater", "743 Atwater Ave"],
    ["28 Avenue des Pins Est, H2W 1N3", "28 Ave des Pins"],
    ["3918 Rue Wellington, Montréal", "3918 Wellington St"],
    ["1294 Rue Ontario Est, Montréal", "1294 Ontario St E"],
    ["4828 R. Saint-Denis", "4828 rue St-Denis"],
    ["7315 boulevard Newman", "7315 Newman Blvd"],
    ["5955 Rue Sherbrooke E", "5955 rue Sherbrooke Est"],
    ["1256 rue Guy", "1256 Guy St"],
    ["2 1re Rue O", "2, 1re Rue Ouest"],
    ["9505 Bd des Galeries d'Anjou", "9505 Boulevard des Galeries-d'Anjou"],
    ["1234 Sainte-Catherine St W #200", "1234 Rue Sainte-Catherine Ouest, Suite 200"],
    // "Ste" is Sainte in Quebec, not an abbreviated "suite" -- a street that
    // starts with it must not be cut off as though a unit number followed.
    ["1234 Rue Ste-Catherine O", "1234 Sainte-Catherine St W"],
    ["800 Boul. Ste-Croix", "800 Boulevard Sainte-Croix"],
  ])("%j matches %j", (osm, overture) => {
    expect(sameStreetAddress(osm, overture)).toBe(true);
    expect(sameStreetAddress(overture, osm)).toBe(true);
  });
});

describe("different places stay different", () => {
  it("keeps Est and Ouest apart -- they are kilometres apart in Montreal", () => {
    expect(sameStreetAddress("1234 Sherbrooke Est", "1234 Sherbrooke Ouest")).toBe(false);
    expect(sameStreetAddress("1234 Sherbrooke St E", "1234 Sherbrooke St W")).toBe(false);
  });

  it("treats a missing direction as compatible, not as a different address", () => {
    expect(sameStreetAddress("28 Avenue des Pins Est", "28 Ave des Pins")).toBe(true);
  });

  it("refuses a different civic number or street", () => {
    expect(sameStreetAddress("743 Atwater Ave", "745 Atwater Ave")).toBe(false);
    expect(sameStreetAddress("1100 Rue de la Montagne", "1140 Rue Guy")).toBe(false);
    expect(sameStreetAddress("4536 Rue Wellington", "4828 R. Saint-Denis")).toBe(false);
  });

  it("cannot see through a renamed street, and says so by not matching", () => {
    // Rue Amherst became rue Atateken in 2019. Same shop; only coordinates can
    // match this, which is why the catalog stores them.
    expect(sameStreetAddress("1632 Rue Atateken, Montréal, QC, H2L 3L5", "1632, rue Amherst")).toBe(
      false,
    );
  });
});

describe("what an address must have", () => {
  it("refuses an address with no civic number rather than matching the whole street", () => {
    expect(parseStreetAddress("Place Ville Marie")).toBeNull();
    expect(sameStreetAddress("Rue Sainte-Catherine", "Rue Sainte-Catherine")).toBe(false);
  });

  it("never matches two unknowns", () => {
    expect(sameStreetAddress(null, null)).toBe(false);
    expect(sameStreetAddress("", "")).toBe(false);
    expect(sameStreetAddress(undefined, "743 Atwater Ave")).toBe(false);
  });

  it("parses the parts it compares", () => {
    expect(parseStreetAddress("28 Avenue des Pins Est, H2W 1N3")).toEqual({
      number: "28",
      street: "pins",
      direction: "e",
    });
    expect(parseStreetAddress("4828 rue St-Denis")).toEqual({
      number: "4828",
      street: "saintdenis",
      direction: null,
    });
    expect(parseStreetAddress("1632, rue Amherst")).toEqual({
      number: "1632",
      street: "amherst",
      direction: null,
    });
  });

  it("keeps the first number of a range", () => {
    expect(parseStreetAddress("1234-1236 Rue Beaubien Est")?.number).toBe("1234");
  });
});
