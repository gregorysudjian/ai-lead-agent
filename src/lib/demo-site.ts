/**
 * Demo site: a proposed website for one lead, generated from one analysis.
 *
 * A third domain object, kept structurally apart from both `Lead` and
 * `Analysis`. Neither of those gains a field for this feature. The chain is:
 *
 *   Lead  --(many)-->  Analysis  --(many)-->  DemoSite
 *
 * A lead may be analysed repeatedly; an analysis may be turned into a demo site
 * repeatedly. Each generation is its own immutable row, so a demo shown to a
 * prospect months ago stays exactly as it was.
 *
 * ── THE CENTRAL RULE ──────────────────────────────────────────────────────
 *
 * `DemoSiteSpec` has two required subtrees and two optional ones:
 *
 *   business   what the provider listed, copied verbatim from the lead
 *              snapshot by application code. FACTS.
 *   content    layout, wording, section order, theme. PROPOSAL. English.
 *   design     the look, computed by our code from facts (lib/demo-design).
 *              Never a generator's choice. Absent on older demos.
 *   alternates the same PROPOSAL in French, with content's exact structure.
 *
 * `DemoSiteContent` is precisely what a generator returns
 * (`DemoSiteGeneratorResult`). It contains no business name field, no phone,
 * no address, no prices, no hours, and — critically — no URL of any kind.
 * A generator that wanted to invent a booking link, a testimonial attributed to
 * a real person, or an opening time has nowhere to put it. This is the same
 * structural guarantee `AnalysisProviderResult` gives, applied to a second
 * generation step.
 *
 * ── WHY STRUCTURED JSON, NOT HTML ─────────────────────────────────────────
 *
 * Nothing here is markup. Every generated value is a plain string rendered by
 * React as escaped text, and every enum is checked against a closed set on the
 * way out of the database. No `dangerouslySetInnerHTML` exists anywhere in the
 * rendering path, so generator output — today deterministic, tomorrow possibly
 * a language model — cannot introduce executable markup.
 */
import type { DesignDirection, RecommendedSiteType } from "./analysis";
import type { DemoDesign } from "./demo-design/types";
import type { Locale } from "./locale";
import type { BusinessSource } from "./types";

/** Only successful generations are persisted; a failure is reported, not stored. */
export type DemoSiteStatus = "generated";

/**
 * Application-owned facts, copied from the lead's provider snapshot.
 *
 * Contact VALUES are deliberately included here, unlike `AnalysisFacts`, which
 * carries presence flags only. The reason is the difference in audience: an
 * analysis is internal reasoning that never needs the phone number, whereas a
 * demo of a business's own website is not credible without the business's own
 * contact details on it. They are copied by application code from data the
 * business already publishes, and they are never generated.
 *
 * `websiteListed: false` means the provider listed no website — never that the
 * business has none.
 */
export interface DemoSiteBusiness {
  name: string;
  category: string;
  city: string;
  /** Null when no source listed one. Never invented, never guessed. */
  phone: string | null;
  address: string | null;
  websiteListed: boolean;
  source: BusinessSource;
  /** ISO-8601 of the provider snapshot these facts came from. */
  snapshotFetchedAt: string;

  /**
   * Facts a research run read on the business's OWN site.
   *
   * Empty when nothing was researched, or when the page said nothing. They are
   * separated from the fields above because their provenance is different and
   * stronger: the business published these itself and we saw them, rather than
   * a directory holding a copy. `profileSourced` says whether any of this came
   * from a research run at all, so the UI can be honest about which demo is
   * built on the business's own material.
   */
  socialLinks: string[];
  openingHours: string[];
  bookingUrl: string | null;
  /** The business's own description of itself, in its own words. */
  ownDescription: string | null;
  profileSourced: boolean;
}

/**
 * The controlled set of visual treatments.
 *
 * A generator picks one of these; it never supplies colours, CSS or class
 * names. Each maps to application-owned Tailwind tokens in the renderer, so the
 * worst a hostile or confused generator can do is choose a theme we designed.
 */
export type DemoTheme =
  | "warm-classic"
  | "fresh-modern"
  | "bold-contrast"
  | "calm-minimal"
  | "elegant-dark";

export const DEMO_THEME_LABELS: Record<DemoTheme, string> = {
  "warm-classic": "Warm classic",
  "fresh-modern": "Fresh modern",
  "bold-contrast": "Bold contrast",
  "calm-minimal": "Calm minimal",
  "elegant-dark": "Elegant dark",
};

/**
 * The page composition.
 *
 * A closed set of whole-page designs, chosen by the generator the same way a
 * theme is: it picks a NAME, and the renderer owns every layout decision
 * behind that name. No CSS, grid definition or class string crosses the
 * generator boundary.
 *
 * Page-level rather than per-section on purpose. Letting each section pick its
 * own arrangement would produce more permutations and worse sites: a page
 * whose hero is editorial, services are a card grid and gallery is a mosaic
 * reads as three designs stapled together. Coherence is most of what separates
 * a professional-looking page from a generated-looking one, so the choice is
 * made once and applied throughout.
 *
 *   classic    Centred hero, card grid, split about. Safe and familiar.
 *   editorial  Asymmetric hero, services as a ruled list, large quiet type.
 *   showcase   Full-bleed hero, alternating service rows, gallery led.
 *   compact    Tighter rhythm and a single column. For one-page sites.
 */
export type DemoLayout = "classic" | "editorial" | "showcase" | "compact";

export const DEMO_LAYOUT_LABELS: Record<DemoLayout, string> = {
  classic: "Classic",
  editorial: "Editorial",
  showcase: "Showcase",
  compact: "Compact",
};

/**
 * What a call-to-action does.
 *
 * Deliberately an ENUM rather than a URL. The renderer resolves `call` against
 * the application-owned phone number and the other two against in-page section
 * anchors. There is no representation for an arbitrary link, so a fabricated
 * booking URL or social profile cannot be stored, let alone rendered.
 */
export type DemoCtaAction = "call" | "directions" | "scroll";

export interface DemoCta {
  label: string;
  action: DemoCtaAction;
  /** Section to scroll to. Required for `scroll`, ignored otherwise. */
  targetSectionId?: string;
}

export interface DemoNavItem {
  label: string;
  /** Must match the id of a section in the same spec. */
  targetSectionId: string;
}

/** One named item in an offering list. Plain prose, no price field. */
export interface DemoOfferingItem {
  title: string;
  body: string;
}

/**
 * A visual placeholder block.
 *
 * We do not fetch stock imagery and we do not invent photographs of a business
 * we have never seen. A placeholder says plainly what a real photograph would
 * go here, and is rendered as a CSS treatment.
 */
export interface DemoPlaceholder {
  label: string;
}

/**
 * ── THE `sample` FLAG ─────────────────────────────────────────────────────
 *
 * Every section carries `sample`. It is true when the section's copy includes
 * category-typical placeholder content rather than something we can evidence
 * about this business, and the renderer tags such sections visibly.
 *
 * The flag is NOT the generator's word. `enforceSampleFlags` recomputes it
 * from the facts actually held and can only ever turn it ON -- a generator
 * cannot mark invented copy as confirmed. See `demo-sample-policy.ts`.
 *
 * Why allow sample content at all: the businesses worth approaching have no
 * website, so a strictly evidenced demo is a page of empty slots that no owner
 * can picture as their site. Marked sample copy shows the design honestly.
 * See `demo-samples.ts` for what such copy may and may not say.
 */
/**
 * The ordered page sections.
 *
 * A discriminated union so a new section type is an additive change that the
 * compiler forces the renderer and the validator to handle.
 */
export type DemoSection =
  | {
      kind: "hero";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      eyebrow: string;
      heading: string;
      subheading: string;
      primaryCta: DemoCta;
      secondaryCta: DemoCta | null;
    }
  | {
      kind: "offering";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      heading: string;
      intro: string;
      items: DemoOfferingItem[];
    }
  | {
      kind: "positioning";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      heading: string;
      body: string;
      points: string[];
    }
  | {
      kind: "gallery";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      heading: string;
      body: string;
      placeholders: DemoPlaceholder[];
    }
  | {
      kind: "contact";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      heading: string;
      body: string;
      /** Prose about hours; never a fabricated schedule. */
      hoursNote: string;
    }
  | {
      kind: "cta";
      id: string;
      /** See `DemoSectionBase` note above the union. */
      sample: boolean;
      heading: string;
      body: string;
      cta: DemoCta;
    };

export type DemoSectionKind = DemoSection["kind"];

export const DEMO_SECTION_KINDS: readonly DemoSectionKind[] = [
  "hero",
  "offering",
  "positioning",
  "gallery",
  "contact",
  "cta",
];

/**
 * Everything a generator is permitted to RETURN.
 *
 * No business name. No contact values. No URLs. No ids, no timestamps, no
 * provider metadata. Wording, structure and theme only.
 *
 * Every string here is customer-facing copy in the business's voice. It is not
 * the place for notes to the business owner, for descriptions of the website
 * itself, or for anything in our internal vocabulary -- "provider", "listed",
 * "analysis", "draft". The preview states what it is in its own chrome.
 *
 * Nor may that copy assert anything about the business beyond `business`
 * above. Sounding natural is not licence to invent: no quality, reliability,
 * speed or friendliness; no menu, hours, services, prices, specialties,
 * booking, past work, reputation, regulars or service area. Where a layout
 * proposes a section whose content we do not hold, the section is rendered
 * with its content marked empty rather than filled in.
 */
export interface DemoSiteContent {
  /** Used for the document title and the hero. Prose, rendered as text. */
  siteTitle: string;
  tagline: string;
  theme: DemoTheme;
  /** Whole-page composition. See `DemoLayout`. */
  layout: DemoLayout;
  navigation: DemoNavItem[];
  /** Rendered in this order. */
  sections: DemoSection[];
  footer: {
    note: string;
  };
}

/** A generator returns exactly the content subtree — nothing else. */
export type DemoSiteGeneratorResult = DemoSiteContent;

/**
 * Everything a generator RECEIVES.
 *
 * The business identity it needs to write copy, the presence flags it needs to
 * design around missing data, and the analysis recommendations that shape the
 * site. Never contact values, never internal ids, never timestamps, never the
 * lead or analysis objects themselves.
 *
 * Every string originating in provider data is UNTRUSTED (OpenStreetMap is
 * publicly editable) and must be treated as data by any future model-backed
 * generator.
 */
export interface DemoSiteGeneratorInput {
  businessName: string;
  category: string;
  city: string;
  phoneListed: boolean;
  addressListed: boolean;
  websiteListed: boolean;
  /**
   * Presence only, never the values.
   *
   * The generator writes wording and structure; the renderer reads every URL
   * and time from `spec.business`. A generator that never sees a booking link
   * cannot paraphrase, shorten or mistype one into body copy.
   */
  socialLinksListed: boolean;
  openingHoursListed: boolean;
  bookingUrlListed: boolean;
  /** From the analysis. Shapes structure and wording, never facts. */
  recommendedSiteType: RecommendedSiteType;
  recommendedPages: string[];
  homepageSections: string[];
  keySellingPoints: string[];
  callsToAction: string[];
  designDirection: DesignDirection;
  draftPositioning: string;
  businessSummary: string;
  /**
   * The language to write in. Absent means English, which is what every
   * generator wrote before languages existed, so old callers are unchanged.
   */
  locale?: Locale;
}

export interface DemoSiteSpec {
  /** Application-owned. Never produced by a generator. */
  business: DemoSiteBusiness;
  /** Generator-owned. Proposal, not evidence. English. */
  content: DemoSiteContent;
  /**
   * The design this demo is drawn with, from `lib/demo-design`.
   *
   * Application-owned like `business`: computed from facts by our code, never
   * by a generator. ABSENT on every demo stored before designs existed, and
   * that absence is meaningful -- those demos keep rendering exactly as they
   * did, through the original renderer, and are never silently redesigned.
   */
  design?: DemoDesign;
  /**
   * The same page in other languages. French on every new demo.
   *
   * Each alternate must have exactly `content`'s structure -- the same
   * sections in the same order, the same number of services, points and
   * photo slots, the same button actions -- so switching language changes the
   * words and nothing else. The mapping layer rejects a mismatch.
   */
  alternates?: { fr?: DemoSiteContent };
}

/**
 * Everything about a page except its words: section order and kinds, sample
 * flags, list lengths, navigation targets and what each button does.
 *
 * Two language versions of one page must have the same structure; the
 * mapping layer refuses to store or read a pair that does not.
 */
export function contentStructure(content: DemoSiteContent): string {
  return JSON.stringify({
    theme: content.theme,
    layout: content.layout,
    navigation: content.navigation.map((item) => item.targetSectionId),
    sections: content.sections.map((section) => ({
      kind: section.kind,
      id: section.id,
      sample: section.sample,
      count:
        section.kind === "offering"
          ? section.items.length
          : section.kind === "positioning"
            ? section.points.length
            : section.kind === "gallery"
              ? section.placeholders.length
              : 0,
      actions:
        section.kind === "hero"
          ? [section.primaryCta, section.secondaryCta].map((cta) => (cta ? [cta.action, cta.targetSectionId ?? null] : null))
          : section.kind === "cta"
            ? [[section.cta.action, section.cta.targetSectionId ?? null]]
            : [],
    })),
  });
}

/** The copy a demo shows in one language; English when no alternate exists. */
export function contentFor(spec: DemoSiteSpec, locale: Locale): DemoSiteContent {
  return (locale === "fr" ? spec.alternates?.fr : undefined) ?? spec.content;
}

/** Which generator produced this, so an old demo stays interpretable. */
export interface DemoSiteGeneratorInfo {
  /** Implementation name, e.g. "mock". */
  name: string;
  /** Model identifier, or a deterministic ruleset version. */
  model: string;
}

export interface DemoSite {
  id: string;
  /** The lead this proposes a site for. Never embeds the lead. */
  leadId: string;
  /** The analysis this was generated from. Never embeds the analysis. */
  analysisId: string;
  status: DemoSiteStatus;
  createdAt: string;
  updatedAt: string;
  generator: DemoSiteGeneratorInfo;
  spec: DemoSiteSpec;
}

/** What the service assembles before the repository assigns identity and time. */
export type DemoSiteDraft = Pick<DemoSite, "generator" | "spec">;
