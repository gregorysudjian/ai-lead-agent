/**
 * Overpass QL construction.
 *
 * Pure and deterministic: the same city and category always produce the same
 * query string, which makes it testable without touching the network.
 *
 * The query is assembled ONLY from the curated city and category registries.
 * Free text never reaches this module -- callers resolve input to registry
 * entries first, and unresolved input is rejected before any query exists.
 */
import type { SupportedCategory, OsmTagSelector } from "./categories";
import type { SupportedCity } from "./cities";

/**
 * Tokens permitted inside a query.
 *
 * Belt-and-braces: the registries are code, not user input, so this can only
 * fail if a developer adds a malformed entry. It exists so that a mistake
 * becomes a loud error here rather than a malformed -- or injected -- query
 * reaching shared infrastructure.
 */
const SAFE_TOKEN = /^[A-Za-z0-9_:.-]+$/;

function assertSafeToken(value: string, what: string): string {
  if (!SAFE_TOKEN.test(value)) {
    throw new Error(`Unsafe ${what} in Overpass query registry: ${JSON.stringify(value)}`);
  }
  return value;
}

/** Render one selector's tags as an AND-ed filter, e.g. `["shop"="beauty"]["beauty"="nails"]`. */
function renderSelector(selector: OsmTagSelector): string {
  return Object.entries(selector)
    .map(
      ([key, value]) =>
        `["${assertSafeToken(key, "tag key")}"="${assertSafeToken(value, "tag value")}"]`,
    )
    .join("");
}

export interface OverpassQueryOptions {
  /** Server-side seconds budget Overpass itself should honour. */
  timeoutSeconds?: number;
  /** Hard ceiling on elements returned, so a query cannot pull a whole city. */
  limit?: number;
}

export const DEFAULT_QUERY_TIMEOUT_SECONDS = 25;

/**
 * Most businesses a single search will ever show or store.
 *
 * Bounded on purpose: this is an internal review workflow, not a bulk export,
 * and the public Overpass instance is shared community infrastructure.
 */
export const DISPLAY_RESULT_LIMIT = 60;

/**
 * What we actually ask Overpass for: one MORE than we will show.
 *
 * The extra element is a truncation sentinel, nothing else. If the response
 * contains more than DISPLAY_RESULT_LIMIT elements we know the area holds
 * further matches, and the UI can say so instead of leaving the user unable to
 * tell "exactly 60 exist" from "we stopped at 60". The 61st element is never
 * normalized, shown or stored.
 *
 * This costs one extra element per search -- far cheaper than a second request
 * or a count query, and it needs no pagination.
 */
export const OVERPASS_QUERY_LIMIT = DISPLAY_RESULT_LIMIT + 1;

/**
 * Build a bounded Overpass query for one category inside one city.
 *
 * Shape and rationale:
 *   - the search area is pinned by the city's Wikidata id, not a name match
 *   - node, way and relation are all queried, since businesses are mapped as
 *     points and as building outlines
 *   - `out center tags` returns tags plus a single centre point, avoiding full
 *     geometry download for ways and relations
 *   - an explicit result limit keeps the response small and bounded
 */
export function buildOverpassQuery(
  city: SupportedCity,
  category: SupportedCategory,
  options: OverpassQueryOptions = {},
): string {
  const timeout = options.timeoutSeconds ?? DEFAULT_QUERY_TIMEOUT_SECONDS;
  const limit = options.limit ?? OVERPASS_QUERY_LIMIT;

  if (!Number.isInteger(timeout) || timeout <= 0 || timeout > 180) {
    throw new Error(`Invalid Overpass timeout: ${timeout}`);
  }
  if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
    throw new Error(`Invalid Overpass result limit: ${limit}`);
  }

  const wikidata = assertSafeToken(city.wikidataId, "wikidata id");

  const clauses = category.selectors.flatMap((selector) => {
    const filter = renderSelector(selector);
    return ["node", "way", "relation"].map(
      (element) => `  ${element}${filter}(area.searchArea);`,
    );
  });

  return [
    `[out:json][timeout:${timeout}];`,
    `area["boundary"="administrative"]["wikidata"="${wikidata}"]->.searchArea;`,
    "(",
    ...clauses,
    ");",
    `out center tags ${limit};`,
  ].join("\n");
}
