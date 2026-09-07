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
 *
 * ── WHAT IT IS ALLOWED TO SAY ─────────────────────────────────────────────
 *
 * Sounding natural is not licence to invent. The evidence this generator holds
 * is exactly five things: the business's name, its category, its city, whether
 * a phone number was listed, and whether an address was listed. Every sentence
 * it writes must reduce to one of those, to an invitation ("Call us"), or to a
 * slot marked empty.
 *
 * So it never says the work is careful, the answers plain, the visit quick or
 * the welcome friendly. It never claims a menu, a gallery, opening hours, an
 * appointment book, a specialty, a price, a past project, a regular customer
 * or a service area -- a listed city address is not evidence a business serves
 * that city. Where a layout proposes such a section, the section appears with
 * its content marked `To be added.`, which shows the design without asserting
 * the data.
 *
 * That is stricter than "no hallucination". A generated demo is shown to a
 * business owner who knows the truth: one invented flattery is enough to make
 * the whole proposal look like it was written without looking.
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

/**
 * The primary action.
 *
 * `call` only when a number exists to call; otherwise an in-page jump to the
 * contact section. The label never names a capability we cannot evidence --
 * "Book an appointment" would assert a booking system nobody told us about.
 */
function primaryCtaFor(input: DemoSiteGeneratorInput): DemoCta {
  if (input.phoneListed) return { label: "Call us", action: "call" };
  return { label: "Get in touch", action: "scroll", targetSectionId: SECTION.contact };
}

function secondaryCtaFor(input: DemoSiteGeneratorInput): DemoCta {
  if (input.addressListed) return { label: "Find us", action: "directions" };
  return { label: "What we do", action: "scroll", targetSectionId: SECTION.offering };
}

/**
 * The marker for a section the proposed site would carry but for which we hold
 * no data.
 *
 * It is the honest alternative to filling the slot: a menu, a gallery or a set
 * of opening hours can be shown as a designed, obviously empty block without
 * pretending the content already exists.
 */
const TO_BE_ADDED = "To be added.";

/**
 * Offering items.
 *
 * Each is either a restatement of a fact we hold, or an empty slot marked as
 * such. None asserts a quality, a capability, a service, a price or a history:
 * we know the business's name, category and city, and whether a phone number
 * and an address were listed. Nothing else is ours to say on its behalf.
 */
function offeringItems(input: DemoSiteGeneratorInput): { title: string; body: string }[] {
  // Supported by the provider-listed category and city, and nothing more.
  const identity = { title: "What we do", body: `${input.category} in ${input.city}.` };

  const location = {
    title: "Where to find us",
    body: input.addressListed ? `Our address in ${input.city}.` : TO_BE_ADDED,
  };

  const contact = {
    title: "Get in touch",
    body: input.phoneListed
      ? "Our phone number is below."
      : input.addressListed
        ? "Our address is below."
        : TO_BE_ADDED,
  };

  switch (input.recommendedSiteType) {
    case "menu-and-location-site":
      // The layout proposes a menu and hours. Neither is claimed to exist.
      return [identity, { title: "Menu", body: TO_BE_ADDED }, { title: "Opening hours", body: TO_BE_ADDED }];
    case "booking-focused-site":
      // The layout proposes taking appointments. It does not say we can.
      return [identity, { title: "Appointments", body: TO_BE_ADDED }, contact];
    default:
      return [identity, location, contact];
  }
}

/**
 * The line above the offering.
 *
 * One wording for every layout: it names the topics on the page and asserts
 * nothing, so it cannot drift into a claim as layouts are added.
 */
const OFFERING_INTRO = "What we do, and how to get in touch.";

/**
 * Positioning.
 *
 * Restates the three facts we hold, and stops. The analysis's own prose
 * (`businessSummary`, `keySellingPoints`, `draftPositioning`) is never quoted:
 * it is written for us, and a proposal's reasoning is not evidence about the
 * business.
 */
function positioningBody(input: DemoSiteGeneratorInput): string {
  return `${input.businessName} is a ${input.category.toLowerCase()} in ${input.city}.`;
}

function positioningPoints(input: DemoSiteGeneratorInput): string[] {
  const points: string[] = [];
  if (input.phoneListed) points.push("Our phone number is below.");
  if (input.addressListed) points.push("Our address is below.");
  // With neither, restate the category rather than pad the list out. The
  // schema requires at least one point, and an invented one is not an option.
  return points.length > 0 ? points : [`${input.category} in ${input.city}.`];
}

function contactBody(input: DemoSiteGeneratorInput): string {
  if (input.phoneListed && input.addressListed) return "Give us a call, or come and see us.";
  if (input.phoneListed) return "Give us a call.";
  if (input.addressListed) return "Come and see us.";
  // Nothing was listed, so the copy invites nothing. The card below shows
  // empty slots rather than a route we cannot evidence.
  return "Contact details to be added.";
}

/** Hours are never invented, and the slot says so in one neutral line. */
const HOURS_NOTE = "Opening hours to be added.";

function sectionsFor(input: DemoSiteGeneratorInput): DemoSection[] {
  const compact = input.recommendedSiteType === "one-page-site";

  // How a visitor is invited to make contact. Each branch is backed by a
  // listed value; with neither, the hero invites nothing.
  const reach =
    input.phoneListed && input.addressListed
      ? " Call us, or come and find us."
      : input.phoneListed
        ? " Call us."
        : input.addressListed
          ? " Come and find us."
          : "";

  const hero: DemoSection = {
    kind: "hero",
    id: SECTION.hero,
    eyebrow: `${input.category} · ${input.city}`,
    // Built from application-owned facts. "Find X in Y" is supported only when
    // an address was listed; otherwise the name stands alone.
    heading: input.addressListed
      ? `Find ${input.businessName} in ${input.city}`
      : input.businessName,
    subheading: `${input.category} in ${input.city}.${reach}`,
    primaryCta: primaryCtaFor(input),
    secondaryCta: secondaryCtaFor(input),
  };

  const offering: DemoSection = {
    kind: "offering",
    id: SECTION.offering,
    heading: "What we do",
    intro: OFFERING_INTRO,
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
    heading: "Get in touch",
    body:
      input.phoneListed && input.addressListed
        ? `Call ${input.businessName}, or visit us in ${input.city}.`
        : input.phoneListed
          ? `Call ${input.businessName}.`
          : input.addressListed
            ? `Visit ${input.businessName} in ${input.city}.`
            : "Contact details to be added.",
    cta: primaryCtaFor(input),
  };

  if (input.recommendedSiteType === "portfolio-site") {
    const gallery: DemoSection = {
      kind: "gallery",
      id: SECTION.gallery,
      // Not "Recent work": we have no evidence of any work, recent or
      // otherwise. Empty, numbered slots, so the layout is visible and the
      // content is plainly absent.
      heading: "Gallery",
      body: "Images to be added.",
      placeholders: [{ label: "Image 1" }, { label: "Image 2" }, { label: "Image 3" }],
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
  gallery: "Gallery",
  positioning: "About",
  contact: "Contact",
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
      // Not "Serving Oslo": a listed address in a city is not evidence the
      // business serves that city. The category and city are all we hold.
      footer: { note: `${input.category} in ${input.city}.` },
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
