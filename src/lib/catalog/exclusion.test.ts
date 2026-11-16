import { describe, expect, it } from "vitest";

import { catalogExclusion, failsGoogleCheck, isOfferedInCatalog, preferredForPlace } from "./exclusion";

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
    const verified = { verdict: "verified" as const, placeId: null, checkedAt: "2026-09-12T12:00:00.000Z" };
    expect(isOfferedInCatalog({ leadId: null, googleCheck: verified, provider: named("Salon H4H") })).toBe(true);
    expect(isOfferedInCatalog({ leadId: null, googleCheck: verified, provider: named("SEPHORA") })).toBe(false);
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

  it("offers only what the check verified", () => {
    expect(offered("verified")).toBe(true);
    // Google lists it elsewhere: our address is probably wrong.
    expect(offered("uncertain")).toBe(false);
    // Nobody has confirmed it yet.
    expect(offered(null)).toBe(false);
  });

  it("removes a lead only for a failed check, never for an undecided one", () => {
    const check = (verdict: "verified" | "not_found" | "closed" | "uncertain") => ({ verdict, placeId: null, checkedAt: at });
    expect(failsGoogleCheck(check("not_found"))).toBe(true);
    expect(failsGoogleCheck(check("closed"))).toBe(true);
    expect(failsGoogleCheck(check("uncertain"))).toBe(false);
    expect(failsGoogleCheck(check("verified"))).toBe(false);
    expect(failsGoogleCheck(null)).toBe(false);
  });

  it("never hides one of the operator's own leads", () => {
    expect(offered("not_found", "lead-1")).toBe(true);
  });
});

describe("preferredForPlace", () => {
  const row = (id: string, over: Partial<{ leadId: string | null; firstSeenAt: string; phone: string | null; address: string | null; website: string | null }> = {}) => ({
    id,
    leadId: over.leadId ?? null,
    firstSeenAt: over.firstSeenAt ?? "2026-09-11T00:00:00.000Z",
    provider: { phone: over.phone ?? null, address: over.address ?? null, website: over.website ?? null },
  });

  it("keeps the operator's own lead over a fuller record", () => {
    const lead = row("b", { leadId: "lead-1" });
    expect(preferredForPlace([row("a", { phone: "+15145550100", address: "1 Rue Test" }), lead])).toBe(lead);
  });

  it("then the fuller record, then the one recorded first, then the id", () => {
    const full = row("z", { phone: "+15145550100", address: "1 Rue Test" });
    expect(preferredForPlace([row("a", { address: "1 Rue Test" }), full])).toBe(full);
    const older = row("z", { firstSeenAt: "2026-08-01T00:00:00.000Z" });
    expect(preferredForPlace([row("a"), older])).toBe(older);
    const first = row("a");
    expect(preferredForPlace([row("b"), first])).toBe(first);
  });

  it("gives the same answer whatever order the rows arrive in", () => {
    const rows = [row("c", { phone: "+15145550100" }), row("a", { phone: "+15145550100" }), row("b")];
    expect(preferredForPlace(rows).id).toBe("a");
    expect(preferredForPlace([...rows].reverse()).id).toBe("a");
  });
});

describe("businesses that are real but are not salons", () => {
  it.each([
    ["Benefit Cosmetics Brow Bar", "chain-store"],
    ["L'Oreal Canada", "chain-store"],
    ["L’Oréal Professionnel", "chain-store"],
    ["Babor Canada Inc", "chain-store"],
    ["Ecole De Coiffure Internationale", "other-trade"],
    ["École Setsuko", "other-trade"],
    ["Gordon Robertson Career Centre", "other-trade"],
    ["Le Salon Ma Carrière, Emploi et Formation", "other-trade"],
    ["LAN Manicure Distribution", "other-trade"],
    ["Nails and Nails Fournitures", "other-trade"],
  ])("%s is not offered", (name, reason) => {
    expect(catalogExclusion(named(name))).toBe(reason);
  });

  it.each([
    "Salon Academie Nancy Falaise",
    "Académie de coiffure Tornade (Site Officiel)",
    "Xten'Cils - XC Masters, Salon & Academy",
    "Le Brow Bar",
    "Fuzz Wax Bar",
    "Bar à Couleur",
    "Beardlington Café",
    "Clinique Esthétique Oxygene",
    "Coiffure L'Oréade",
    "La Maison LAB",
  ])("%s stays", (name) => {
    expect(catalogExclusion(named(name))).toBeNull();
  });
});
