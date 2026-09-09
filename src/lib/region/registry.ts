/**
 * The regions this system can search: countries and their subdivisions.
 *
 * ── WHY A CURATED REGISTRY, AGAIN ─────────────────────────────────────────
 *
 * The same reason `osm/cities.ts` is one: user text never becomes a query.
 * It is resolved against known entries first, and anything unrecognised is
 * rejected before a dataset is touched. That rule already exists in
 * CLAUDE.md for cities and categories; this extends it upward to states and
 * countries rather than inventing a second approach beside it.
 *
 * ── WHY THIS DATA IS SAFE TO HARDCODE ─────────────────────────────────────
 *
 * ISO 3166 country and subdivision codes are stable public reference data
 * that changes on the order of once a decade. Fetching them at runtime would
 * add a dependency and a failure mode to something that has neither. Locality
 * names are the opposite -- there are tens of thousands and they change -- so
 * they are NOT hardcoded here; see `LOCALITY_SOURCE_NOTE` below.
 *
 * ── SCOPE ─────────────────────────────────────────────────────────────────
 *
 * United States and Canada. Adding a country means adding its entry and its
 * subdivisions here, and nothing else: the resolver reads this file and has no
 * country-specific logic of its own.
 *
 * Pure data. No I/O, no clock.
 */
import { normalizeTerm } from "../normalize";
import type { BoundingBox } from "./types";

export interface RegistryCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  label: string;
  /** Accepted spellings, compared after `normalizeTerm`. */
  aliases: string[];
  bbox: BoundingBox;
}

export interface RegistrySubdivision {
  /** ISO 3166-2 code without the country prefix: "TX", not "US-TX". */
  code: string;
  label: string;
  /** ISO 3166-1 alpha-2 of the country this belongs to. */
  country: string;
  aliases: string[];
}

/**
 * Normalise and deduplicate an alias list at build time.
 *
 * Aliases are authored naturally above -- "québec" with its accent, because
 * that is how it is written -- but `resolveRegion` compares after
 * `normalizeTerm`, so a stored alias that is not already normalised can never
 * be matched literally and, worse, "québec" and "quebec" survive a raw
 * `Set` as two entries that mean one thing. Normalising here makes the
 * deduplication real and the stored form the same form the lookup uses.
 */
function normalisedAliases(aliases: readonly string[]): string[] {
  return [...new Set(aliases.map(normalizeTerm))].filter((alias) => alias.length > 0);
}

/**
 * Bounding boxes are approximate and deliberately generous.
 *
 * They exist to sanity-check a coordinate, never to decide membership --
 * membership comes from the subdivision code on an address. A box that is
 * slightly too large costs nothing; one that is too small would silently drop
 * real businesses at the edge of a state.
 *
 * The continental figures below exclude nothing: the US box spans Alaska and
 * Hawaii, which is why it is so wide.
 */
const RAW_COUNTRIES: readonly RegistryCountry[] = [
  {
    code: "US",
    label: "United States",
    aliases: ["us", "usa", "u s", "u s a", "united states", "united states of america", "america"],
    bbox: [-179.15, 18.91, -66.95, 71.39],
  },
  {
    code: "CA",
    label: "Canada",
    // Deliberately NOT "can": a common English word, and "ca"/"canada"
    // already cover every way anyone actually types this.
    aliases: ["canada", "ca"],
    bbox: [-141.0, 41.68, -52.62, 83.11],
  },
];

export const COUNTRIES: readonly RegistryCountry[] = RAW_COUNTRIES.map((country) => ({
  ...country,
  aliases: normalisedAliases(country.aliases),
}));

/**
 * US states, DC, and the inhabited territories.
 *
 * Territories are included because they are real markets with real businesses
 * and excluding them would be an arbitrary gap, not a decision.
 */
const US_SUBDIVISIONS: readonly RegistrySubdivision[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["DC", "District of Columbia"],
  ["PR", "Puerto Rico"], ["VI", "U.S. Virgin Islands"], ["GU", "Guam"],
  ["AS", "American Samoa"], ["MP", "Northern Mariana Islands"],
].map(([code, label]) => ({
  code,
  label,
  country: "US",
  // The code and the full name are both accepted. Extra spellings are added
  // case by case below rather than generated, because a generated alias list
  // is how "Wash" quietly starts matching Washington DC.
  aliases: [code.toLowerCase(), label.toLowerCase()],
}));

const CA_SUBDIVISIONS: readonly RegistrySubdivision[] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
  ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"],
  ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
].map(([code, label]) => ({
  code,
  label,
  country: "CA",
  aliases: [code.toLowerCase(), label.toLowerCase()],
}));

/**
 * Spellings the generated lists above cannot produce.
 *
 * Kept separate and explicit. Every entry here is a real thing a user types,
 * not a guess at one -- an over-generous alias list makes ambiguity worse, and
 * ambiguity is the failure mode this module works hardest to avoid.
 */
const EXTRA_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "US:CA": ["calif"],
  "US:DC": ["washington dc", "washington d c", "d c"],
  "US:NY": ["ny state", "new york state"],
  "CA:QC": ["quebec", "québec", "pq"],
  "CA:BC": ["b c"],
  "CA:NL": ["newfoundland", "labrador"],
  "CA:PE": ["pei", "prince edward island"],
  "CA:NT": ["nwt"],
};

export const SUBDIVISIONS: readonly RegistrySubdivision[] = [
  ...US_SUBDIVISIONS,
  ...CA_SUBDIVISIONS,
].map((entry) => {
  const extra = EXTRA_ALIASES[`${entry.country}:${entry.code}`] ?? [];
  // Normalised, which is what makes the deduplication real: "québec" is an
  // explicit extra and "Quebec" is the generated label alias, and only after
  // normalisation are they visibly the same entry.
  return { ...entry, aliases: normalisedAliases([...entry.aliases, ...extra]) };
});

/**
 * Why localities are not in this file.
 *
 * There are tens of thousands in the US and Canada alone, they change, and
 * hardcoding a sample of them would produce a resolver that appears to work
 * and silently rejects most real input -- worse than one that says plainly it
 * cannot do localities yet.
 *
 * They arrive with the dataset ingest: Overture's divisions theme carries
 * ~5.5M administrative features with the hierarchy this registry mirrors
 * (level 1 country, 2 state/province, 4+ local). Until that lands,
 * `resolveRegion` takes localities as an explicit argument, so the resolver
 * is finished and only its data source is pending.
 */
export const LOCALITY_SOURCE_NOTE =
  "Locality resolution is backed by the divisions ingest, not by this registry.";
