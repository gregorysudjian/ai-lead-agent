import { describe, expect, it } from "vitest";

import { GENERIC_SAMPLES, samplesForCategory } from "../demo-samples";
import { mapOvertureCategory, mappedOvertureCategories } from "../overture/categories";
import {
  CATALOG_TRADE_GROUPS,
  CATALOG_TRADE_KEYS,
  CATALOG_TRADES,
  catalogTradeByKey,
  catalogTradeForLabel,
  TRADE_PLURALS,
} from "./trades";

/**
 * The catalog's trades have to be reachable end to end.
 *
 * A trade listed here but unreachable from Overture would show a chip that
 * always reads zero. A trade with no bespoke demo copy would produce a generic
 * "we provide a range of services" page for every business in it -- exactly
 * the kind of demo an owner does not recognise as theirs.
 */

describe("the catalog trades", () => {
  it("are hair and beauty, in two groups, each key once", () => {
    expect(CATALOG_TRADE_KEYS).toEqual(["hair-salon", "barber", "beauty-salon", "nail-salon", "tattoo"]);
    expect(CATALOG_TRADE_GROUPS.map((group) => group.label)).toEqual(["Hair & grooming", "Beauty"]);
    expect(new Set(CATALOG_TRADE_KEYS).size).toBe(CATALOG_TRADE_KEYS.length);
  });

  it.each(CATALOG_TRADE_KEYS)("%s is reachable from at least one Overture category", (key) => {
    const reached = mappedOvertureCategories().filter((c) => mapOvertureCategory(c)?.key === key);
    expect(reached.length, `no Overture category maps to ${key}`).toBeGreaterThan(0);
  });

  it.each(CATALOG_TRADES.map((trade) => [trade.key, trade.label]))(
    "%s has bespoke demo copy for its stored label %j",
    (_key, label) => {
      expect(samplesForCategory(label)).not.toBe(GENERIC_SAMPLES);
    },
  );

  it.each(CATALOG_TRADE_KEYS)("%s has a plural for its chip", (key) => {
    expect(TRADE_PLURALS[key]).toBeTruthy();
  });

  it("resolves a trade from the label a snapshot carries, and nothing else", () => {
    expect(catalogTradeForLabel("Barber shop")?.key).toBe("barber");
    expect(catalogTradeForLabel("  TATTOO & PIERCING ")?.key).toBe("tattoo");
    // A real category, but not one the catalog collects.
    expect(catalogTradeForLabel("Restaurant")).toBeNull();
    expect(catalogTradeByKey("dentist")).toBeNull();
  });
});
