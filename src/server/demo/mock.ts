import "server-only";

import type {
  DemoCta,
  DemoSection,
  DemoSiteContent,
  DemoSiteGeneratorInput,
  DemoTheme,
} from "@/lib/demo-site";
import type { RecommendedSiteType } from "@/lib/analysis";

import { DemoSiteProviderError, type DemoSiteProvider } from "./types";

/**
 * Deterministic rule-based demo-site generator.
 *
 * No model, no network, no randomness, no clock: the same input always produces
 * byte-identical content. It exists so the whole workflow -- generate, validate,
 * persist, preview -- can be built and tested before any paid API is connected.
 *
 * ── THE LINE IT HOLDS ─────────────────────────────────────────────────────
 *
 * It writes copy for a PROPOSED website. It never states a fact about the
 * business it was not given. Concretely, nothing it produces contains:
 * a named service or product, a price, an opening time, an award, a
 * certification, a number of years in business, a testimonial, a member of
 * staff, a social profile or any URL. Most of those it could not express even
 * if it tried -- `DemoSiteContent` has no field for a link, and contact details
 * are read by the renderer from application-owned facts.
 *
 * What it does use: the business name, category and city (provider facts), the
 * presence flags, and the analysis recommendations, which are themselves
 * proposals. Where a value is missing it designs around the gap rather than
 * filling it -- a business with no listed phone gets a demo whose calls to
 * action scroll to a contact section instead of pretending a number exists.
 */

const MODEL = "deterministic-demo-rules-v1";

/** Section ids double as page anchors, so they are fixed, known slugs. */
const SECTION = {
  hero: "top",
  offering: "services",
  gallery: "work",
  positioning: "about",
  contact: "visit",
  cta: "start",
} as const;

/**
 * Map the analysis's free-text design direction onto one of OUR themes.
 *
 * The analysis describes a mood in prose ("warm and local", "high contrast").
 * That prose is never used as styling. It is matched against keywords here and
 * collapsed to a single enum value, and the renderer owns every colour and
 * spacing decision behind that value. An unrecognized description falls back to
 * a site-type default rather than to anything the text asked for.
 */
export function themeFor(input: DemoSiteGeneratorInput): DemoTheme {
  const mood = `${input.designDirection.tone} ${input.designDirection.palette} ${input.designDirection.typography}`
    .toLowerCase();

  if (mood.includes("dark") || mood.includes("luxur") || mood.includes("elegant")) {
    return "elegant-dark";
  }
  if (mood.includes("high contrast") || mood.includes("bold")) return "bold-contrast";
  if (mood.includes("warm") || mood.includes("local") || mood.includes("traditional")) {
    return "warm-classic";
  }
  if (mood.includes("minimal") || mood.includes("calm") || mood.includes("clean")) {
    return "calm-minimal";
  }

  // Site-type default. Deterministic, and never derived from the free text.
  switch (input.recommendedSiteType) {
    case "menu-and-location-site":
      return "warm-classic";
    case "booking-focused-site":
      return "fresh-modern";
    case "portfolio-site":
      return "elegant-dark";
    default:
      return "calm-minimal";
  }
}

/** The primary action, chosen around what the provider actually listed. */
function primaryCtaFor(input: DemoSiteGeneratorInput): DemoCta {
  const booking = input.recommendedSiteType === "booking-focused-site";

  // A `call` action only makes sense when a number exists to call. Otherwise
  // the button scrolls to the contact section -- designing around the gap
  // rather than inventing a number to fill it.
  if (input.phoneListed) {
    return { label: booking ? "Call to book" : "Call us", action: "call" };
  }
  return {
    label: booking ? "Book an appointment" : "Get in touch",
    action: "scroll",
    targetSectionId: SECTION.contact,
  };
}

function secondaryCtaFor(input: DemoSiteGeneratorInput): DemoCta | null {
  if (input.addressListed) return { label: "Find us", action: "directions" };
  return { label: "See what we do", action: "scroll", targetSectionId: SECTION.offering };
}

/**
 * Offering items.
 *
 * Deliberately about the SITE, not about the business's catalogue. Each item
 * describes a section the finished website would carry; none names a service,
 * a price or a duration, because none was supplied.
 */
function offeringItems(input: DemoSiteGeneratorInput): { title: string; body: string }[] {
  const category = input.category.toLowerCase();

  switch (input.recommendedSiteType) {
    case "menu-and-location-site":
      return [
        {
          title: "What we serve",
          body: `A clear, readable list of what this ${category} offers, written with you and kept up to date.`,
        },
        {
          title: "Finding us",
          body: `Where we are in ${input.city}, with directions that work on a phone.`,
        },
        {
          title: "When we are open",
          body: "Opening times shown plainly, so nobody arrives to a closed door.",
        },
      ];
    case "booking-focused-site":
      return [
        {
          title: "Book a time",
          body: "A booking step that takes seconds, so an interested customer never has to work at it.",
        },
        {
          title: "What to expect",
          body: `A short, honest description of a visit to this ${category}, in your own words.`,
        },
        {
          title: "Questions before you come",
          body: "The handful of things people usually ask, answered once so you are not asked again.",
        },
      ];
    case "portfolio-site":
      return [
        {
          title: "Recent work",
          body: "Your own photographs, shown large enough to be worth looking at.",
        },
        {
          title: "How we work",
          body: `The steps of working with this ${category}, described from the customer's side.`,
        },
        {
          title: "Starting a project",
          body: "One obvious way to begin a conversation, on every page.",
        },
      ];
    default:
      return [
        {
          title: "What we do",
          body: `A plain description of the work this ${category} takes on, written with you rather than guessed at.`,
        },
        {
          title: "Why people come to us",
          body: "The reasons your regulars already give, in language they would recognise.",
        },
        {
          title: "Getting in touch",
          body: "Contact details in the same place on every page, easy to read on a phone.",
        },
      ];
  }
}

function positioningPoints(input: DemoSiteGeneratorInput): string[] {
  // The analysis's selling points are proposals about the site, so they carry
  // through as-is. A minimum of one keeps the section from rendering empty.
  const points = input.keySellingPoints.filter((p) => p.trim().length > 0);
  return points.length > 0
    ? points
    : [`Easy to find, easy to contact, and clearly a ${input.category.toLowerCase()} in ${input.city}.`];
}

function contactBody(input: DemoSiteGeneratorInput): string {
  if (input.phoneListed && input.addressListed) {
    return "Our phone number and address are below, on every page of the finished site.";
  }
  if (input.phoneListed) {
    return "Our phone number is below. A street address can be added once you confirm it.";
  }
  if (input.addressListed) {
    return "Our address is below. A phone number can be added once you confirm the best one to publish.";
  }
  return "Contact details go here. Nothing has been filled in, because nothing was listed to fill it in with.";
}

/** Hours are never invented. This says so, in customer-facing language. */
const HOURS_NOTE = "Opening hours appear here once you confirm them.";

function sectionsFor(input: DemoSiteGeneratorInput): DemoSection[] {
  const category = input.category.toLowerCase();
  const compact = input.recommendedSiteType === "one-page-site";

  const hero: DemoSection = {
    kind: "hero",
    id: SECTION.hero,
    eyebrow: `${input.category} · ${input.city}`,
    heading: input.draftPositioning,
    subheading: compact
      ? "Everything a customer needs on one page: what we do, where we are, and how to reach us."
      : `A simple site for a ${category} in ${input.city} — clear on a phone, quick to load, easy to keep current.`,
    primaryCta: primaryCtaFor(input),
    secondaryCta: secondaryCtaFor(input),
  };

  const offering: DemoSection = {
    kind: "offering",
    id: SECTION.offering,
    heading: input.recommendedSiteType === "menu-and-location-site" ? "What we offer" : "What we do",
    intro: `Sections a finished site for this ${category} would carry. The wording is a starting point, written to be replaced with yours.`,
    items: offeringItems(input),
  };

  const positioning: DemoSection = {
    kind: "positioning",
    id: SECTION.positioning,
    heading: "Why this works",
    body: input.businessSummary,
    points: positioningPoints(input),
  };

  const contact: DemoSection = {
    kind: "contact",
    id: SECTION.contact,
    heading: input.addressListed ? "Find us" : "Get in touch",
    body: contactBody(input),
    hoursNote: HOURS_NOTE,
  };

  const cta: DemoSection = {
    kind: "cta",
    id: SECTION.cta,
    heading:
      input.recommendedSiteType === "booking-focused-site"
        ? "Ready when you are"
        : "Let us know what you need",
    body: "One clear next step, repeated at the end of the page where people decide.",
    cta: primaryCtaFor(input),
  };

  if (input.recommendedSiteType === "portfolio-site") {
    const gallery: DemoSection = {
      kind: "gallery",
      id: SECTION.gallery,
      heading: "Recent work",
      body: "Your own photographs go here. Nothing on this page is a stock image standing in for your work.",
      placeholders: [
        { label: "Photograph of finished work" },
        { label: "Photograph of work in progress" },
        { label: "Photograph of the premises" },
      ],
    };
    return [hero, gallery, positioning, offering, contact, cta];
  }

  if (compact) {
    // A one-page site keeps the same story but drops a section rather than
    // stretching thin content across more of them.
    return [hero, offering, contact, cta];
  }

  return [hero, offering, positioning, contact, cta];
}

const NAV_LABELS: Record<Exclude<DemoSection["kind"], "hero">, string> = {
  offering: "What we do",
  gallery: "Work",
  positioning: "About",
  contact: "Visit",
  cta: "Get in touch",
};

class MockDemoSiteProvider implements DemoSiteProvider {
  readonly name = "mock";
  readonly model = MODEL;

  async generate(input: DemoSiteGeneratorInput): Promise<DemoSiteContent> {
    // A nameless business cannot have a credible site mocked up for it.
    if (input.businessName.trim().length === 0) {
      throw new DemoSiteProviderError("Business has no usable name to build a demo for.");
    }
    if (input.category.trim().length === 0 || input.city.trim().length === 0) {
      throw new DemoSiteProviderError("Business has no usable category or city.");
    }

    const sections = sectionsFor(input);

    return {
      siteTitle: input.businessName,
      tagline: `${input.category} · ${input.city}`,
      theme: themeFor(input),
      navigation: sections
        .filter((s) => s.kind !== "hero")
        .map((s) => ({ label: NAV_LABELS[s.kind], targetSectionId: s.id })),
      sections,
      footer: {
        note: `A proposed website for a ${input.category.toLowerCase()} in ${input.city}.`,
      },
    };
  }
}

export const mockDemoSiteProvider: DemoSiteProvider = new MockDemoSiteProvider();

/** Exported for tests: the site types the generator is expected to handle. */
export const HANDLED_SITE_TYPES: readonly RecommendedSiteType[] = [
  "one-page-site",
  "small-brochure-site",
  "booking-focused-site",
  "menu-and-location-site",
  "portfolio-site",
];
