/**
 * The single source of truth for demo-site facts.
 *
 * Pure and deterministic. The same lead always yields the same
 * `DemoSiteBusiness`, and no generator is ever consulted — exactly as
 * `deriveAnalysisFacts` works for analyses.
 */
import type { AnalysisRecommendations } from "./analysis";
import type { BusinessProfile, ProfileField } from "./business-profile";
import { resolveField } from "./business-profile";
import type { DemoSiteBusiness, DemoSiteGeneratorInput } from "./demo-site";
import { formatOpeningHoursLines } from "./format";
import { isUsableText } from "./scoring";
import type { Lead } from "./types";

/** The preferred value for one profile field, as a usable string or null. */
function fromProfile(profile: BusinessProfile | null, field: ProfileField): string | null {
  if (profile === null) return null;
  const resolved = resolveField(profile.facts, field, profile.sources);
  if (resolved === null) return null;
  const value = String(resolved.observation.value);
  return isUsableText(value) ? value.trim() : null;
}

/** Every distinct value for a `multiple` field, in stored order. */
function allFromProfile(profile: BusinessProfile | null, field: ProfileField): string[] {
  if (profile === null) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const observation of profile.facts[field]) {
    const value = String(observation.value).trim();
    if (value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

/** Trim to a usable value, or null when the provider listed nothing usable. */
function listed(value: string | null): string | null {
  return isUsableText(value) ? (value as string).trim() : null;
}

/**
 * Copy the business facts a demo site is allowed to state.
 *
 * Read from the LEAD and, when one exists, from the business's own researched
 * PROFILE. Never from the analysis: an analysis carries a snapshot of how
 * things looked when it ran, and a demo shown to a prospect today should
 * reflect what we currently hold.
 *
 * ── WHY THE PROFILE WINS ──────────────────────────────────────────────────
 *
 * For contact details the profile takes precedence, through the same
 * `resolveField` ordering the rest of the application uses: a phone number read
 * on the business's own page beats a directory's copy of it. That is not a
 * preference, it is the difference between showing an owner their real number
 * and showing them a stale one -- which is the fastest way to lose the
 * conversation the demo exists to start.
 *
 * The profile also supplies things a discovery record simply never has: the
 * social profiles the business links to itself, its published hours, its
 * booking link, and its own description of itself. Those make the demo look
 * like their business rather than a template with their name in it.
 *
 * Everything here is still a FACT WE HOLD. Nothing is inferred, and
 * `websiteListed` continues to record only what a source listed -- it is never
 * rendered as a claim that the business has or lacks a website.
 */
export function deriveDemoSiteBusiness(
  lead: Lead,
  profile: BusinessProfile | null = null,
): DemoSiteBusiness {
  const p = lead.provider;

  const socialLinks = allFromProfile(profile, "web.socialLink");
  // Profile first, then the discovery snapshot -- the same precedence phone
  // and address already use, and for the same reason: hours the business
  // published on its own site beat a directory's copy of them.
  //
  // This fallback used to be missing, so a lead whose OSM record carried real
  // hours still showed the category's sample schedule. Now that the OSM tag is
  // parsed, that gap would have wasted the best fact we hold about a business
  // with no website.
  const profileHours = allFromProfile(profile, "business.openingHours");
  const openingHours =
    profileHours.length > 0
      ? profileHours
      : lead.provider.openingHours
        ? formatOpeningHoursLines(lead.provider.openingHours)
        : [];
  const bookingUrl = fromProfile(profile, "web.bookingUrl");
  const ownDescription = fromProfile(profile, "web.description");

  return {
    name: p.name,
    category: p.category,
    city: p.city,
    // Profile first, lead as the fallback. Both are facts a source gave us.
    phone: fromProfile(profile, "contact.phone") ?? listed(p.phone),
    address: fromProfile(profile, "contact.address") ?? listed(p.address),
    // True when EITHER the discovery record listed a site or research read one.
    websiteListed:
      p.website !== null ||
      (profile?.facts["web.reachable"].some((o) => o.value === true) ?? false),
    source: p.source,
    snapshotFetchedAt: p.fetchedAt,
    socialLinks,
    openingHours,
    bookingUrl,
    ownDescription,
    profileSourced:
      profile !== null &&
      (socialLinks.length > 0 ||
        openingHours.length > 0 ||
        bookingUrl !== null ||
        ownDescription !== null),
  };
}

/**
 * Reduce facts plus analysis recommendations to what a generator may see.
 *
 * Contact VALUES are dropped here even though the demo will display them: the
 * generator writes wording and structure, and the renderer reads the number,
 * the links and the hours from `spec.business`. A generator that never sees a
 * phone number or a booking URL cannot paraphrase, reformat or mistype one
 * into body copy.
 */
export function toDemoGeneratorInput(
  business: DemoSiteBusiness,
  recommendations: AnalysisRecommendations,
): DemoSiteGeneratorInput {
  return {
    businessName: business.name,
    category: business.category,
    city: business.city,
    phoneListed: business.phone !== null,
    addressListed: business.address !== null,
    websiteListed: business.websiteListed,
    // Presence, never the values. Same rule as the phone number above.
    socialLinksListed: business.socialLinks.length > 0,
    openingHoursListed: business.openingHours.length > 0,
    bookingUrlListed: business.bookingUrl !== null,
    recommendedSiteType: recommendations.recommendedSiteType,
    recommendedPages: recommendations.recommendedPages,
    homepageSections: recommendations.homepageSections,
    keySellingPoints: recommendations.keySellingPoints,
    callsToAction: recommendations.callsToAction,
    designDirection: recommendations.designDirection,
    draftPositioning: recommendations.draftPositioning,
    businessSummary: recommendations.businessSummary,
  };
}
