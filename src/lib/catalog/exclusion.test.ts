import { describe, expect, it } from "vitest";

import { catalogExclusion, isOfferedInCatalog } from "./exclusion";

/**
 * Every example here is a real name from the Montreal catalog as loaded on
 * 2026-09-11 -- the junk that prompted the rule, and the odd-looking real
 * businesses it must never catch.
 */
const named = (name: string, website: string | null = null) => ({ name, website });

describe("catalogExclusion", () => {
  it("catches names that are not names", () => {
    expect(catalogExclusion(named("6r5dxckulcvbol/.", "http://www.santehh.com/"))).toBe("broken-name");
    expect(catalogExclusion(named("�Bricassoo�"))).toBe("broken-name");
    expect(catalogExclusion(named("---"))).toBe("broken-name");
  });

  it("catches pharmacies filed under beauty, by name or by website", () => {
    expect(catalogExclusion(named("Uniprix Athanasios Kouremenos pharmacien inc. (Pharmacie affiliée)"))).toBe("pharmacy");
    expect(catalogExclusion(named("Clinique Santé Tan Duc Vo (Pharmacie affiliée)", "http://www.cliniquesante.com/"))).toBe("pharmacy");
    expect(catalogExclusion(named("Uniprix Santé Thi Bui Mui Nguyen - Pharmacie affiliée"))).toBe("pharmacy");
    expect(catalogExclusion(named("Clinique Santé Hoai Buu", "http://www.cliniquesante.com/"))).toBe("pharmacy");
    expect(catalogExclusion(named("Pharmacie Jean Coutu"))).toBe("pharmacy");
  });

  it("catches chain stores", () => {
    expect(catalogExclusion(named("SEPHORA", "https://www.sephora.com/happening/stores/sainte-ca"))).toBe("chain-store");
    expect(catalogExclusion(named("Bath & Body Works", "http://www.bathandbodyworks.ca/"))).toBe("chain-store");
  });

  it("catches another trade filed under beauty", () => {
    expect(catalogExclusion(named("Clinique Chiropratique Specifique"))).toBe("other-trade");
  });

  it("keeps real businesses whose names merely look unusual", () => {
    for (const name of [
      "Fade2Brooklyn Westmount",
      "Fade2Brooklyn Barbershop",
      "Salon H4H",
      "M2K Touche Beaute",
      "sweet4sure",
      "stillnesss__",
      "An•Ge•L•",
      "WNTD",
      "SKN MD",
      "Au 2e",
      "C A E L Y N • O ‘ B R I E N",
      "ร้านเอเชียช็อป นาสาร",
      "Cortes y peinados de \"Idalia Estilista\"",
    ]) {
      expect(catalogExclusion(named(name)), name).toBeNull();
    }
  });

  it("keeps beauty businesses whose names share a word with a chain", () => {
    for (const name of [
      "Salon Lush & Lux",
      "Clinique PEAU NETTE",
      "Clinique Médico Esthétique Westmount",
      "Blush Salon Montreal",
      "Clinique Capillaire Carole Raby",
      "Essence De Mieux Être",
    ]) {
      expect(catalogExclusion(named(name)), name).toBeNull();
    }
  });

  it("ignores a website it cannot parse", () => {
    expect(catalogExclusion(named("Salon Test", "not a url"))).toBeNull();
  });
});

describe("isOfferedInCatalog", () => {
  it("never hides a business the operator already made a lead", () => {
    expect(isOfferedInCatalog({ leadId: "lead-1", provider: named("SEPHORA") })).toBe(true);
    expect(isOfferedInCatalog({ leadId: null, provider: named("SEPHORA") })).toBe(false);
    expect(isOfferedInCatalog({ leadId: null, provider: named("Salon H4H") })).toBe(true);
  });
});

describe("the Google Maps check in search", () => {
  const at = "2026-09-12T12:00:00.000Z";
  const offered = (verdict: "verified" | "not_found" | "closed" | "uncertain" | null, leadId: string | null = null) =>
    isOfferedInCatalog({
      leadId,
      googleCheck: verdict === null ? null : { verdict, placeId: null, checkedAt: at },
      provider: named("Salon Lumière"),
    });

  it("hides what Google did not find or lists as closed", () => {
    expect(offered("not_found")).toBe(false);
    expect(offered("closed")).toBe(false);
  });

  it("keeps verified, uncertain and unchecked businesses", () => {
    expect(offered("verified")).toBe(true);
    expect(offered("uncertain")).toBe(true);
    expect(offered(null)).toBe(true);
  });

  it("never hides one of the operator's own leads", () => {
    expect(offered("not_found", "lead-1")).toBe(true);
  });
});
