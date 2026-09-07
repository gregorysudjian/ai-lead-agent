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
 * `DemoSiteSpec` has exactly two subtrees:
 *
 *   business   what the provider listed, copied verbatim from the lead
 *              snapshot by application code. FACTS.
 *   content    layout, wording, section order, theme. PROPOSAL.
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
  /** Null when the provider listed none. Never invented, never guessed. */
  phone: string | null;
  address: string | null;
  websiteListed: boolean;
  source: BusinessSource;
  /** ISO-8601 of the provider snapshot these facts came from. */
  snapshotFetchedAt: string;
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
 * The ordered page sections.
 *
 * A discriminated union so a new section type is an additive change that the
 * compiler forces the renderer and the validator to handle.
 */
export type DemoSection =
  | {
      kind: "hero";
      id: string;
      eyebrow: string;
      heading: string;
      subheading: string;
      primaryCta: DemoCta;
      secondaryCta: DemoCta | null;
    }
  | {
      kind: "offering";
      id: string;
      heading: string;
      intro: string;
      items: DemoOfferingItem[];
    }
  | {
      kind: "positioning";
      id: string;
      heading: string;
      body: string;
      points: string[];
    }
  | {
      kind: "gallery";
      id: string;
      heading: string;
      body: string;
      placeholders: DemoPlaceholder[];
    }
  | {
      kind: "contact";
      id: string;
      heading: string;
      body: string;
      /** Prose about hours; never a fabricated schedule. */
      hoursNote: string;
    }
  | {
      kind: "cta";
      id: string;
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
  /** From the analysis. Shapes structure and wording, never facts. */
  recommendedSiteType: RecommendedSiteType;
  recommendedPages: string[];
  homepageSections: string[];
  keySellingPoints: string[];
  callsToAction: string[];
  designDirection: DesignDirection;
  draftPositioning: string;
  businessSummary: string;
}

export interface DemoSiteSpec {
  /** Application-owned. Never produced by a generator. */
  business: DemoSiteBusiness;
  /** Generator-owned. Proposal, not evidence. */
  content: DemoSiteContent;
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
