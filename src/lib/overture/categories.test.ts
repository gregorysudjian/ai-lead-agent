import { describe, expect, it } from "vitest";

import { SUPPORTED_CATEGORIES } from "../osm/categories";
import { EXCLUDED, mapOvertureCategory, mappedOvertureCategories } from "./categories";

/**
 * The mapping between Overture's 860-category taxonomy and our twelve trades.
 *
 * Both failure modes here are silent, which is why this file is as long as it
 * is: a mapping for a category that never appears is dead code nobody notices,
 * and a category that appears and we missed is an entire trade excluded from
 * every search without a single error being raised.
 */

describe("the trades we sell to", () => {
  const CASES: [string, string][] = [
    ["hair_salon", "hair-salon"],
    ["barber", "barber"],
    ["nail_salon", "nail-salon"],
    ["beauty_salon", "beauty-salon"],
    ["restaurant", "restaurant"],
    ["cafe", "cafe"],
    ["bakery", "bakery"],
    ["dentist", "dentist"],
    ["pharmacy", "pharmacy"],
    ["gym", "gym"],
    ["florist", "florist"],
    ["automotive_repair", "car-repair"],
  ];

  for (const [overture, expected] of CASES) {
    it(`maps ${overture} to ${expected}`, () => {
      expect(mapOvertureCategory(overture)?.key).toBe(expected);
    });
  }

  it("covers all twelve of our categories", () => {
    // If a category has no Overture mapping at all, businesses in that trade
    // can never be discovered from this dataset -- silently.
    const reached = new Set(
      mappedOvertureCategories().map((c) => mapOvertureCategory(c)?.key),
    );
    for (const category of SUPPORTED_CATEGORIES) {
      expect(reached, `nothing maps to ${category.key}`).toContain(category.key);
    }
  });
});

describe("many Overture categories are one trade to us", () => {
  it("treats a coffee shop as a cafe", () => {
    expect(mapOvertureCategory("coffee_shop")?.key).toBe("cafe");
    expect(mapOvertureCategory("cafe")?.key).toBe("cafe");
  });

  it("treats a spa as a beauty salon", () => {
    for (const value of ["spas", "day_spa", "beauty_salon"]) {
      expect(mapOvertureCategory(value)?.key, value).toBe("beauty-salon");
    }
  });

  it("catches the flower shop Overture names oddly", () => {
    // `flowers_and_gifts_shop` is seven times commoner than `florist` in
    // Quebec. Mapping only the obvious name misses most of them.
    expect(mapOvertureCategory("flowers_and_gifts_shop")?.key).toBe("florist");
  });

  it("treats the body shop and the tyre shop as car repair", () => {
    for (const value of [
      "automotive_repair",
      "automotive_services_and_repair",
      "auto_body_shop",
      "auto_glass_service",
      "tire_dealer_and_repair",
    ]) {
      expect(mapOvertureCategory(value)?.key, value).toBe("car-repair");
    }
  });

  it("treats general dentistry as a dentist", () => {
    expect(mapOvertureCategory("general_dentistry")?.key).toBe("dentist");
  });
});

describe("the restaurant suffix rule", () => {
  it("maps every cuisine Overture names separately", () => {
    // Real categories from the Quebec slice. Enumerating them would go stale
    // the moment a cuisine is added, and every one is a restaurant.
    for (const value of [
      "pizza_restaurant", "sushi_restaurant", "italian_restaurant",
      "french_restaurant", "chinese_restaurant", "indian_restaurant",
      "mexican_restaurant", "thai_restaurant", "lebanese_restaurant",
      "seafood_restaurant", "chicken_restaurant", "canadian_restaurant",
      "vietnamese_restaurant", "barbecue_restaurant", "greek_restaurant",
      "burger_restaurant", "fast_food_restaurant",
      "breakfast_and_brunch_restaurant", "bar_and_grill_restaurant",
    ]) {
      expect(mapOvertureCategory(value)?.key, value).toBe("restaurant");
    }
  });

  it("is the only pattern rule, and matches on the noun", () => {
    // A prefix rule would be the dangerous kind. "restaurant_supply_store"
    // sells to restaurants and is not one.
    expect(mapOvertureCategory("restaurant_supply_store")).toBeNull();
  });
});

describe("near misses are refused, not guessed", () => {
  it("refuses every documented exclusion", () => {
    for (const value of EXCLUDED) {
      expect(mapOvertureCategory(value), value).toBeNull();
    }
  });

  it("does not turn a computer shop into a garage", () => {
    // The keyword trap. "it_service_and_computer_repair" contains "repair".
    expect(mapOvertureCategory("it_service_and_computer_repair")).toBeNull();
  });

  it("does not treat selling or cleaning a car as repairing one", () => {
    for (const value of ["car_dealer", "used_car_dealer", "car_wash", "auto_detailing", "car_rental_agency"]) {
      expect(mapOvertureCategory(value), value).toBeNull();
    }
  });

  it("keeps adjacent personal-care trades out of beauty salon", () => {
    // Different customers, different pitch. A medical spa is a clinic.
    for (const value of ["medical_spa", "tanning_salon", "massage_therapy"]) {
      expect(mapOvertureCategory(value), value).toBeNull();
    }
  });

  it("does not treat a personal trainer as a gym", () => {
    expect(mapOvertureCategory("fitness_trainer")).toBeNull();
  });

  it("refuses an exclusion even if a pattern would have matched it", () => {
    // Ordering matters: exclusions beat the suffix rule, so a future pattern
    // cannot quietly re-include something already decided against.
    expect(EXCLUDED.length).toBeGreaterThan(0);
    for (const value of EXCLUDED) {
      expect(mapOvertureCategory(value), value).toBeNull();
    }
  });
});

describe("unknown means no", () => {
  it("returns null for a category we do not recognise", () => {
    for (const value of ["lake", "park", "real_estate_agent", "church_cathedral", "atms"]) {
      expect(mapOvertureCategory(value), value).toBeNull();
    }
  });

  it("returns null for junk without throwing", () => {
    for (const value of ["", "   ", null, undefined, "<script>", "HAIR_SALON!!"]) {
      expect(() => mapOvertureCategory(value as string)).not.toThrow();
      expect(mapOvertureCategory(value as string)).toBeNull();
    }
  });

  it("is case- and whitespace-tolerant on a real value", () => {
    expect(mapOvertureCategory("  HAIR_SALON  ")?.key).toBe("hair-salon");
  });

  it("returns a registry entry, so the label is the canonical one", () => {
    // Callers store `category` as the label. Returning the registry entry
    // means they never have to look it up again and cannot invent a spelling.
    const salon = mapOvertureCategory("hair_salon");
    expect(salon?.label).toBe("Hair salon");
    expect(SUPPORTED_CATEGORIES).toContain(salon);
  });
});
