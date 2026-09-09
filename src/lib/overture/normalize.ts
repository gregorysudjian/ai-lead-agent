import { isUsableText } from "../scoring";
import type { DiscoveredBusiness } from "../types";
import { mapOvertureCategory } from "./categories";

/**
 * Convert an Overture place into a `DiscoveredBusiness`.
 *
 * Same discipline as `osm/normalize.ts`: pure, total, and it invents nothing.
 * A field Overture does not carry stays `null` -- "nobody told us" -- and is
 * never filled with a plausible value.
 *
 * ── WHAT OVERTURE DOES NOT HAVE ───────────────────────────────────────────
 *
 * `rating` and `reviewCount` are always null. Overture is not a review
 * platform and nothing in its schema substitutes for one; fabricating either
 * would poison the deterministic score with invented data, which is the same
 * reason the OSM normaliser refuses.
 *
 * `openingHours` is always null. Overture's places schema carries no hours at
 * all, which is a real gap against OSM -- and exactly why an OSM lead and an
 * Overture lead for the same shop are both worth having. The parser in
 * `osm/opening-hours.ts` has nothing to read here.
 *
 * ── CONFIDENCE IS NOT STORED ──────────────────────────────────────────────
 *
 * Overture scores every place 0-1, and a low score often means the place may
 * not exist. That matters enormously, and it is applied as an INGEST FILTER
 * rather than becoming a field: storing it would mean changing the domain
 * type, every other provider, the leads table and a migration, to carry a
 * number only one source can supply. `shouldIngest` below is where the
 * judgement lives, so the decision is visible and testable in one place.
 *
 * Pure and total: no I/O, no clock, never throws.
 */

/**
 * The subset of an Overture place row this reads.
 *
 * Written as the shape the parquet actually yields rather than the full
 * schema, so a change upstream surfaces here as a type error rather than as
 * silently missing data.
 */
export interface OverturePlace {
  id?: unknown;
  names?: { primary?: unknown } | null;
  categories?: { primary?: unknown } | null;
  confidence?: unknown;
  websites?: unknown;
  phones?: unknown;
  addresses?: unknown;
}

export interface NormalizeOvertureOptions {
  /** ISO timestamp, supplied by the caller so this function stays pure. */
  fetchedAt: string;
  /**
   * Fallback city label.
   *
   * Used only when a place carries no locality of its own. Overture addresses
   * usually do, but a handful are incomplete, and a lead with no city cannot
   * be searched for or shown sensibly.
   */
  cityLabel: string;
}

/** First usable string in what may be an array, a string, or nothing. */
function firstString(value: unknown): string | null {
  if (typeof value === "string") return isUsableText(value) ? value.trim() : null;
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    if (typeof entry === "string" && isUsableText(entry)) return entry.trim();
  }
  return null;
}

/** The first address object, or null. */
function firstAddress(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (typeof entry === "object" && entry !== null) return entry as Record<string, unknown>;
  }
  return null;
}

function addressField(address: Record<string, unknown> | null, key: string): string | null {
  if (address === null) return null;
  const value = address[key];
  return typeof value === "string" && isUsableText(value) ? value.trim() : null;
}

/**
 * The confidence below which a place is not worth ingesting.
 *
 * Overture's own scale. In Montreal, 302 of the no-website places score under
 * 0.3 and a further 221 under 0.4 -- a meaningful share of which are closed,
 * duplicated or never existed. Approaching a business that is not there wastes
 * the operator's time and looks careless.
 *
 * 0.5 keeps roughly four fifths of the addressable set. It is a deliberate
 * trade and the ingest script exposes it as a flag.
 */
export const MIN_CONFIDENCE = 0.5;

/** Is this place solid enough to become a lead? */
export function shouldIngest(place: OverturePlace, minConfidence = MIN_CONFIDENCE): boolean {
  const confidence = typeof place.confidence === "number" ? place.confidence : null;
  // A missing confidence is treated as failing. Overture supplies one on every
  // place, so its absence means the row is not what we think it is.
  if (confidence === null || !Number.isFinite(confidence)) return false;
  return confidence >= minConfidence;
}

/**
 * Normalise one place, or return null if it is unusable.
 *
 * Returns null when there is no real name, no id, or no category we recognise.
 * A nameless place is not a lead we could act on, and a place in a trade we do
 * not sell to is noise -- see `categories.ts` for why an unrecognised category
 * is refused rather than approximated.
 */
export function normalizeOverturePlace(
  place: OverturePlace,
  options: NormalizeOvertureOptions,
): DiscoveredBusiness | null {
  const name = firstString(place.names?.primary);
  if (name === null) return null;

  // The GERS id. Stable across releases and Overture's own identifier, which
  // is exactly what an `externalId` is for -- and, like the OSM id, never our
  // primary key.
  const externalId = typeof place.id === "string" && place.id.trim().length > 0 ? place.id.trim() : null;
  if (externalId === null) return null;

  const category = mapOvertureCategory(
    typeof place.categories?.primary === "string" ? place.categories.primary : null,
  );
  if (category === null) return null;

  const address = firstAddress(place.addresses);

  return {
    externalId,
    source: "overture",
    name,
    category: category.label,
    city: addressField(address, "locality") ?? options.cityLabel,
    address: addressField(address, "freeform"),
    phone: firstString(place.phones),
    // Preserved exactly as given, never repaired and never prefixed with a
    // scheme. Whether a listed link is actually the business's own site is
    // `social-hosts.ts`'s judgement, made later and in one place -- a Yellow
    // Pages entry stays non-null here so it is visible rather than erased.
    website: firstString(place.websites),
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: options.fetchedAt,
  };
}

/**
 * Normalise a batch, dropping unusable rows and exact duplicate ids.
 *
 * Overture can list the same GERS id more than once across partitions when a
 * query spans them. Collapsing by id is exact and safe; anything fuzzier is
 * the lead repository's dedupe, which already knows how to match a business
 * that reappears under a different identifier.
 */
export function normalizeOverturePlaces(
  places: readonly OverturePlace[],
  options: NormalizeOvertureOptions,
): DiscoveredBusiness[] {
  const seen = new Set<string>();
  const businesses: DiscoveredBusiness[] = [];

  for (const place of places) {
    const business = normalizeOverturePlace(place, options);
    if (business === null) continue;
    if (seen.has(business.externalId)) continue;
    seen.add(business.externalId);
    businesses.push(business);
  }

  return businesses;
}
