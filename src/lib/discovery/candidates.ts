/**
 * The discovery candidate: what one or more sources say they found, BEFORE
 * anything becomes a Lead.
 *
 * ── WHY A SEPARATE OBJECT ─────────────────────────────────────────────────
 *
 * A Lead is durable. It is the thing a BusinessProfile, an Analysis and a
 * DemoSite hang off, and it is the record a human will eventually act on. A
 * search result is none of those things: it is one provider's answer to one
 * question asked at one moment, and most of them will never be worth keeping.
 *
 * Putting search state on Lead would mean every lead carried fields that are
 * meaningless once the search is over -- which source found it THIS time,
 * whether that source was capped, whether we are confident two providers meant
 * the same shop. So candidates are their own type, they live for one request,
 * and nothing here is ever written to a database.
 *
 * Pure by construction: no I/O, no clock, no randomness, no `server-only`
 * import. Every grouping decision below is a function of its inputs, which is
 * what makes "why were these two merged?" answerable.
 */
import { normalizeTerm } from "../normalize";
import type { DiscoveredBusiness } from "../types";

/** A source that can take part in a discovery run. */
export type DiscoverySourceName = "mock" | "osm" | "google";

/**
 * Display order for sources, and the order used to resolve a display field.
 *
 * Fixed rather than configured, so the same candidate always renders the same
 * way whatever order the run happened to dispatch in.
 */
export const DISCOVERY_SOURCE_ORDER: readonly DiscoverySourceName[] = [
  "osm",
  "google",
  "mock",
];

export const DISCOVERY_SOURCE_LABELS: Record<DiscoverySourceName, string> = {
  osm: "OpenStreetMap",
  google: "Google Places",
  mock: "Mock fixtures",
};

/** One source's view of one business, within one run. */
export interface CandidateObservation {
  source: DiscoverySourceName;
  /** That source's own identifier. Only unique within the source. */
  externalId: string;
  /** The normalized record. Transient: never persisted from here. */
  business: DiscoveredBusiness;
}

/** Why two observations were judged to be the same business. */
export type CandidateMatchReason = "same-source-id" | "name-and-address" | "name-and-phone";

/**
 * Where a candidate stands relative to our durable records.
 *
 *   in-leads         a Lead already represents this business. Nothing to do.
 *   can-add          no Lead yet, and at least one source we persist from
 *                    found it, so the established search-and-save path would
 *                    store it.
 *   candidate-only   found ONLY by a source we do not persist from (Google).
 *                    Deliberately not a Lead: promoting it needs a
 *                    verification step that does not exist yet.
 */
export type CandidateState = "in-leads" | "can-add" | "candidate-only";

export const CANDIDATE_STATE_LABELS: Record<CandidateState, string> = {
  "in-leads": "Already in leads",
  "can-add": "Can add as lead",
  "candidate-only": "Candidate only — requires verification",
};

/**
 * The values shown for a candidate.
 *
 * Derived, never raw. No provider payload reaches the UI: each field is one
 * resolved value plus the source that supplied it, so a reader can always see
 * who said what.
 */
export interface CandidateDisplayField<T> {
  value: T;
  source: DiscoverySourceName;
}

export interface CandidateDisplay {
  name: CandidateDisplayField<string>;
  category: CandidateDisplayField<string>;
  city: CandidateDisplayField<string>;
  address: CandidateDisplayField<string> | null;
  phone: CandidateDisplayField<string> | null;
  website: CandidateDisplayField<string> | null;
  /**
   * Which sources listed a website.
   *
   * An empty array means NO SOURCE LISTED ONE. It does not mean the business
   * has no website, and nothing downstream may read it that way: a provider
   * can simply lack the field. The distinction is the same one Lead scoring
   * and the research layer preserve.
   */
  websiteListedBy: DiscoverySourceName[];
}

export interface DiscoveryCandidate {
  /**
   * Deterministic identity for this run: every provider identity in the group,
   * sorted, joined. Stable for the same inputs and readable in a test failure.
   * NOT a database key -- candidates have no durable identity.
   */
  candidateId: string;
  /** Every source that found this business, in fixed display order. */
  foundBy: DiscoverySourceName[];
  /** Kept whole, so no source's identity is erased by a merge. */
  observations: CandidateObservation[];
  /** How the observations after the first were matched in. Empty when alone. */
  matchedBy: CandidateMatchReason[];
  display: CandidateDisplay;
  state: CandidateState;
  /** Our internal Lead id when one already represents this business. */
  existingLeadId: string | null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Digits of a phone number, for exact comparison only.
 *
 * Formatting varies wildly between providers ("+1 514-844-4384" versus
 * "(514) 844-4384"), so the digits are the only comparable part. A leading
 * country code is NOT stripped: dropping it would make two different numbers
 * look equal, and this function exists to avoid exactly that kind of guess.
 */
export function phoneDigits(value: string | null): string | null {
  if (value === null) return null;
  const digits = value.replace(/[^0-9]/g, "");
  // Below this it is not a dialable number, and short strings collide easily.
  return digits.length >= 8 ? digits : null;
}

function usableText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeTerm(value);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Are these two records confidently the same business?
 *
 * CONSERVATIVE BY POLICY. A false merge destroys a real lead silently: two
 * shops become one, and the one that vanished is never noticed. A duplicate,
 * by contrast, is visible and can be merged deliberately later. So every rule
 * here is an EXACT comparison after normalization, and there is no edit
 * distance, no token overlap, no similarity threshold, and no model.
 *
 * Two rules, both requiring the name to match exactly:
 *
 *   name + address   the classic pair. Address alone is not enough (a mall has
 *                    one address and many shops); name alone is nowhere near
 *                    enough ("Salon Milano" is not rare).
 *
 *   name + phone     a second exact witness for the same business when the two
 *                    sources format the address differently -- which they
 *                    routinely do, since one writes "28 Av. des Pins E" where
 *                    the other writes "28 Avenue des Pins Est".
 *
 * Phone ALONE is deliberately not a rule. A chain, a mall reception, or a
 * shared answering service gives several distinct businesses one number, and
 * merging on that would be exactly the false merge this policy forbids.
 */
export function matchReasonFor(
  a: DiscoveredBusiness,
  b: DiscoveredBusiness,
): CandidateMatchReason | null {
  if (a.source === b.source && a.externalId === b.externalId) return "same-source-id";

  const nameA = usableText(a.name);
  const nameB = usableText(b.name);
  // Without a name on both sides there is nothing to anchor a match to.
  if (nameA === null || nameB === null || nameA !== nameB) return null;

  const addressA = usableText(a.address);
  const addressB = usableText(b.address);
  if (addressA !== null && addressB !== null && addressA === addressB) {
    return "name-and-address";
  }

  const phoneA = phoneDigits(a.phone);
  const phoneB = phoneDigits(b.phone);
  if (phoneA !== null && phoneB !== null && phoneA === phoneB) {
    return "name-and-phone";
  }

  // Same name, and nothing else agrees. Two shops in one city can share a
  // name, so this stays two candidates.
  return null;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function sourceRank(source: DiscoverySourceName): number {
  const index = DISCOVERY_SOURCE_ORDER.indexOf(source);
  return index === -1 ? DISCOVERY_SOURCE_ORDER.length : index;
}

/** Sorted, so a candidate's identity does not depend on dispatch order. */
function candidateIdFor(observations: readonly CandidateObservation[]): string {
  return observations
    .map((o) => `${o.source}:${o.externalId}`)
    .sort()
    .join("|");
}

function resolveField(
  observations: readonly CandidateObservation[],
  read: (business: DiscoveredBusiness) => string | null,
): CandidateDisplayField<string> | null {
  for (const observation of observations) {
    const value = read(observation.business);
    if (value !== null && value.trim().length > 0) {
      return { value, source: observation.source };
    }
  }
  return null;
}

/**
 * Build the shown values from the grouped observations.
 *
 * Observations are already in source order, so "first non-null wins" is a
 * fixed, documented precedence rather than whichever source answered first.
 * Name, category and city always resolve because a source cannot contribute an
 * observation without them.
 */
function displayFor(observations: readonly CandidateObservation[]): CandidateDisplay {
  const first = observations[0];
  const name = resolveField(observations, (b) => b.name);
  const category = resolveField(observations, (b) => b.category);
  const city = resolveField(observations, (b) => b.city);

  return {
    name: name ?? { value: first.business.name, source: first.source },
    category: category ?? { value: first.business.category, source: first.source },
    city: city ?? { value: first.business.city, source: first.source },
    address: resolveField(observations, (b) => b.address),
    phone: resolveField(observations, (b) => b.phone),
    website: resolveField(observations, (b) => b.website),
    websiteListedBy: observations
      .filter((o) => o.business.website !== null && o.business.website.trim().length > 0)
      .map((o) => o.source),
  };
}

interface Group {
  observations: CandidateObservation[];
  matchedBy: CandidateMatchReason[];
}

/** A grouped candidate, before the lead store has been consulted. */
export type UnresolvedCandidate = Omit<DiscoveryCandidate, "state" | "existingLeadId">;

/**
 * Group every source's results into candidates.
 *
 * Greedy first-match against groups already formed, over observations sorted
 * into a fixed order (source rank, then external id). Greedy rather than
 * transitive closure on purpose: a chain of merges can drag together two
 * businesses that never matched each other directly, and that is precisely the
 * silent false merge this layer exists to avoid.
 *
 * Deterministic: the same observations in any input order produce the same
 * groups, because they are sorted before anything is compared.
 */
export function groupIntoCandidates(
  observations: readonly CandidateObservation[],
): UnresolvedCandidate[] {
  const ordered = [...observations].sort((a, b) => {
    const rank = sourceRank(a.source) - sourceRank(b.source);
    if (rank !== 0) return rank;
    return a.externalId.localeCompare(b.externalId, "en");
  });

  const groups: Group[] = [];

  for (const observation of ordered) {
    let placed = false;

    for (const group of groups) {
      // Compared against every member, not just the first: a group's later
      // members can carry the address or phone the first one lacked.
      let reason: CandidateMatchReason | null = null;
      for (const member of group.observations) {
        reason = matchReasonFor(member.business, observation.business);
        if (reason !== null) break;
      }
      if (reason === null) continue;

      group.observations.push(observation);
      group.matchedBy.push(reason);
      placed = true;
      break;
    }

    if (!placed) groups.push({ observations: [observation], matchedBy: [] });
  }

  return groups.map((group) => ({
    candidateId: candidateIdFor(group.observations),
    foundBy: DISCOVERY_SOURCE_ORDER.filter((source) =>
      group.observations.some((o) => o.source === source),
    ),
    observations: group.observations,
    matchedBy: group.matchedBy,
    display: displayFor(group.observations),
  }));
}

/**
 * Total ordering for candidates: display name A-Z, then candidate id.
 *
 * Deliberately NOT a score. Phase 10A does not rank candidates: lead scoring is
 * defined over a stored provider snapshot, and inventing a second, differently
 * shaped score for transient records would give the application two competing
 * notions of priority. A candidate that becomes a Lead is scored then, by the
 * existing deterministic function, with Google's rating carrying no more weight
 * than any other provider's.
 *
 * The fixed "en" locale keeps the order off the machine's locale.
 */
export function compareCandidates(a: DiscoveryCandidate, b: DiscoveryCandidate): number {
  const byName = a.display.name.value.localeCompare(b.display.name.value, "en");
  if (byName !== 0) return byName;
  return a.candidateId.localeCompare(b.candidateId, "en");
}
