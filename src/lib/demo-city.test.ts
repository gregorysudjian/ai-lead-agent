import { describe, expect, it } from "vitest";

import { addressNamesCity, localizedCity } from "./demo-city";

describe("localizedCity", () => {
  it("uses the French name on a French page", () => {
    expect(localizedCity("Montreal", "fr")).toBe("Montréal");
    expect(localizedCity("Montréal", "fr")).toBe("Montréal");
    expect(localizedCity("Quebec City", "fr")).toBe("Québec");
  });

  it("keeps the stored spelling in English", () => {
    expect(localizedCity("Montreal", "en")).toBe("Montreal");
    expect(localizedCity("Montréal", "en")).toBe("Montréal");
  });

  it("shows an unlisted city exactly as stored", () => {
    expect(localizedCity("Pointe-Claire", "fr")).toBe("Pointe-Claire");
    expect(localizedCity("Westmount", "fr")).toBe("Westmount");
  });
});

describe("addressNamesCity", () => {
  it("matches across accents and case", () => {
    expect(addressNamesCity("1188 Rue Ontario Est, Montréal", "Montreal")).toBe(true);
    expect(addressNamesCity("3339 Rue Jean-Talon Est, MONTREAL, QC", "Montréal")).toBe(true);
  });

  it("does not match when the address stops at the street", () => {
    expect(addressNamesCity("3850 Rue Wellington", "Montreal")).toBe(false);
    expect(addressNamesCity(null, "Montreal")).toBe(false);
  });

  it("does not take a longer municipality name for the city", () => {
    expect(addressNamesCity("12 Avenue Broadway, Montréal-Est", "Montréal")).toBe(false);
    expect(addressNamesCity("12 Avenue Broadway, Montréal-Est", "Montréal-Est")).toBe(true);
  });
});
