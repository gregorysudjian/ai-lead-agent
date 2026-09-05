/**
 * Deterministic lead opportunity scoring.
 *
 * WHAT THIS SCORE IS: a review-order hint. A high score means "based on the
 * provider signals we currently hold, look at this lead sooner."
 *
 * WHAT IT IS NOT: a probability of purchase, evidence that a business needs a
 * website, evidence that it has none, a judgement of business quality, or an AI
 * opinion. Every point comes from a fixed rule over factual provider fields.
 *
 * Pure by construction: no I/O, no clock, no randomness, no `server-only`
 * import. The same Lead always yields the same score, which is what makes the
 * result testable and safe to compute on either side of the boundary.
 *
 * NEVER PERSISTED. Provider data is refreshed on every rediscovery, so a stored
 * score would silently go stale. It is recomputed from the current snapshot.
 */
import type { Lead, ProviderSnapshot } from "./types";

export type LeadPriority = "high" | "medium" | "low";

export type ScoreFactorKey = "website" | "reviews" | "rating" | "contactability";

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  points: number;
  maxPoints: number;
  /** Deterministic explanation. Never AI-generated. */
  reason: string;
}

export interface LeadScore {
  total: number;
  priority: LeadPriority;
  factors: ScoreFactor[];
}

export const MAX_SCORE = 100;

const MAX_WEBSITE = 45;
const MAX_REVIEWS = 30;
const MAX_RATING = 15;
const MAX_CONTACT = 10;

/**
 * Which provider numbers we are willing to interpret.
 *
 * These predicates are the single source of truth for validity, deliberately
 * shared by the scoring rules AND the ranking tie-breaks. If the two had
 * separate notions of "usable", a value could be rejected by one and trusted by
 * the other -- exactly the bug where an impossible 9.9 rating scores zero points
 * yet still wins a rating tie-break.
 */

/** A review count we can interpret: finite and not negative. */
export function isUsableReviewCount(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

/** A rating we can interpret: finite and inside the 0-5 scale. */
export function isUsableRating(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 5;
}

/**
 * Website signal -- the single largest factor.
 *
 * The test is strictly `=== null`: the provider returned no website at all.
 *
 * A non-null value scores 0 even when our URL-safety layer refuses to link it.
 * "The provider gave us a broken URL" is genuinely different from "the provider
 * gave us nothing", and collapsing the two would invent a signal. This is also
 * why scoring never calls `classifyWebsite` -- link safety is a rendering
 * concern, not evidence about the business.
 */
function scoreWebsite(provider: ProviderSnapshot): ScoreFactor {
  const base = { key: "website" as const, label: "Website signal", maxPoints: MAX_WEBSITE };

  if (provider.website === null) {
    return { ...base, points: MAX_WEBSITE, reason: "No website listed by provider" };
  }
  return { ...base, points: 0, reason: "Website listed by provider" };
}

/**
 * Review volume -- a rough provider signal that a business is established and
 * active. It says nothing about revenue, popularity, profitability, or any
 * willingness to buy.
 */
function scoreReviews(provider: ProviderSnapshot): ScoreFactor {
  const base = { key: "reviews" as const, label: "Review volume", maxPoints: MAX_REVIEWS };
  const count = provider.reviewCount;

  if (count === null) {
    return { ...base, points: 0, reason: "Review count not listed by provider" };
  }
  // Defensive: a provider could return nonsense. Never let it reach the bands.
  if (!isUsableReviewCount(count)) {
    return { ...base, points: 0, reason: "Review count listed by provider is not usable" };
  }
  if (count === 0) {
    return { ...base, points: 0, reason: "No reviews listed by provider" };
  }

  const reason = `${count} review${count === 1 ? "" : "s"} listed by provider`;
  if (count >= 200) return { ...base, points: 30, reason };
  if (count >= 100) return { ...base, points: 25, reason };
  if (count >= 50) return { ...base, points: 20, reason };
  if (count >= 20) return { ...base, points: 15, reason };
  if (count >= 5) return { ...base, points: 10, reason };
  return { ...base, points: 5, reason };
}

/**
 * Rating band. A high rating is not evidence that a business will buy anything;
 * it is used only to order review work.
 */
function scoreRating(provider: ProviderSnapshot): ScoreFactor {
  const base = { key: "rating" as const, label: "Rating", maxPoints: MAX_RATING };
  const rating = provider.rating;

  if (rating === null) {
    return { ...base, points: 0, reason: "Rating not listed by provider" };
  }
  // A rating outside 0-5 is not something we can interpret. Scoring it zero
  // keeps the total inside its documented range and avoids awarding points for
  // data we do not trust -- clamping would hand full marks to a bogus 9.9.
  if (!isUsableRating(rating)) {
    return {
      ...base,
      points: 0,
      reason: "Rating listed by provider is outside the expected 0-5 range",
    };
  }

  const reason = `${rating} rating listed by provider`;
  if (rating >= 4.7) return { ...base, points: 15, reason };
  if (rating >= 4.4) return { ...base, points: 12, reason };
  if (rating >= 4.0) return { ...base, points: 8, reason };
  if (rating >= 3.5) return { ...base, points: 4, reason };
  return { ...base, points: 0, reason };
}

/** Contactability. Whether we could reach them, nothing more. */
function scoreContactability(provider: ProviderSnapshot): ScoreFactor {
  const base = {
    key: "contactability" as const,
    label: "Contactability",
    maxPoints: MAX_CONTACT,
  };

  const phone = provider.phone;
  if (phone !== null && phone.trim().length > 0) {
    return { ...base, points: MAX_CONTACT, reason: "Phone listed by provider" };
  }
  return { ...base, points: 0, reason: "No phone listed by provider" };
}

/** 70+ high, 40-69 medium, below 40 low. Review order, not likelihood of sale. */
export function priorityForScore(total: number): LeadPriority {
  if (total >= 70) return "high";
  if (total >= 40) return "medium";
  return "low";
}

/**
 * Score one lead. Does not mutate the lead or its provider snapshot.
 */
export function scoreLead(lead: Lead): LeadScore {
  const factors: ScoreFactor[] = [
    scoreWebsite(lead.provider),
    scoreReviews(lead.provider),
    scoreRating(lead.provider),
    scoreContactability(lead.provider),
  ];

  const total = factors.reduce((sum, factor) => sum + factor.points, 0);

  return { total, priority: priorityForScore(total), factors };
}

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/** A lead paired with its freshly computed score. */
export interface ScoredLead {
  lead: Lead;
  score: LeadScore;
}

/**
 * Sorts below every valid value.
 *
 * Safe as a sentinel because both ranked fields are non-negative when valid, so
 * no real value can collide with it.
 */
const UNRANKABLE = -1;

/**
 * Rank keys that honour the SAME validity rules as scoring.
 *
 * Anything scoring refuses to interpret is unrankable here too, so an
 * impossible value can never buy a tie-break it did not earn. Invalid data is
 * never clamped into range -- a 9.9 rating does not become a 5.
 *
 * A valid 0 stays distinct from and above unavailable: "the provider told us
 * zero" and "the provider told us nothing" are different facts.
 */
function rankableReviewCount(value: number | null): number {
  return isUsableReviewCount(value) ? value : UNRANKABLE;
}

function rankableRating(value: number | null): number {
  return isUsableRating(value) ? value : UNRANKABLE;
}

/**
 * Total ordering: score desc, review count desc, rating desc, then name A-Z.
 *
 * The name comparison is the final tie-break and uses a fixed "en" locale, so
 * the order cannot drift with the machine's locale. `Lead.status` is
 * deliberately absent: a reviewed lead with a strong score is still a strong
 * lead, and letting status affect rank would hide work already looked at.
 */
export function compareScoredLeads(a: ScoredLead, b: ScoredLead): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;

  const reviews =
    rankableReviewCount(b.lead.provider.reviewCount) -
    rankableReviewCount(a.lead.provider.reviewCount);
  if (reviews !== 0) return reviews;

  const rating =
    rankableRating(b.lead.provider.rating) - rankableRating(a.lead.provider.rating);
  if (rating !== 0) return rating;

  return a.lead.provider.name.localeCompare(b.lead.provider.name, "en");
}

/**
 * Score and rank a list of leads. Returns a new array; the input is untouched.
 * Each lead is scored exactly once.
 */
export function rankLeads(leads: readonly Lead[]): ScoredLead[] {
  return leads
    .map((lead) => ({ lead, score: scoreLead(lead) }))
    .sort(compareScoredLeads);
}
