/**
 * Deterministic lead deduplication.
 *
 * Pure functions with no I/O, no clock and no randomness: the same inputs always
 * produce the same answer, so this can be reasoned about and tested on its own.
 *
 * Explicitly NOT here, by design: fuzzy matching, edit distance, and AI. A false
 * merge silently destroys a real lead, which is far worse than carrying the
 * occasional duplicate we can spot and merge deliberately later.
 */
import type { DiscoveredBusiness, Lead } from "./types";
import { equalsNormalized, normalizeTerm } from "./normalize";

/** Why a candidate was considered the same business as an existing lead. */
export type MatchReason = "provider-id" | "name-and-address";

export interface DedupeMatch {
  lead: Lead;
  reason: MatchReason;
}

/**
 * PRIMARY: same provider, same identifier.
 *
 * Scoped to the source because `externalId` is only unique within a provider --
 * a Google place ID and a mock ID could theoretically collide as strings.
 */
function matchesProviderId(lead: Lead, candidate: DiscoveredBusiness): boolean {
  return (
    lead.provider.source === candidate.source &&
    lead.provider.externalId === candidate.externalId
  );
}

/**
 * SECONDARY: same normalized name AND same normalized address.
 *
 * This is the safety net for provider identifiers changing -- a business
 * re-listed under a new place ID must not become a second lead.
 *
 * Both halves are required, and an absent address on either side disqualifies
 * the match outright. Name alone is far too broad: "Salon Verdurette" could
 * plausibly name two unrelated shops in different neighbourhoods, and merging
 * them would silently lose one. A missing address is treated as unknown, never
 * as a wildcard that matches anything.
 *
 * Deliberately NOT scoped to a single source: if two providers describe the
 * same business at the same address, that is one lead, not two.
 */
function matchesNameAndAddress(lead: Lead, candidate: DiscoveredBusiness): boolean {
  const leadAddress = lead.provider.address;
  const candidateAddress = candidate.address;

  // No address on either side -> not enough evidence. Do not guess.
  if (leadAddress === null || candidateAddress === null) return false;

  // Guard against empty/whitespace values normalizing to "" and matching.
  if (normalizeTerm(candidateAddress).length === 0) return false;
  if (normalizeTerm(candidate.name).length === 0) return false;

  return (
    equalsNormalized(lead.provider.name, candidate.name) &&
    equalsNormalized(leadAddress, candidateAddress)
  );
}

/**
 * Find the existing lead that represents this business, if any.
 *
 * Primary matching wins over secondary, and the whole set is checked for a
 * provider-id match before any name+address match is considered -- otherwise a
 * weaker match earlier in the array could shadow the exact one.
 */
export function findExistingLead(
  leads: readonly Lead[],
  candidate: DiscoveredBusiness,
): DedupeMatch | null {
  const byProviderId = leads.find((lead) => matchesProviderId(lead, candidate));
  if (byProviderId) return { lead: byProviderId, reason: "provider-id" };

  const byNameAndAddress = leads.find((lead) => matchesNameAndAddress(lead, candidate));
  if (byNameAndAddress) return { lead: byNameAndAddress, reason: "name-and-address" };

  return null;
}
