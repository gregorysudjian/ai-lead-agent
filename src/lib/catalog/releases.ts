/**
 * Which Overture release to load next, and whether a release looks safe.
 *
 * Pure. The scheduled refresh (`scripts/catalog-refresh.mts`) fetches the
 * bucket listing and the catalog's counts; every decision about them is made
 * here, where it can be tested without a network or a database.
 */

/** "2026-08-19.0": an ISO date and a revision number. */
export const RELEASE_NAME = /^\d{4}-\d{2}-\d{2}\.\d+$/;

/**
 * Release names from Overture's public S3 listing (`?list-type=2&prefix=release/
 * &delimiter=/`), which returns one `<Prefix>release/<name>/</Prefix>` per
 * release. Anything that is not a well-formed name is ignored rather than
 * trusted: the name ends up in an S3 path.
 */
export function parseReleaseListing(xml: string): string[] {
  const names = [...xml.matchAll(/<Prefix>release\/([^/<]+)\/<\/Prefix>/g)].map((m) => m[1]);
  return [...new Set(names.filter((name) => RELEASE_NAME.test(name)))].sort(compareReleases);
}

/** Oldest first. Dates compare as text; the revision compares as a number. */
export function compareReleases(a: string, b: string): number {
  const [dateA, revA] = a.split(".");
  const [dateB, revB] = b.split(".");
  return dateA.localeCompare(dateB) || Number(revA) - Number(revB);
}

/**
 * The newest available release, if it is newer than the one loaded -- or
 * null when the catalog is up to date. With nothing loaded yet, the newest.
 */
export function nextReleaseToLoad(available: readonly string[], loaded: string | null): string | null {
  const valid = available.filter((name) => RELEASE_NAME.test(name)).sort(compareReleases);
  const newest = valid.at(-1) ?? null;
  if (newest === null) return null;
  if (loaded !== null && compareReleases(newest, loaded) <= 0) return null;
  return newest;
}

/** Below this share of today's listed businesses, a release is suspect. */
export const MIN_RELEASE_SHARE = 0.8;

export type RefreshAssessment =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * The circuit breaker.
 *
 * A refresh marks every business the new release does not list as "no longer
 * listed". A truncated or broken release -- a partial upload, a changed
 * schema that filters everything out -- would therefore mark hundreds of real
 * businesses gone in one run. Nothing is deleted, so it is recoverable, but it
 * would make the list wrong until someone noticed. So a release far smaller
 * than what is listed today stops the run and is reported instead.
 *
 * A normal month moves a few percent; a fifth is not a normal month.
 */
export function assessRefresh(input: { listedNow: number; incoming: number }): RefreshAssessment {
  const { listedNow, incoming } = input;
  if (incoming === 0) return { ok: false, reason: "The release produced no businesses for this area." };
  if (listedNow > 0 && incoming < listedNow * MIN_RELEASE_SHARE) {
    const share = Math.round((incoming / listedNow) * 100);
    return {
      ok: false,
      reason: `The release lists ${incoming} businesses, ${share}% of the ${listedNow} listed today (minimum ${Math.round(MIN_RELEASE_SHARE * 100)}%). Stopping rather than marking the rest as no longer listed.`,
    };
  }
  return { ok: true };
}
