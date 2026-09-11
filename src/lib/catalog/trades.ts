import { SUPPORTED_CATEGORIES, type SupportedCategory } from "../osm/categories";
import { normalizeTerm } from "../normalize";

/**
 * The trades the business catalog collects.
 *
 * A SUBSET of `SUPPORTED_CATEGORIES`, not a second registry. The registry
 * still knows restaurants, dentists and the rest -- existing leads carry those
 * labels, and demo generation needs copy for them -- but the catalog is a
 * deliberate choice of who this business sells to: small hair and beauty
 * businesses, the trades with the highest share of places listing no website
 * in the Montreal data (34-43%, against 2-7% for pharmacies and dentists).
 *
 * Adding a trade later is one key here plus an Overture mapping in
 * `overture/categories.ts`. The vacuum and appliance-repair shops the operator
 * mentioned would be the first candidates; they were left out by choice.
 */

/** Grouped for display. The order is the order chips are shown in. */
export interface TradeGroup {
  label: string;
  keys: readonly string[];
}

export const CATALOG_TRADE_GROUPS: readonly TradeGroup[] = [
  { label: "Hair & grooming", keys: ["hair-salon", "barber"] },
  { label: "Beauty", keys: ["beauty-salon", "nail-salon", "tattoo"] },
];

export const CATALOG_TRADE_KEYS: readonly string[] = CATALOG_TRADE_GROUPS.flatMap(
  (group) => group.keys,
);

function byKey(key: string): SupportedCategory {
  const category = SUPPORTED_CATEGORIES.find((entry) => entry.key === key);
  // A key here that the registry does not know is a programming error, and one
  // the catalog test catches -- fail at import rather than render a blank chip.
  if (!category) throw new Error(`Catalog trade "${key}" is not a supported category.`);
  return category;
}

/** The catalog's trades as registry entries, in display order. */
export const CATALOG_TRADES: readonly SupportedCategory[] = CATALOG_TRADE_KEYS.map(byKey);

/** The catalog trade with this key, or null. */
export function catalogTradeByKey(key: string): SupportedCategory | null {
  return CATALOG_TRADES.find((trade) => trade.key === key) ?? null;
}

/**
 * The catalog trade a stored category label belongs to, or null.
 *
 * Compared after `normalizeTerm`, since a snapshot carries the label
 * ("Hair salon") and labels are how the catalog filters.
 */
export function catalogTradeForLabel(label: string): SupportedCategory | null {
  const needle = normalizeTerm(label);
  return CATALOG_TRADES.find((trade) => normalizeTerm(trade.label) === needle) ?? null;
}

/** Plural, for chip labels: "Hair salons", "Tattoo & piercing". */
export const TRADE_PLURALS: Readonly<Record<string, string>> = {
  "hair-salon": "Hair salons",
  barber: "Barbers",
  "beauty-salon": "Beauty salons",
  "nail-salon": "Nail salons",
  tattoo: "Tattoo & piercing",
};
