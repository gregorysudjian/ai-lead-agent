/**
 * Curated registry of business categories and their OpenStreetMap tags.
 *
 * Pure and deterministic. User-supplied category text is resolved against this
 * registry and never becomes Overpass QL, so no input can inject query syntax.
 *
 * Tag choices were checked against live taginfo usage counts rather than
 * assumed. Two findings changed the obvious guesses:
 *   - `shop=barber` has ~33 uses worldwide and is effectively unused; barber
 *     shops are `shop=hairdresser`, refined by `hairdresser=barber` (~15.8k).
 *   - `shop=nail_salon` (~260) is not the convention; nail salons are
 *     `shop=beauty` + `beauty=nails` (~33.7k).
 * Dentists genuinely need two selectors: `amenity=dentist` (~160k) and
 * `healthcare=dentist` (~127k) are both widespread and only partly overlap.
 */
import { normalizeTerm } from "../normalize";

/** Tags that must ALL be present on an element for the selector to match. */
export type OsmTagSelector = Readonly<Record<string, string>>;

export interface SupportedCategory {
  key: string;
  /** Canonical label stored on the lead and shown in the UI. */
  label: string;
  aliases: string[];
  /** Selectors are OR-ed; tags within one selector are AND-ed. */
  selectors: readonly OsmTagSelector[];
}

export const SUPPORTED_CATEGORIES: readonly SupportedCategory[] = [
  {
    key: "hair-salon",
    label: "Hair salon",
    aliases: ["hair salon", "hair salons", "hairdresser", "hairdressers", "salon", "coiffure"],
    selectors: [{ shop: "hairdresser" }],
  },
  {
    key: "barber",
    label: "Barber shop",
    aliases: ["barber", "barbers", "barber shop", "barber shops", "barbershop"],
    selectors: [{ shop: "hairdresser", hairdresser: "barber" }],
  },
  {
    key: "beauty-salon",
    label: "Beauty salon",
    aliases: ["beauty salon", "beauty salons", "beauty", "esthetics"],
    selectors: [{ shop: "beauty" }],
  },
  {
    key: "nail-salon",
    label: "Nail salon",
    aliases: ["nail salon", "nail salons", "nails", "manicure"],
    selectors: [{ shop: "beauty", beauty: "nails" }],
  },
  {
    key: "restaurant",
    label: "Restaurant",
    aliases: ["restaurant", "restaurants"],
    selectors: [{ amenity: "restaurant" }],
  },
  {
    key: "cafe",
    label: "Cafe",
    aliases: ["cafe", "café", "cafes", "cafés", "coffee shop", "coffee shops", "coffee"],
    selectors: [{ amenity: "cafe" }],
  },
  {
    key: "dentist",
    label: "Dentist",
    aliases: ["dentist", "dentists", "dental clinic", "dental", "dentiste"],
    // Both tags are in wide use and only partly overlap; duplicates that match
    // both are collapsed by element id before normalization.
    selectors: [{ amenity: "dentist" }, { healthcare: "dentist" }],
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    aliases: ["pharmacy", "pharmacies", "drugstore", "pharmacie"],
    selectors: [{ amenity: "pharmacy" }],
  },
  {
    key: "bakery",
    label: "Bakery",
    aliases: ["bakery", "bakeries", "boulangerie"],
    selectors: [{ shop: "bakery" }],
  },
  {
    key: "gym",
    label: "Gym",
    aliases: ["gym", "gyms", "fitness centre", "fitness center", "fitness"],
    selectors: [{ leisure: "fitness_centre" }],
  },
  {
    key: "florist",
    label: "Florist",
    aliases: ["florist", "florists", "flower shop", "flower shops", "fleuriste"],
    selectors: [{ shop: "florist" }],
  },
  {
    key: "car-repair",
    label: "Car repair",
    aliases: ["car repair", "auto repair", "mechanic", "garage", "car mechanic"],
    selectors: [{ shop: "car_repair" }],
  },
];

export function resolveSupportedCategory(input: string): SupportedCategory | null {
  const needle = normalizeTerm(input);
  if (needle.length === 0) return null;

  return (
    SUPPORTED_CATEGORIES.find((category) =>
      category.aliases.some((alias) => normalizeTerm(alias) === needle),
    ) ?? null
  );
}

/** Labels of every supported category, for client-safe validation messages. */
export function supportedCategoryLabels(): string[] {
  return SUPPORTED_CATEGORIES.map((category) => category.label);
}

/**
 * Deterministic subtype classification from the element's own OSM tags.
 *
 * Several registry categories legitimately overlap: a barber shop is tagged
 * `shop=hairdresser` + `hairdresser=barber`, so it matches BOTH the "hair salon"
 * and "barber" searches. Without this, the stored category depended on whichever
 * overlapping search ran most recently -- searching "hair salons" then "barber"
 * would rewrite the same business from "Hair salon" to "Barber shop" and back,
 * because rediscovery replaces the whole provider snapshot.
 *
 * The tags themselves are the stable authority: when they identify a known
 * subtype, that subtype wins regardless of what the user typed. Otherwise the
 * requested category's canonical label is used.
 *
 * Ordered most specific first. Purely tag-driven -- no fuzzy matching, no
 * external lookup, no classifier.
 */
const SUBTYPE_RULES: readonly { tags: OsmTagSelector; categoryKey: string }[] = [
  { tags: { shop: "hairdresser", hairdresser: "barber" }, categoryKey: "barber" },
  { tags: { shop: "beauty", beauty: "nails" }, categoryKey: "nail-salon" },
];

function matchesAllTags(tags: Record<string, string>, selector: OsmTagSelector): boolean {
  return Object.entries(selector).every(([key, value]) => tags[key] === value);
}

/**
 * The category label to store for an element.
 *
 * @param tags          the element's OSM tags
 * @param requested     the registry category the user's search resolved to
 */
export function classifyOsmCategory(
  tags: Record<string, string>,
  requested: SupportedCategory,
): string {
  for (const rule of SUBTYPE_RULES) {
    if (!matchesAllTags(tags, rule.tags)) continue;
    const subtype = SUPPORTED_CATEGORIES.find((c) => c.key === rule.categoryKey);
    if (subtype) return subtype.label;
  }
  return requested.label;
}
