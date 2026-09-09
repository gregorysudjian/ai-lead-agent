import { normalizeTerm } from "../normalize";
import { COUNTRIES, SUBDIVISIONS } from "./registry";
import type { RegionResolution, ResolvedRegion } from "./types";

/**
 * Turn free-text region input into something the pipeline can query.
 *
 * ── THE ONE INTERESTING PROBLEM: COLLISIONS ───────────────────────────────
 *
 * "CA" is Canada and California. "Vancouver" is in British Columbia and in
 * Washington. "Ontario" is a Canadian province and a city in California.
 * "Georgia" is a US state and a country.
 *
 * A resolver that picks one and carries on is a resolver that will eventually
 * search the wrong half of a continent, and the operator will not find out
 * until a draft is addressed to a business two thousand miles from where they
 * meant. So a genuine collision is returned as `ambiguous` with every
 * candidate, and the caller asks. That is slower and it is correct.
 *
 * The cost is paid only where it is real: an input matching exactly one entry
 * resolves without ceremony, which is almost all of them.
 *
 * ── SEARCH ORDER ──────────────────────────────────────────────────────────
 *
 * Localities, then subdivisions, then countries -- smallest first. A user who
 * types a city name means the city; the only reason to consider a larger
 * reading is that nothing smaller matched. Where two levels both match, that
 * is exactly the collision case above and both are returned.
 *
 * Pure and total: no I/O, no clock, never throws.
 */

/**
 * A locality the caller already knows about.
 *
 * Supplied rather than looked up, because locality data belongs to the dataset
 * ingest and not to this module -- see `LOCALITY_SOURCE_NOTE`. Passing them in
 * keeps the resolver finished and pure while its data source is still pending,
 * and keeps it testable without a database.
 */
export interface KnownLocality {
  label: string;
  country: string;
  subdivision: string | null;
  aliases?: readonly string[];
}

export interface ResolveOptions {
  /**
   * Localities to consider. Empty by default, which is honest: without the
   * divisions ingest this resolver genuinely cannot place a city.
   */
  localities?: readonly KnownLocality[];
}

function countryRegion(code: string): ResolvedRegion | null {
  const entry = COUNTRIES.find((country) => country.code === code);
  if (!entry) return null;
  return {
    kind: "country",
    label: entry.label,
    country: entry.code,
    subdivision: null,
    locality: null,
    bbox: entry.bbox,
  };
}

/** Every registry entry whose aliases contain `needle`, smallest area first. */
function matches(needle: string, localities: readonly KnownLocality[]): ResolvedRegion[] {
  const found: ResolvedRegion[] = [];

  for (const locality of localities) {
    const aliases = locality.aliases ?? [locality.label];
    if (aliases.some((alias) => normalizeTerm(alias) === needle)) {
      found.push({
        kind: "locality",
        label: locality.label,
        country: locality.country,
        subdivision: locality.subdivision,
        locality: locality.label,
        // A locality's box comes from the divisions ingest, which is also
        // where the locality itself came from. Null here rather than a guess.
        bbox: null,
      });
    }
  }

  for (const subdivision of SUBDIVISIONS) {
    if (subdivision.aliases.some((alias) => normalizeTerm(alias) === needle)) {
      found.push({
        kind: "subdivision",
        label: subdivision.label,
        country: subdivision.country,
        subdivision: subdivision.code,
        locality: null,
        // A subdivision is selected by its code on an address, so a box would
        // be decoration. See the note at the top of `types.ts`.
        bbox: null,
      });
    }
  }

  for (const country of COUNTRIES) {
    if (country.aliases.some((alias) => normalizeTerm(alias) === needle)) {
      const region = countryRegion(country.code);
      if (region) found.push(region);
    }
  }

  return found;
}

/**
 * Resolve free-text region input.
 *
 * Returns `resolved` for exactly one match, `ambiguous` for more than one, and
 * `unsupported` for none -- never a silent choice between real places.
 */
export function resolveRegion(input: string, options: ResolveOptions = {}): RegionResolution {
  const needle = normalizeTerm(input);

  if (needle.length === 0) {
    return { status: "unsupported", input, reason: "Enter a city, state or country." };
  }

  const found = matches(needle, options.localities ?? []);

  if (found.length === 1) {
    return { status: "resolved", region: found[0] };
  }

  if (found.length > 1) {
    return { status: "ambiguous", input, candidates: found };
  }

  // Nothing matched. The message distinguishes the two reasons a real place
  // can fail here, because they have different fixes and a user cannot tell
  // them apart from "not supported".
  return {
    status: "unsupported",
    input,
    reason:
      (options.localities?.length ?? 0) === 0
        ? "Not a country or state we cover. City search needs the region data import."
        : "Not a place we cover. Try a state, a province, or a country.",
  };
}

/**
 * Narrow an ambiguous result once the user has chosen.
 *
 * Takes the candidate list back rather than re-resolving, so the choice is
 * made against exactly what was offered. Returns null if the pick is not one
 * of them -- a stale form post must not resolve to something never shown.
 */
export function chooseRegion(
  resolution: RegionResolution,
  pick: { kind: string; country: string; subdivision: string | null; locality: string | null },
): ResolvedRegion | null {
  if (resolution.status !== "ambiguous") return null;

  return (
    resolution.candidates.find(
      (candidate) =>
        candidate.kind === pick.kind &&
        candidate.country === pick.country &&
        candidate.subdivision === pick.subdivision &&
        candidate.locality === pick.locality,
    ) ?? null
  );
}

/**
 * A stable identifier for a resolved region.
 *
 * Used as the key on a batch job, so two runs over "Texas" are recognisably
 * the same area. Built from the codes rather than the label because a label
 * is presentation and could be re-worded.
 */
export function regionKey(region: ResolvedRegion): string {
  const parts = [region.country, region.subdivision ?? "", region.locality ?? ""];
  return parts.join(":").replace(/:+$/, "");
}

/** Everything the resolver currently accepts, for an error message or a UI. */
export function supportedRegionLabels(): string[] {
  return [...COUNTRIES.map((c) => c.label), ...SUBDIVISIONS.map((s) => s.label)];
}
