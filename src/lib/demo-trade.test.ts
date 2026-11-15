import { describe, expect, it } from "vitest";

import { demoTradeFor } from "./demo-trade";

describe("demoTradeFor", () => {
  it("moves a catch-all beauty salon to the trade its name states", () => {
    expect(demoTradeFor("Coiffure Xena", "Beauty salon")).toBe("Hair salon");
    expect(demoTradeFor("514braids", "Beauty salon")).toBe("Hair salon");
    expect(demoTradeFor("Queen Braids Montréal", "Beauty salon")).toBe("Hair salon");
    expect(demoTradeFor("Ongles Chano", "Beauty salon")).toBe("Nail salon");
    expect(demoTradeFor("Aces Barber Shop", "Beauty salon")).toBe("Barber shop");
    expect(demoTradeFor("Tatouage Royal", "Beauty salon")).toBe("Tattoo & piercing");
  });

  it("moves a hair salon to a barber shop only when the name says barber", () => {
    expect(demoTradeFor("G&G Barbershop", "Hair salon")).toBe("Barber shop");
    expect(demoTradeFor("Jack Steel Le Barbier", "Hair salon")).toBe("Barber shop");
    expect(demoTradeFor("Ongles et Cheveux Lili", "Hair salon")).toBe("Hair salon");
    expect(demoTradeFor("Salon Nails Deluxe", "Hair salon")).toBe("Hair salon");
  });

  it("never moves away from a specific trade", () => {
    expect(demoTradeFor("Lucerne Coiffures Pour Hommes", "Barber shop")).toBe("Barber shop");
    expect(demoTradeFor("MOD'S HAIR", "Nail salon")).toBe("Nail salon");
    expect(demoTradeFor("Spa ManiPedi", "Nail salon")).toBe("Nail salon");
    expect(demoTradeFor("Barber Ink Tattoo", "Tattoo & piercing")).toBe("Tattoo & piercing");
  });

  it("decides nothing when a name mentions two trades, or none", () => {
    expect(demoTradeFor("Bisou Nail & Hair Atelier", "Beauty salon")).toBe("Beauty salon");
    expect(demoTradeFor("Angies Coiffure & Ongles", "Beauty salon")).toBe("Beauty salon");
    expect(demoTradeFor("Studio Lumière", "Beauty salon")).toBe("Beauty salon");
    expect(demoTradeFor("Salon D'Esthétique Ava", "Beauty salon")).toBe("Beauty salon");
  });

  it("matches whole words only, without accents", () => {
    expect(demoTradeFor("Barbie's Beauty", "Beauty salon")).toBe("Beauty salon");
    expect(demoTradeFor("Chairs & Co", "Beauty salon")).toBe("Beauty salon");
    expect(demoTradeFor("COIFFURE ÉLÉGANCE", "beauty salon")).toBe("Hair salon");
  });

  it("leaves every other category alone", () => {
    expect(demoTradeFor("Le Barbier du Pain", "Bakery")).toBe("Bakery");
    expect(demoTradeFor("Hair of the Dog Café", "Cafe")).toBe("Cafe");
  });
});
