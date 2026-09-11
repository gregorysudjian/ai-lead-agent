import { SUPPORTED_CATEGORIES, type SupportedCategory } from "../osm/categories";

/**
 * Overture's category taxonomy, mapped onto the twelve trades we sell to.
 *
 * ── WRITTEN AGAINST REAL DATA, NOT A GUESS ────────────────────────────────
 *
 * Overture uses 860 distinct categories in Quebec alone with 25+ places each.
 * Every entry below was read out of the actual dataset (`overture-probe.mjs`
 * and a one-off category listing), because the two failure modes here are both
 * silent: a mapping for a category that never appears is dead code, and a
 * category that appears and we missed is an entire trade quietly excluded from
 * every search we run.
 *
 * ── MANY-TO-ONE, AND UNKNOWN MEANS NO ─────────────────────────────────────
 *
 * Several Overture categories are the same trade to us -- `cafe` and
 * `coffee_shop`, `florist` and `flowers_and_gifts_shop` -- so the mapping is
 * many-to-one. Anything not listed maps to `null` and is skipped, rather than
 * being forced into the nearest neighbour. A bakery filed under "restaurant"
 * produces a demo site about the wrong kind of business, and the owner sees
 * that in about two seconds.
 *
 * ── WHY THE EXCLUSIONS ARE WRITTEN DOWN ───────────────────────────────────
 *
 * `EXCLUDED` is not decoration. It records judgement calls that a later reader
 * would otherwise have to make again from scratch, and it protects against the
 * obvious keyword shortcut: `it_service_and_computer_repair` contains "repair"
 * and is not a garage, `car_wash` and `car_dealer` contain "car" and do not fix
 * anything. Every entry there is a real Overture category that a careless rule
 * would have swept in.
 *
 * Pure and total: no I/O, no clock, never throws.
 */

/** Overture category -> our category key. */
const EXACT: Readonly<Record<string, string>> = {
  // Hair and grooming. Distinct trades that read as one to an outsider, and
  // are not: a barber shop and a hair salon pitch differently.
  hair_salon: "hair-salon",
  // The same chair under narrower names. `hair_extensions` places are salons
  // that specialise; they sell a service in a chair, not a product off a shelf.
  hair_stylist: "hair-salon",
  kids_hair_salon: "hair-salon",
  hair_extensions: "hair-salon",
  barber: "barber",
  nail_salon: "nail-salon",

  // Beauty. `spas` and `day_spa` are the same shop by another name.
  beauty_salon: "beauty-salon",
  spas: "beauty-salon",
  day_spa: "beauty-salon",
  // Esthetics services Overture files separately. Each is performed in a
  // salon chair by the same kind of small business, and pitched the same way.
  waxing: "beauty-salon",
  threading_service: "beauty-salon",
  eyelash_service: "beauty-salon",
  eyebrow_service: "beauty-salon",

  // Tattoo and piercing, one trade: most studios do both.
  tattoo_and_piercing: "tattoo",
  tattoo: "tattoo",
  piercing: "tattoo",

  // Food. The long tail of cuisines is handled by the suffix rule below.
  restaurant: "restaurant",
  cafe: "cafe",
  coffee_shop: "cafe",
  bakery: "bakery",

  // Health. `general_dentistry` is how Overture labels most practices.
  dentist: "dentist",
  general_dentistry: "dentist",
  pharmacy: "pharmacy",

  gym: "gym",

  // Flowers. `flowers_and_gifts_shop` is seven times commoner than `florist`
  // in Quebec, so mapping only the obvious name would have missed most of them.
  florist: "florist",
  flowers_and_gifts_shop: "florist",

  // Vehicle repair, but only the ones that actually repair.
  automotive_repair: "car-repair",
  automotive_services_and_repair: "car-repair",
  auto_body_shop: "car-repair",
  auto_glass_service: "car-repair",
  tire_dealer_and_repair: "car-repair",
};

/**
 * Suffix rules, for families too long to enumerate.
 *
 * Overture names cuisines as separate categories -- `pizza_restaurant`,
 * `sushi_restaurant`, `italian_restaurant`, `lebanese_restaurant` and dozens
 * more. Listing them individually would go stale the moment a cuisine is
 * added, and every one of them is a restaurant.
 *
 * Deliberately the ONLY pattern rule. Patterns are how a computer repair shop
 * becomes a garage; this one is safe because the suffix is the noun.
 */
const SUFFIX_RULES: readonly [string, string][] = [["_restaurant", "restaurant"]];

/**
 * Overture categories that look like one of ours and are not.
 *
 * Kept as data rather than as a comment so the reasoning survives, and so a
 * test can assert none of them ever maps. Each line is a decision:
 *
 *   - selling or cleaning a car is not repairing one
 *   - a computer repair shop matches "repair" and is not a garage
 *   - a medical spa and a tanning salon are different trades from a beauty
 *     salon, with different customers and a different pitch
 *   - a personal trainer is not a gym; they often work inside someone else's
 *   - `personal_care_service` and `skin_care` are too broad to place
 *     confidently, and this file's rule is that unconfident means no
 *   - a makeup artist is usually a freelancer with no premises; a demo about
 *     "the salon" would describe a place that does not exist
 *   - laser hair removal and hair replacement are clinics, not salons
 *   - beauty and hair SUPPLY stores sell products off a shelf; they share a
 *     word with a salon and nothing else
 */
export const EXCLUDED: readonly string[] = [
  "car_dealer",
  "used_car_dealer",
  "car_rental_agency",
  "car_wash",
  "auto_detailing",
  "auto_parts_and_supply_store",
  "truck_repair",
  "it_service_and_computer_repair",
  "medical_spa",
  "tanning_salon",
  "massage_therapy",
  "fitness_trainer",
  "martial_arts_club",
  "personal_care_service",
  "skin_care",
  "makeup_artist",
  "laser_hair_removal",
  "hair_removal",
  "hair_replacement",
  "hair_supply_stores",
  "cosmetic_and_beauty_supplies",
  "beauty_product_supplier",
  "cosmetology_school",
  "retirement_home",
  "day_care_preschool",
];

/**
 * The category a business belongs to, or null when we cannot say.
 *
 * Returns the registry entry rather than a bare string, so callers get the
 * canonical label the rest of the application stores and displays without
 * having to look it up again.
 */
export function mapOvertureCategory(value: string | null | undefined): SupportedCategory | null {
  if (typeof value !== "string") return null;

  const needle = value.trim().toLowerCase();
  if (needle.length === 0) return null;

  // An exclusion beats everything, including the suffix rule. That ordering is
  // the point: it is what stops a future pattern from quietly re-including
  // something this file has already decided against.
  if (EXCLUDED.includes(needle)) return null;

  const exact = EXACT[needle];
  if (exact) return byKey(exact);

  for (const [suffix, key] of SUFFIX_RULES) {
    if (needle.endsWith(suffix)) return byKey(key);
  }

  return null;
}

function byKey(key: string): SupportedCategory | null {
  return SUPPORTED_CATEGORIES.find((category) => category.key === key) ?? null;
}

/** Every Overture category we recognise. Exported for tests and reporting. */
export function mappedOvertureCategories(): string[] {
  return Object.keys(EXACT);
}
