import type { ProviderSnapshot } from "../types";

/**
 * Records the catalog should not offer, and why.
 *
 * The catalog is hair and beauty businesses a web designer could approach.
 * Overture's own data holds a few rows that are not that: a nonsense name, and
 * chains and pharmacies filed under "beauty salon" because they sell
 * cosmetics. Offering them wastes the operator's time and, worse, invites a
 * demo site for a Uniprix.
 *
 * ── HOW IT IS USED ────────────────────────────────────────────────────────
 *
 * The SAME rule runs in two places: when a release is loaded (an excluded
 * record never enters the catalog) and when the catalog is searched (a row
 * loaded before the rule existed is hidden). Nothing is deleted -- the
 * catalog's rule -- and a business already chosen as a lead is never hidden,
 * because the operator's decision outranks a heuristic.
 *
 * ── HOW CONSERVATIVE ──────────────────────────────────────────────────────
 *
 * Deliberately narrow, and tested against names from the real catalog that
 * look odd but are real businesses ("Fade2Brooklyn", "Salon H4H", "WNTD",
 * "Au 2e", "sweet4sure"). Hiding a real prospect is worse than showing one
 * pharmacy, so every pattern here names a specific brand or a specific kind of
 * breakage, never a vague "looks wrong".
 */

export type ExclusionReason = "broken-name" | "chain-store" | "pharmacy" | "other-trade";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  "broken-name": "The listed name is not a readable business name",
  "chain-store": "A retail chain, not an independent beauty business",
  pharmacy: "A pharmacy filed under beauty",
  "other-trade": "A different trade filed under beauty",
};

/**
 * Chains that sell beauty products rather than provide a service, and that a
 * web designer has no reason to approach. Matched on the listed name.
 */
const CHAIN_NAMES: readonly RegExp[] = [
  /\bsephora\b/i,
  /\bbath\s*(?:&|and)\s*body\s*works\b/i,
  /\bsally\s+beauty\b/i,
  /\bshoppers\s+drug\s+mart\b/i,
  /\bwalmart\b/i,
  /\bcostco\b/i,
  /\bdollarama\b/i,
];

/** Pharmacy chains and their clinic brands, by name. */
const PHARMACY_NAMES: readonly RegExp[] = [
  /\buniprix\b/i,
  /\bjean[\s-]coutu\b/i,
  /\bpharmaprix\b/i,
  /\bfamiliprix\b/i,
  /\bproxim\b/i,
  // "Clinique Santé X (Pharmacie affiliée)" is how Uniprix lists its branches.
  /\bpharmacie\s+affili[ée]e\b/i,
  /^pharmacie\b/i,
  /\bpharmacy\b/i,
];

/** The same chains, recognised by the website they list. */
const EXCLUDED_WEBSITE_HOSTS: readonly [RegExp, ExclusionReason][] = [
  [/(?:^|\.)sephora\.[a-z.]+$/i, "chain-store"],
  [/(?:^|\.)bathandbodyworks\.[a-z.]+$/i, "chain-store"],
  [/(?:^|\.)uniprix\.com$/i, "pharmacy"],
  [/(?:^|\.)cliniquesante\.com$/i, "pharmacy"],
  [/(?:^|\.)jeancoutu\.com$/i, "pharmacy"],
  [/(?:^|\.)pharmaprix\.ca$/i, "pharmacy"],
  [/(?:^|\.)familiprix\.com$/i, "pharmacy"],
];

/** Trades that are not hair or beauty but get filed there. */
const OTHER_TRADE_NAMES: readonly RegExp[] = [/\bchiropra(?:tique|ctic|ctor)\b/i];

function websiteHost(website: string | null): string | null {
  if (website === null) return null;
  try {
    return new URL(website).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A name that is not a name: the text-encoding replacement character, no
 * letter at all, a trailing slash, or a token that alternates letters and
 * digits at random ("6r5dxckulcvbol"). Real names mix the two once or twice
 * ("Fade2Brooklyn", "Salon H4H"); three or more switches inside one word is
 * noise.
 */
function isBrokenName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.includes("�")) return true;
  if (!/\p{L}/u.test(trimmed)) return true;
  if (/[\\/]\.?$/.test(trimmed)) return true;
  return trimmed.split(/\s+/).some((token) => {
    const switches = token.match(/(?<=\d)(?=\p{L})|(?<=\p{L})(?=\d)/gu)?.length ?? 0;
    return switches >= 3;
  });
}

/** Why this record should not be offered, or null when it should. */
export function catalogExclusion(provider: Pick<ProviderSnapshot, "name" | "website">): ExclusionReason | null {
  const name = provider.name;
  if (isBrokenName(name)) return "broken-name";
  if (PHARMACY_NAMES.some((pattern) => pattern.test(name))) return "pharmacy";
  if (CHAIN_NAMES.some((pattern) => pattern.test(name))) return "chain-store";
  if (OTHER_TRADE_NAMES.some((pattern) => pattern.test(name))) return "other-trade";

  const host = websiteHost(provider.website);
  if (host !== null) {
    for (const [pattern, reason] of EXCLUDED_WEBSITE_HOSTS) {
      if (pattern.test(host)) return reason;
    }
  }
  return null;
}

/**
 * Whether search should offer this business. A lead is always offered: the
 * operator chose it, and hiding their own choice from them would be wrong.
 */
export function isOfferedInCatalog(business: { leadId: string | null; provider: Pick<ProviderSnapshot, "name" | "website"> }): boolean {
  return business.leadId !== null || catalogExclusion(business.provider) === null;
}
