/**
 * Pure transformation from raw OSM elements into our domain type.
 *
 * Raw provider JSON never reaches the repository: it passes through here first,
 * and only normalized fields survive. The full tag object is deliberately NOT
 * carried into `DiscoveredBusiness` -- we persist what the domain needs and
 * nothing more.
 */
import { classifyOsmCategory, type SupportedCategory } from "./categories";
import type { DiscoveredBusiness } from "../types";
import { parseOsmOpeningHours } from "./opening-hours";

export type OsmElementType = "node" | "way" | "relation";

/**
 * The subset of an Overpass element we rely on, AFTER validation.
 *
 * `type` is the narrow union rather than `string`: once an element has passed
 * `isUsableOsmElement`, only these three values are possible, and the type
 * system should say so. Untrusted input still enters as `unknown` and is
 * narrowed by the runtime validator below.
 */
export interface OsmElement {
  type: OsmElementType;
  id: number;
  tags?: Record<string, string>;
}

const ELEMENT_TYPES: readonly string[] = ["node", "way", "relation"];

/**
 * Structural validation of one element from an untrusted upstream response.
 *
 * Ids must be positive SAFE integers. OSM ids are integers, so a decimal,
 * zero, a negative, NaN or an Infinity is malformed data rather than an object
 * we could address -- and a value beyond Number.MAX_SAFE_INTEGER cannot be
 * round-tripped without silently changing, which would produce an externalId
 * pointing at a different object.
 */
export function isUsableOsmElement(value: unknown): value is OsmElement {
  if (typeof value !== "object" || value === null) return false;
  const element = value as { type?: unknown; id?: unknown };
  return (
    typeof element.type === "string" &&
    ELEMENT_TYPES.includes(element.type) &&
    typeof element.id === "number" &&
    Number.isSafeInteger(element.id) &&
    element.id > 0
  );
}

/**
 * Stable provider identifier: element type + OSM id.
 *
 * The type prefix is essential -- node 123 and way 123 are different objects,
 * and a bare numeric id would silently merge them under our dedupe rules.
 */
export function osmExternalId(element: OsmElement): string {
  return `${element.type}/${element.id}`;
}

/** First non-empty trimmed tag value, in the given precedence order. */
function firstTagValue(
  tags: Record<string, string>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const raw = tags[key];
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  }
  return null;
}

/** Documented precedence: the `contact:` namespace wins over the bare key. */
const PHONE_KEYS = ["contact:phone", "phone", "contact:mobile", "mobile"] as const;
const WEBSITE_KEYS = ["contact:website", "website"] as const;
const NAME_KEYS = ["name", "official_name", "brand"] as const;

/**
 * Human-readable address assembled ONLY from tags that actually exist.
 *
 * No reverse geocoding, no inference from coordinates, no calls to another
 * service. If OSM does not carry enough to identify a specific street address,
 * the result is `null`.
 *
 * BOTH a house number and a street are required, deliberately. This is not just
 * formatting fussiness -- the address is half of our secondary dedupe key
 * (normalized name + normalized address). A street on its own is far too coarse
 * for that: two genuinely different salons of the same name on the same long
 * street would produce identical keys and be falsely merged into one lead,
 * silently destroying a real business. A false merge is worse than an absent
 * address, and a lead with `address: null` is perfectly valid -- dedupe already
 * refuses to match on a missing address, which is the conservative outcome.
 */
export function buildOsmAddress(tags: Record<string, string>): string | null {
  const street = firstTagValue(tags, ["addr:street"]);
  const houseNumber = firstTagValue(tags, ["addr:housenumber"]);
  // Neither half is sufficient alone; a postcode or city cannot substitute.
  if (street === null || houseNumber === null) return null;

  const unit = firstTagValue(tags, ["addr:unit"]);
  const city = firstTagValue(tags, ["addr:city"]);
  const province = firstTagValue(tags, ["addr:province", "addr:state"]);
  const postcode = firstTagValue(tags, ["addr:postcode"]);

  const line = `${houseNumber} ${street}`;
  const withUnit = unit ? `${line}, Unit ${unit}` : line;

  return [withUnit, city, province, postcode].filter(Boolean).join(", ");
}

export interface NormalizeOptions {
  /**
   * The registry category the search resolved to.
   *
   * Used as the fallback label. When the element's own tags identify a known
   * subtype (a barber, a nail salon), that subtype wins instead -- so the stored
   * category does not flip depending on which overlapping search ran last.
   */
  requestedCategory: SupportedCategory;
  /** Canonical city label from our registry. */
  cityLabel: string;
  /** ISO timestamp, supplied by the caller so this function stays pure. */
  fetchedAt: string;
}

/**
 * Convert one OSM element into a DiscoveredBusiness, or null if unusable.
 *
 * Returns null when there is no real business name. We never invent one, and a
 * nameless POI is not a lead we could act on.
 *
 * `rating` and `reviewCount` are always null: OpenStreetMap is not a review
 * platform and nothing in its tags is a substitute. Fabricating or inferring
 * them would poison the Phase 4 score with invented data.
 *
 * `openingHours` is parsed from OSM's `opening_hours` by a deliberately narrow
 * parser that understands the whole value or none of it. The original reason
 * for discarding the tag still stands -- "a partial parser would render
 * confident but wrong 'Closed' days, which is worse than admitting we have no
 * data" -- so `parseOsmOpeningHours` refuses everything outside a small,
 * unambiguous subset and returns null rather than a half-understood schedule.
 * Hours are the most useful thing a small business publishes and Overpass
 * already sends them, so the tag is worth reading; it is only worth reading
 * safely.
 */
export function normalizeOsmElement(
  element: OsmElement,
  options: NormalizeOptions,
): DiscoveredBusiness | null {
  const tags = element.tags ?? {};

  const name = firstTagValue(tags, NAME_KEYS);
  if (name === null) return null;

  return {
    externalId: osmExternalId(element),
    source: "osm",
    name,
    category: classifyOsmCategory(tags, options.requestedCategory),
    city: options.cityLabel,
    address: buildOsmAddress(tags),
    phone: firstTagValue(tags, PHONE_KEYS),
    // Preserved exactly as OSM holds it. Never repaired, never prefixed with a
    // scheme. classifyWebsite() remains the sole authority on link safety, and
    // a malformed-but-present value stays non-null so it does not earn the
    // "no website listed" scoring signal.
    website: firstTagValue(tags, WEBSITE_KEYS),
    rating: null,
    reviewCount: null,
    openingHours: parseOsmOpeningHours(tags.opening_hours),
    fetchedAt: options.fetchedAt,
  };
}

/**
 * Normalize a batch, dropping exact duplicate OSM objects first.
 *
 * A category with several selectors (dentists) can return the same element
 * twice. Collapsing by element type + id is exact and safe; anything fuzzier
 * belongs nowhere near deduplication.
 */
export function normalizeOsmElements(
  elements: readonly unknown[],
  options: NormalizeOptions,
): DiscoveredBusiness[] {
  const seen = new Set<string>();
  const businesses: DiscoveredBusiness[] = [];

  for (const candidate of elements) {
    if (!isUsableOsmElement(candidate)) continue;

    const id = osmExternalId(candidate);
    if (seen.has(id)) continue;
    seen.add(id);

    const business = normalizeOsmElement(candidate, options);
    if (business !== null) businesses.push(business);
  }

  return businesses;
}

/**
 * Safe link to an object on openstreetmap.org.
 *
 * Built only from a strictly validated `type/id` external id -- the raw string
 * is never interpolated into an href without passing this check. Returns null
 * for anything unexpected, and the UI then renders no link.
 */
export function osmObjectUrl(externalId: string): string | null {
  const match = /^(node|way|relation)\/([0-9]{1,19})$/.exec(externalId);
  if (!match) return null;

  const [, type, id] = match;
  if (!/^[1-9][0-9]*$/.test(id)) return null;

  return `https://www.openstreetmap.org/${type}/${id}`;
}
