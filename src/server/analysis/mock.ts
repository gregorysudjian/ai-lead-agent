import "server-only";

import type {
  AnalysisProviderInput,
  AnalysisProviderResult,
  RecommendedSiteType,
} from "@/lib/analysis";

import { AnalysisProviderError, type AnalysisProvider } from "./types";

/**
 * Deterministic rule-based analyser.
 *
 * No model, no network, no randomness: the same lead always produces the same
 * analysis. It exists so the entire product workflow -- request, validate,
 * persist, render -- can be built and tested before any paid API is connected.
 *
 * THE RULE IT ENFORCES ON ITSELF: it may recommend, but it may never assert a
 * new fact about the business. Everything in `facts` is copied from the
 * provider snapshot. Everything in `recommendations` is phrased as a proposal
 * ("could", "consider", "a ... would") and reasons only from those facts.
 *
 * So this is allowed:
 *   "No website was listed by the provider, so a simple site could make
 *    services and contact details easier to find."
 * and this is not:
 *   "This business loses customers every month because it has no website."
 *
 * Nothing here estimates revenue, traffic, customer counts, competitors or
 * intent, because the data supports none of it.
 */

const MODEL = "deterministic-rules-v1";

/** Category-shaped site suggestions. Keyed on our own canonical labels. */
function siteTypeFor(category: string): RecommendedSiteType {
  const c = category.toLowerCase();
  if (c.includes("restaurant") || c.includes("cafe") || c.includes("bakery")) {
    return "menu-and-location-site";
  }
  if (c.includes("salon") || c.includes("barber") || c.includes("dentist") || c.includes("gym")) {
    return "booking-focused-site";
  }
  if (c.includes("florist") || c.includes("repair")) return "small-brochure-site";
  return "one-page-site";
}

function pagesFor(siteType: RecommendedSiteType, category: string): string[] {
  const base = ["Home", "Services", "Contact"];
  switch (siteType) {
    case "menu-and-location-site":
      return ["Home", "Menu", "Location and hours", "Contact"];
    case "booking-focused-site":
      return [...base, "Book an appointment"];
    case "small-brochure-site":
      return [...base, `About the ${category.toLowerCase()}`];
    case "portfolio-site":
      return ["Home", "Work", "About", "Contact"];
    default:
      return base;
  }
}

function opportunityText(websiteListed: boolean, category: string): string {
  // Both branches describe the PROVIDER's data, then propose. Neither claims
  // the business does or does not have a website.
  return websiteListed
    ? `The provider listed a website for this ${category.toLowerCase()}. A rebuild or refresh could still be worth discussing, but confirm what the existing site already covers before proposing one.`
    : `No website was listed by the provider. That is a signal worth following up, not proof that none exists — confirm first. If there is genuinely no site, a small one could make services, location and contact details easier for customers to find.`;
}

function sellingPointsFor(facts: AnalysisProviderInput): string[] {
  const points = [
    `Clear description of what a ${facts.category.toLowerCase()} in ${facts.city} offers`,
    "Location and opening details in one obvious place",
  ];
  if (facts.phoneListed) points.push("A phone number visible on every page");
  else points.push("A single reliable way for customers to make contact");
  if (facts.reviewCount !== null && facts.reviewCount > 0) {
    points.push("Existing customer feedback presented in the customer's own words");
  }
  return points;
}

function assumptionsFor(facts: AnalysisProviderInput): string[] {
  const assumptions = [
    `That the provider's category ("${facts.category}") describes what the business actually does.`,
  ];
  if (!facts.addressListed) {
    assumptions.push("That the business serves customers in or near the listed city; no address was listed.");
  }
  if (!facts.phoneListed) {
    assumptions.push("That some contact route exists; the provider listed no phone number.");
  }
  return assumptions;
}

const LIMITATIONS = [
  "Generated from a provider listing only. Nothing here was verified by visiting the business or any website.",
  "An absent website in provider data means the provider listed none, not that none exists.",
  "Contains no estimate of revenue, traffic, customer numbers, competitors or buying intent — the available data supports none of that.",
  "Recommendations are a starting point for a human conversation, not a finished proposal.",
];

class MockAnalysisProvider implements AnalysisProvider {
  readonly name = "mock";
  readonly model = MODEL;

  async analyse(input: AnalysisProviderInput): Promise<AnalysisProviderResult> {
    // A nameless business cannot be written about honestly.
    if (input.businessName.trim().length === 0) {
      throw new AnalysisProviderError("Business has no usable name to analyse.");
    }

    const facts = input;
    const siteType = siteTypeFor(facts.category);
    const lowerCategory = facts.category.toLowerCase();

    return {
      recommendations: {
        businessSummary: `${facts.businessName} is listed as a ${lowerCategory} in ${facts.city}. This summary restates the provider listing only; it has not been verified.`,
        websiteOpportunity: opportunityText(facts.websiteListed, facts.category),
        recommendedSiteType: siteType,
        recommendedPages: pagesFor(siteType, facts.category),
        homepageSections: [
          "A one-line statement of what the business does and where",
          "Services or offering, in plain language",
          facts.phoneListed ? "Contact details, phone first" : "Contact details",
          "Location and opening hours",
          "A single clear next step for the visitor",
        ],
        keySellingPoints: sellingPointsFor(facts),
        callsToAction: siteType === "booking-focused-site"
          ? ["Book an appointment", "Call the shop", "Get directions"]
          : ["Call the business", "Get directions", "See services"],
        designDirection: {
          tone: `Straightforward and local; language a ${lowerCategory} customer would use`,
          palette: "Two neutrals plus one accent colour, high contrast for readability",
          imagery: "Photographs of the real premises and real work — no stock imagery standing in for the business",
          typography: "One readable sans-serif, large enough to read on a phone",
        },
        draftPositioning: `A ${lowerCategory} in ${facts.city}, easy to find and easy to contact.`,
      },
      assumptions: assumptionsFor(facts),
      limitations: LIMITATIONS,
    };
  }
}

export const mockAnalysisProvider: AnalysisProvider = new MockAnalysisProvider();
