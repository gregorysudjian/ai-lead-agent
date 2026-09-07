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
 *
 * ── THE VOICE IT WRITES IN ────────────────────────────────────────────────
 *
 * Every string it produces is addressed to the BUSINESS'S CUSTOMER and reads
 * as the business's own words. It never addresses the owner, never describes
 * the website or our process ("sections a finished site would carry", "written
 * with you", "to be replaced with yours"), and never repeats the analysis's
 * internal prose. That vocabulary belongs to us, and a page carrying it does
 * not read as a proposal a client could picture going live.
 *
 * The disclosure that this is a draft lives in the preview's own chrome, where
 * a generator cannot reach it -- not sprinkled through the copy, where it both
 * spoils the mock and could be edited away by a future model.
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
 * Written for the business's CUSTOMER, in the business's own voice. They say
 * what a visitor can do -- never what the website contains, and never what we
 * intend to build. None names a service, a price or a duration, because none
 * was supplied.
 */
function offeringItems(input: DemoSiteGeneratorInput): { title: string; body: string }[] {
  const category = input.category.toLowerCase();
  const reach = input.phoneListed ? "One call is all it takes." : "We are easy to reach.";

  switch (input.recommendedSiteType) {
    case "menu-and-location-site":
      return [
        { title: "What we serve", body: "Our full list, in plain language, with no guesswork." },
        { title: "Where to find us", body: `We are in ${input.city}, and easy to get to.` },
        {
          title: "When we are open",
          body: "Our opening times, so nobody arrives to a closed door.",
        },
      ];
    case "booking-focused-site":
      return [
        {
          title: "Book a time",
          body: "Choose a time that suits you, without the back and forth.",
        },
        {
          title: "What to expect",
          body: `A straightforward visit to a ${category} that respects your time.`,
        },
        { title: "Before you come", body: "The questions people usually ask, answered up front." },
      ];
    case "portfolio-site":
      return [
        { title: "Recent work", body: "A look at what we have finished lately." },
        {
          title: "How we work",
          body: "What working with us looks like, from first call to finished job.",
        },
        { title: "Start a project", body: `Tell us what you have in mind. ${reach}` },
      ];
    default:
      return [
        {
          title: "What we do",
          body: `The work we take on as a ${category} in ${input.city}.`,
        },
        {
          title: "Why people come to us",
          body: "Careful work, a straight answer, and no surprises.",
        },
        { title: "Get in touch", body: reach },
      ];
  }
}

/** The one-line introduction above the offering, in the same voice. */
function offeringIntro(input: DemoSiteGeneratorInput): string {
  switch (input.recommendedSiteType) {
    case "menu-and-location-site":
      return `What we serve, and where to find us in ${input.city}.`;
    case "booking-focused-site":
      return "Book a time, know what to expect, and get your questions answered first.";
    case "portfolio-site":
      return "Recent work, how we work, and how to get started.";
    default:
      return `What we take on, and how to reach us in ${input.city}.`;
  }
}

/**
 * Positioning.
 *
 * The analysis's `businessSummary` and `keySellingPoints` are notes written
 * for US -- "this summary restates the provider listing only", "clear
 * description of what a hair salon offers". Passing them through put our
 * internal voice on a page meant to read as the business's own, so they are
 * no longer quoted. They still inform the brief; the customer-facing wording
 * is written here, from the same facts.
 */
function positioningBody(input: DemoSiteGeneratorInput): string {
  return `We are a ${input.category.toLowerCase()} in ${input.city}. We keep it simple: do the work properly, and be easy to reach when you need us.`;
}

function positioningPoints(input: DemoSiteGeneratorInput): string[] {
  return [
    input.phoneListed ? "Easy to reach by phone." : "Easy to get in touch.",
    input.addressListed ? `Right here in ${input.city}.` : `Serving ${input.city}.`,
    "Plain answers, and no runaround.",
  ];
}

function contactBody(input: DemoSiteGeneratorInput): string {
  if (input.phoneListed && input.addressListed) return "Give us a call, or come and see us.";
  if (input.phoneListed) return "Give us a call — we are happy to help.";
  if (input.addressListed) return "Come and see us.";
  // Nothing was listed. The card below shows empty slots rather than a number
  // we do not have, so the copy simply does not promise one.
  return "Here is how to reach us.";
}

/**
 * Hours are never invented.
 *
 * A short neutral placeholder, not an instruction addressed to the owner. The
 * preview's own chrome explains that no hours were supplied.
 */
const HOURS_NOTE = "Opening hours to be confirmed.";

function sectionsFor(input: DemoSiteGeneratorInput): DemoSection[] {
  const category = input.category.toLowerCase();
  const compact = input.recommendedSiteType === "one-page-site";

  // How a visitor is invited to make contact, chosen from what was actually
  // listed. Nothing here promises a route we do not have.
  const reachLine =
    input.phoneListed && input.addressListed
      ? "Call ahead, or come and find us."
      : input.phoneListed
        ? "Give us a call."
        : input.addressListed
          ? "Come and find us."
          : "Get in touch and we will help.";

  const hero: DemoSection = {
    kind: "hero",
    id: SECTION.hero,
    eyebrow: `${input.category} · ${input.city}`,
    heading: input.draftPositioning,
    subheading: compact
      ? `A ${category} in ${input.city} — everything you need, in one place. ${reachLine}`
      : `A ${category} in ${input.city}. ${reachLine}`,
    primaryCta: primaryCtaFor(input),
    secondaryCta: secondaryCtaFor(input),
  };

  const offering: DemoSection = {
    kind: "offering",
    id: SECTION.offering,
    heading: input.recommendedSiteType === "menu-and-location-site" ? "What we offer" : "What we do",
    intro: offeringIntro(input),
    items: offeringItems(input),
  };

  const positioning: DemoSection = {
    kind: "positioning",
    id: SECTION.positioning,
    heading: "About us",
    body: positioningBody(input),
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
    body: input.phoneListed
      ? "Give us a call and we will take it from there."
      : "Get in touch and we will take it from there.",
    cta: primaryCtaFor(input),
  };

  if (input.recommendedSiteType === "portfolio-site") {
    const gallery: DemoSection = {
      kind: "gallery",
      id: SECTION.gallery,
      heading: "Recent work",
      body: "A few examples of what we have done.",
      // Labelled empty slots, not stock imagery standing in for work we have
      // never seen. The labels are captions, not instructions.
      placeholders: [
        { label: "Finished work" },
        { label: "Work in progress" },
        { label: "Our premises" },
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
      footer: { note: `Serving ${input.city}.` },
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
