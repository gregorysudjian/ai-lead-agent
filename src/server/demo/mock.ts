import "server-only";

import type {
  DemoCta,
  DemoLayout,
  DemoSection,
  DemoSiteContent,
  DemoSiteGeneratorInput,
  DemoTheme,
} from "@/lib/demo-site";
import type { RecommendedSiteType } from "@/lib/analysis";
import { fillSample, samplesForCategory, type CategorySamples } from "@/lib/demo-samples";

import { DemoSiteProviderError, type DemoSiteProvider } from "./types";

/**
 * Deterministic rule-based demo-site generator.
 *
 * No model, no network, no randomness, no clock: the same input always produces
 * byte-identical content. It is the generator this project runs on -- the
 * Claude-backed one exists but costs money per demo, and this one is free.
 *
 * ── WHAT CHANGED, AND WHY ─────────────────────────────────────────────────
 *
 * This generator used to refuse to write anything it could not evidence. For
 * a business with no website -- which is every business worth approaching --
 * that meant a page reading "Menu: To be added." in every slot. Honest, and
 * useless: an owner shown a blank template cannot picture their site.
 *
 * It now writes a complete, realistic page using category-typical copy from
 * `demo-samples.ts`, and marks every unevidenced section `sample: true`. The
 * renderer tags those sections visibly and the preview chrome lists them.
 *
 * The honesty did not move, it changed shape. Before: say nothing unproven.
 * Now: say what the section would say, and label it as a placeholder. What is
 * still forbidden is the specific invented fact -- a price, an award, a named
 * member of staff, a testimonial, a year founded -- because those are what an
 * owner checks and finds wrong. `demo-samples.ts` documents that line and
 * `demo-samples.test.ts` enforces the mechanical parts of it.
 *
 * ── WHAT REMAINS STRUCTURALLY IMPOSSIBLE ──────────────────────────────────
 *
 * Unchanged, and worth restating: `DemoSiteContent` has no field for a URL, a
 * phone number, an address, a price or an opening time. Contact details are
 * read by the RENDERER from application-owned facts. This generator never sees
 * a phone number, so it cannot mistype one into body copy, and it could not
 * store a fabricated booking link if it tried.
 *
 * Nor does it decide what counts as sample. `enforceSampleFlags` recomputes
 * every flag from the held facts and OR-s it in, so the marking below is a
 * declaration of intent, not the last word.
 *
 * ── THE VOICE ─────────────────────────────────────────────────────────────
 *
 * Every string is addressed to the BUSINESS'S CUSTOMER and reads as the
 * business's own words. It never addresses the owner, never describes the
 * website or our process, and never uses our internal vocabulary --
 * "provider", "listed", "analysis", "draft". The disclosure that this is a
 * proposal lives in the preview's chrome, where a generator cannot reach it.
 */

const MODEL = "deterministic-demo-rules-v2";

/** Section ids double as page anchors, so they are fixed, known slugs. */
const SECTION = {
  hero: "top",
  offering: "services",
  positioning: "about",
  gallery: "gallery",
  contact: "visit",
  cta: "start",
} as const;

/**
 * Themes that suit each kind of business, most specific keyword first.
 *
 * TWO per category, not one, so a street of hair salons does not become a
 * street of identical pages. The pair is chosen to be appropriate rather than
 * merely different: a florist may be elegant or warm, but never lime-on-black.
 */
const THEMES_BY_CATEGORY: readonly [string, readonly DemoTheme[]][] = [
  ["barber", ["bold-contrast", "warm-classic"]],
  ["hair", ["calm-minimal", "elegant-dark"]],
  ["nail", ["elegant-dark", "fresh-modern"]],
  ["beauty", ["elegant-dark", "calm-minimal"]],
  ["restaurant", ["warm-classic", "elegant-dark"]],
  ["cafe", ["warm-classic", "calm-minimal"]],
  ["bakery", ["warm-classic", "calm-minimal"]],
  ["dentist", ["fresh-modern", "calm-minimal"]],
  ["dental", ["fresh-modern", "calm-minimal"]],
  ["pharmacy", ["fresh-modern", "calm-minimal"]],
  ["gym", ["bold-contrast", "fresh-modern"]],
  ["florist", ["elegant-dark", "warm-classic"]],
  ["flower", ["elegant-dark", "warm-classic"]],
  ["car", ["bold-contrast", "fresh-modern"]],
  ["garage", ["bold-contrast", "fresh-modern"]],
  ["repair", ["bold-contrast", "fresh-modern"]],
];

/**
 * Which theme this business gets.
 *
 * ── WHY THE CATEGORY WINS ─────────────────────────────────────────────────
 *
 * This used to read the analysis's free-text `designDirection` first and match
 * keywords against it. That gave one theme to every business in the database.
 * The deterministic analyser describes its palette as "two neutrals plus one
 * accent colour, high contrast for readability" -- a note about LEGIBILITY --
 * and the phrase "high contrast" matched the loud lime-on-black theme. Every
 * florist, dentist and bakery came out looking like a skate shop.
 *
 * So the category leads. It is a FACT about the business, whereas the design
 * direction is prose written about it, and prose is a bad thing to pattern
 * match: the words that describe a mood overlap with the words that describe
 * a requirement. The free text is still consulted, but only for a category we
 * have no opinion about, where a weak hint beats an arbitrary default.
 *
 * Within a category the business's NAME picks between two suitable themes, so
 * two salons on the same street differ. Same hash as `layoutFor`, so the
 * choice is stable across regenerations.
 */
export function themeFor(input: DemoSiteGeneratorInput): DemoTheme {
  const category = input.category.trim().toLowerCase();

  for (const [keyword, choices] of THEMES_BY_CATEGORY) {
    if (category.includes(keyword)) {
      return choices[stableHash(input.businessName) % choices.length];
    }
  }

  // An unfamiliar category. Now the analysis's prose is worth something,
  // because there is nothing better to go on. "high contrast" is deliberately
  // NOT matched here -- see above for what it actually means.
  const mood =
    `${input.designDirection.tone} ${input.designDirection.palette} ${input.designDirection.typography}`.toLowerCase();

  if (mood.includes("dark") || mood.includes("luxur") || mood.includes("elegant")) {
    return "elegant-dark";
  }
  if (mood.includes("bold")) return "bold-contrast";
  if (mood.includes("warm") || mood.includes("traditional")) return "warm-classic";
  if (mood.includes("minimal") || mood.includes("calm")) return "calm-minimal";

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
 * A stable hash of a string.
 *
 * FNV-1a, chosen because it is four lines and deterministic. Nothing here is
 * security-sensitive -- it exists only to spread businesses across the
 * available page designs in a way that does not change between runs.
 */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    // >>> 0 keeps it an unsigned 32-bit value; Math.imul avoids float drift.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Which whole-page design this business gets.
 *
 * The complaint this answers: every generated site looked the same. Theme
 * changed the colours, but the arrangement -- centred hero, card grid,
 * split about -- was identical on every page, so a portfolio of demos read as
 * one template with the names swapped.
 *
 * The layout is chosen from the business's own NAME rather than its category,
 * so two hair salons on the same street get visibly different pages. It is a
 * hash, so it is stable: regenerating a demo for the same business produces
 * the same design, and the operator does not have to explain why the site they
 * showed last week looks different today.
 *
 * A one-page site is always `compact`. That is a real constraint rather than a
 * preference: the other three designs assume enough sections to establish a
 * rhythm, and they look sparse when handed four.
 */
export function layoutFor(input: DemoSiteGeneratorInput): DemoLayout {
  if (input.recommendedSiteType === "one-page-site") return "compact";

  // A portfolio is chosen for businesses judged by looking, and `showcase`
  // leads with the gallery, so the two belong together.
  if (input.recommendedSiteType === "portfolio-site") return "showcase";

  const choices: DemoLayout[] = ["classic", "editorial", "showcase"];
  return choices[stableHash(input.businessName) % choices.length];
}

/**
 * The primary action.
 *
 * `call` only when a number exists to call; otherwise an in-page jump to the
 * contact section. A CTA never names a capability we cannot evidence -- "Book
 * online" would assert a booking system nobody told us about.
 */
function primaryCtaFor(input: DemoSiteGeneratorInput): DemoCta {
  if (input.phoneListed) return { label: "Call us", action: "call" };
  return { label: "Get in touch", action: "scroll", targetSectionId: SECTION.contact };
}

function secondaryCtaFor(input: DemoSiteGeneratorInput): DemoCta {
  if (input.addressListed) return { label: "Find us", action: "directions" };
  return { label: "What we do", action: "scroll", targetSectionId: SECTION.offering };
}

/** How many services a layout shows. A one-pager stays tighter. */
function serviceCount(siteType: RecommendedSiteType): number {
  return siteType === "one-page-site" ? 3 : 4;
}

function heroFor(
  input: DemoSiteGeneratorInput,
  samples: CategorySamples,
  fill: (template: string) => string,
): DemoSection {
  return {
    kind: "hero",
    id: SECTION.hero,
    // Declared sample; `enforceSampleFlags` confirms or overrides it. The
    // headline is marketing copy we wrote, not a fact from the business.
    sample: true,
    eyebrow: fill(samples.eyebrow),
    heading: fill(samples.headline),
    subheading: fill(samples.subheading),
    primaryCta: primaryCtaFor(input),
    secondaryCta: secondaryCtaFor(input),
  };
}

function offeringFor(
  input: DemoSiteGeneratorInput,
  samples: CategorySamples,
  fill: (template: string) => string,
): DemoSection {
  return {
    kind: "offering",
    id: SECTION.offering,
    sample: true,
    heading: fill(samples.servicesHeading),
    intro: fill(samples.servicesIntro),
    items: samples.services.slice(0, serviceCount(input.recommendedSiteType)).map((service) => ({
      title: fill(service.title),
      body: fill(service.body),
    })),
  };
}

function positioningFor(samples: CategorySamples, fill: (t: string) => string): DemoSection {
  return {
    kind: "positioning",
    id: SECTION.positioning,
    sample: true,
    heading: fill(samples.aboutHeading),
    body: fill(samples.aboutBody),
    points: samples.aboutPoints.map(fill),
  };
}

function galleryFor(samples: CategorySamples, fill: (t: string) => string): DemoSection {
  return {
    kind: "gallery",
    id: SECTION.gallery,
    // Always sample: we have never seen the premises and we do not fetch
    // stock imagery. The policy enforces this independently.
    sample: true,
    heading: fill(samples.galleryHeading),
    body: fill(samples.galleryBody),
    placeholders: samples.galleryLabels.map((label) => ({ label: fill(label) })),
  };
}

/**
 * The contact section.
 *
 * Its copy adapts to what we hold, because this is the one section where a
 * wrong invitation is immediately obvious: telling a visitor to call a
 * business whose number we do not have wastes their time and embarrasses the
 * proposal. The hours line is prose only -- the actual schedule, real or
 * sample, is rendered from application-owned data.
 */
function contactFor(
  input: DemoSiteGeneratorInput,
  samples: CategorySamples,
  fill: (template: string) => string,
): DemoSection {
  const body =
    input.phoneListed && input.addressListed
      ? fill(samples.contactBody)
      : input.phoneListed
        ? "Give us a call and we will be glad to help."
        : input.addressListed
          ? "Come and see us. We are glad to have visitors."
          : "Get in touch and we will come back to you.";

  return {
    kind: "contact",
    id: SECTION.contact,
    sample: true,
    heading: input.addressListed ? "Find us" : "Get in touch",
    body,
    hoursNote: input.openingHoursListed
      ? "Our opening hours are below."
      : "Our usual opening hours.",
  };
}

function ctaFor(
  input: DemoSiteGeneratorInput,
  samples: CategorySamples,
  fill: (template: string) => string,
): DemoSection {
  return {
    kind: "cta",
    id: SECTION.cta,
    sample: true,
    heading: fill(samples.ctaHeading),
    // Three branches, because the failure here is specific and embarrassing:
    // "give us a call" printed above a contact card reading "Phone: to be
    // added" reads to an owner as proof nobody looked at their listing.
    body: input.phoneListed
      ? fill(samples.ctaBody)
      : input.addressListed
        ? fill(samples.ctaBodyVisit)
        : "Get in touch and we will come back to you.",
    cta: primaryCtaFor(input),
  };
}

/**
 * The page, in order.
 *
 * Every layout gets a hero, services, about, contact and a closing prompt --
 * that is the minimum that reads as a real small-business site. The gallery is
 * added where a business is something people look at before they choose it.
 */
function sectionsFor(input: DemoSiteGeneratorInput, samples: CategorySamples): DemoSection[] {
  const fill = (template: string) =>
    fillSample(template, { name: input.businessName, city: input.city });

  const hero = heroFor(input, samples, fill);
  const offering = offeringFor(input, samples, fill);
  const positioning = positioningFor(samples, fill);
  const contact = contactFor(input, samples, fill);
  const cta = ctaFor(input, samples, fill);

  if (input.recommendedSiteType === "one-page-site") {
    // Tighter, but still a complete page rather than a stub.
    return [hero, offering, positioning, contact, cta];
  }

  // A gallery earns its place when customers judge by looking: food, hair,
  // nails, flowers, a room they will sit in. Elsewhere it would be four empty
  // frames doing nothing for the pitch.
  const category = input.category.trim().toLowerCase();
  const visual =
    input.recommendedSiteType === "portfolio-site" ||
    ["hair", "barber", "beauty", "nail", "restaurant", "cafe", "bakery", "florist", "gym"].some(
      (word) => category.includes(word),
    );

  if (visual) return [hero, offering, galleryFor(samples, fill), positioning, contact, cta];
  return [hero, offering, positioning, contact, cta];
}

const NAV_LABELS: Record<Exclude<DemoSection["kind"], "hero">, string> = {
  offering: "Services",
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

    const samples = samplesForCategory(input.category);
    const fill = (template: string) =>
      fillSample(template, { name: input.businessName, city: input.city });
    const sections = sectionsFor(input, samples);

    return {
      siteTitle: input.businessName,
      tagline: `${input.category} in ${input.city}`,
      theme: themeFor(input),
      layout: layoutFor(input),
      navigation: sections
        .filter((section) => section.kind !== "hero")
        .map((section) => ({ label: NAV_LABELS[section.kind], targetSectionId: section.id })),
      sections,
      footer: { note: fill(samples.footerNote) },
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
