import { describe, expect, it } from "vitest";

import {
  distanceMetres,
  judgeGoogleMatch,
  nameSimilarity,
  type GoogleCandidate,
  type MatchTarget,
} from "./google-match";

// Rue Wellington, Verdun.
const HERE = { latitude: 45.4596, longitude: -73.5716 };
/** A point `metres` due north of HERE. */
const north = (metres: number) => ({ latitude: HERE.latitude + metres / 111_320, longitude: HERE.longitude });

const target = (name: string, over: Partial<MatchTarget> = {}): MatchTarget => ({
  name,
  address: "4500 Rue Wellington",
  location: HERE,
  ...over,
});

const place = (name: string, over: Partial<GoogleCandidate> = {}): GoogleCandidate => ({
  placeId: "ChIJtestplaceid0001",
  name,
  location: north(20),
  businessStatus: "OPERATIONAL",
  formattedAddress: "4500 Rue Wellington, Verdun, QC H4G 1X3, Canada",
  ...over,
});

describe("nameSimilarity", () => {
  it("sees through accents, case, punctuation and word order", () => {
    expect(nameSimilarity("Salon Coiffure Lumière", "LUMIERE coiffure")).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity("A.kuts", "A Kuts Barbershop")).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity("2Cut BarberShop & TattooShop", "2Cut Barbershop")).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity("L'Atelier de Julie", "Atelier Julie")).toBeGreaterThanOrEqual(0.85);
  });

  it("does not let shared trade words make two salons alike", () => {
    expect(nameSimilarity("Salon Bella", "Salon Élégance")).toBeLessThan(0.5);
    expect(nameSimilarity("Barbier Chez Mostafa", "Barbier du Coin")).toBeLessThan(0.5);
    expect(nameSimilarity("Ongles Rose", "Ongles Chic")).toBeLessThan(0.5);
  });

  it("caps a name made only of trade words, so it can only match next door", () => {
    expect(nameSimilarity("Salon de coiffure", "Salon de Coiffure Marie")).toBeLessThanOrEqual(0.7);
  });
});

describe("distanceMetres", () => {
  it("measures a known offset to within a metre", () => {
    expect(Math.abs(distanceMetres(HERE, north(250)) - 250)).toBeLessThan(1);
  });
});

describe("judgeGoogleMatch", () => {
  it("verifies the same name at the same spot, keeping Google's place id", () => {
    const outcome = judgeGoogleMatch(target("Salon Lumière"), [place("Salon Lumière")]);
    expect(outcome.verdict).toBe("verified");
    expect(outcome.placeId).toBe("ChIJtestplaceid0001");
  });

  it("allows more distance the closer the names agree", () => {
    expect(judgeGoogleMatch(target("Salon Lumière"), [place("Lumière", { location: north(500) })]).verdict).toBe(
      "verified",
    );
    expect(
      judgeGoogleMatch(target("Lumière Beauté Studio"), [place("Lumiere Beaute", { location: north(200) })]).verdict,
    ).toBe("verified");
  });

  it("does not verify a DIFFERENT salon next door -- Google always answers with something", () => {
    const outcome = judgeGoogleMatch(target("Salon Bella"), [place("Coiffure Élégance", { location: north(15) })]);
    expect(outcome.verdict).toBe("not_found");
    expect(outcome.placeId).toBeNull();
  });

  it("reports a permanently closed match as closed", () => {
    const outcome = judgeGoogleMatch(target("Salon Lumière"), [
      place("Salon Lumière", { businessStatus: "CLOSED_PERMANENTLY" }),
    ]);
    expect(outcome.verdict).toBe("closed");
  });

  it("treats a temporary closure as still there", () => {
    expect(
      judgeGoogleMatch(target("Salon Lumière"), [place("Salon Lumière", { businessStatus: "CLOSED_TEMPORARILY" })])
        .verdict,
    ).toBe("verified");
  });

  it("calls a matching name kilometres away uncertain, and keeps no place id for it", () => {
    const outcome = judgeGoogleMatch(target("Salon Lumière"), [place("Salon Lumière", { location: north(2000) })]);
    expect(outcome.verdict).toBe("uncertain");
    expect(outcome.placeId).toBeNull();
  });

  it("is not_found when Google returns nothing at all", () => {
    const outcome = judgeGoogleMatch(target("Salon Lumière"), []);
    expect(outcome).toMatchObject({ verdict: "not_found", placeId: null, best: null });
  });

  it("prefers the matching candidate over a nearer stranger", () => {
    const outcome = judgeGoogleMatch(target("Salon Lumière"), [
      place("Nails Plus", { placeId: "ChIJstrangerplace01", location: north(5) }),
      place("Salon Lumière", { placeId: "ChIJtherightplace01", location: north(60) }),
    ]);
    expect(outcome.placeId).toBe("ChIJtherightplace01");
  });

  it("without our coordinates, matches on name plus the same door number", () => {
    const noCoords = target("St-Viateur Bagel", { address: "263 Rue Saint-Viateur Ouest", location: null });
    const same = place("St-Viateur Bagel", {
      location: north(0),
      formattedAddress: "263 Rue Saint-Viateur O, Montréal, QC H2V 1Y1, Canada",
    });
    expect(judgeGoogleMatch(noCoords, [same]).verdict).toBe("verified");

    const nextDoor = { ...same, formattedAddress: "261 Rue Saint-Viateur O, Montréal, QC H2V 1Y1, Canada" };
    expect(judgeGoogleMatch(noCoords, [nextDoor]).verdict).toBe("verified");

    const otherBranch = { ...same, formattedAddress: "1127 Av. du Mont-Royal E, Montréal, QC, Canada" };
    expect(judgeGoogleMatch(noCoords, [otherBranch]).verdict).toBe("uncertain");
  });

  it("keeps a business Google lists under the same name at another address, as uncertain", () => {
    const outcome = judgeGoogleMatch(target("Cheveux Depot"), [
      place("Coiffure Élégance", { location: north(40) }),
      place("CHEVEUX DEPOT INC", { location: north(13_000) }),
    ]);
    expect(outcome.verdict).toBe("uncertain");
    expect(outcome.placeId).toBeNull();
    expect(outcome.reason).toMatch(/same name/);
  });

  it("does not treat a merely overlapping name elsewhere as the same business", () => {
    for (const [ours, theirs] of [
      ["La Mousse", "La Mousse Coiffure"],
      ["Salon de coiffure pour dames nadia", "Coiffure Nadia"],
      ["M Salon", "M Salon"],
      ["Esthétique EVE chez Lila", "Lila Le Spa"],
    ]) {
      const outcome = judgeGoogleMatch(target(ours), [place(theirs, { location: north(15_000) })]);
      expect(outcome.verdict, `${ours} / ${theirs}`).toBe("not_found");
    }
  });

  it("never matches on a generic name at a distance", () => {
    const outcome = judgeGoogleMatch(target("Salon de coiffure"), [
      place("Salon de Coiffure Marie", { location: north(300) }),
    ]);
    expect(outcome.verdict).not.toBe("verified");
  });
});

describe("the city's name inside a business name", () => {
  it("counts when it IS the name: MTL Tattoo is Mtl Tattoo and Piercing", () => {
    expect(nameSimilarity("MTL Tattoo", "Mtl Tattoo and Piercing")).toBeGreaterThanOrEqual(0.85);
    // 800 m up the same street: probably moved -- kept, as uncertain.
    const outcome = judgeGoogleMatch(target("MTL Tattoo"), [place("Mtl Tattoo and Piercing", { location: north(805) })]);
    expect(outcome.verdict).toBe("uncertain");
  });

  it("sets the city aside when asking whether the same name is elsewhere", () => {
    const outcome = judgeGoogleMatch(target("Yumi Lashes Montréal"), [place("YUMI Lashes MTL", { location: north(11_000) })]);
    expect(outcome.verdict).toBe("uncertain");
  });

  it("does not count as a suffix: MTL Tattoo is not Studio Gus Tattoo Montréal", () => {
    expect(nameSimilarity("MTL Tattoo", "Studio Gus Tattoo Montréal")).toBeLessThan(0.5);
    expect(nameSimilarity("Salon Lumière", "Salon Lumière Montréal")).toBe(1);
  });
});
