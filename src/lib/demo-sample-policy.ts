/**
 * Which demo sections must be marked as sample content.
 *
 * ── THE SAFETY PROPERTY ───────────────────────────────────────────────────
 *
 * A generator declares `sample` on each section it returns. This module does
 * not trust that declaration. It recomputes the flag from the facts actually
 * held about the business and OR-s the two together, so:
 *
 *     stored flag  =  generator's flag  OR  what the facts require
 *
 * A generator can therefore only ever mark MORE content as sample, never less.
 * Marking invented copy as confirmed is not something a persuasive prompt can
 * achieve, because the claim is overwritten rather than believed. This is the
 * same structural approach the rest of the demo pipeline takes: the schema has
 * no field for a URL, so no URL can be stored; the flag is recomputed, so no
 * false "confirmed" can be stored.
 *
 * ── WHAT COUNTS AS EVIDENCE ───────────────────────────────────────────────
 *
 * Only facts we actually hold about THIS business:
 *
 *   - the provider snapshot: name, category, city, phone, address
 *   - a researched `BusinessProfile`: the business's own description, its
 *     published opening hours, its social links, its booking URL
 *
 * An analysis is NOT evidence. It is our own proposal about the business, and
 * a proposal cannot confirm anything -- that is the `stated | observed` versus
 * `inferred` distinction `BusinessProfile` already draws, applied here.
 */
import type { DemoSection, DemoSiteBusiness, DemoSiteContent } from "./demo-site";

/**
 * The evidence that bears on whether a section can be confirmed.
 *
 * A narrow structural type rather than `DemoSiteBusiness` itself, so this
 * stays a pure function of the four things that matter and callers can test it
 * without building a whole business record.
 */
export interface SampleEvidence {
  /** The business's own description, read from its own site. */
  hasOwnDescription: boolean;
  /** Opening hours the business itself published. */
  hasOpeningHours: boolean;
  /** A phone number from any source. */
  hasPhone: boolean;
  /** A street address from any source. */
  hasAddress: boolean;
}

export function evidenceFor(business: DemoSiteBusiness): SampleEvidence {
  return {
    hasOwnDescription: business.ownDescription !== null,
    hasOpeningHours: business.openingHours.length > 0,
    hasPhone: business.phone !== null,
    hasAddress: business.address !== null,
  };
}

/**
 * Must this section be marked sample, given the evidence?
 *
 * Read this as the honest answer to "could we show this block to the owner and
 * defend every line of it?"
 */
export function sectionMustBeSample(
  section: DemoSection,
  evidence: SampleEvidence,
): boolean {
  switch (section.kind) {
    case "hero":
      // The hero is built from name, category and city, which we always hold.
      // Its headline is still marketing copy we wrote, so it is confirmed only
      // when the business has described itself and we could ground it.
      return !evidence.hasOwnDescription;

    case "offering":
      // A services list. We are never told what a business actually offers --
      // no provider field carries it and research rarely recovers it -- so
      // this is sample unless the business described itself.
      return !evidence.hasOwnDescription;

    case "positioning":
      // "About us". Confirmed only when written from the business's own words.
      return !evidence.hasOwnDescription;

    case "gallery":
      // We have never seen the premises and we do not fetch stock imagery.
      // Placeholders are always exactly that.
      return true;

    case "contact":
      // The contact VALUES are rendered from application-owned facts and are
      // not part of this copy. What can be wrong here is the hours note, so
      // the section is confirmed only when we hold real published hours and
      // something real to point at.
      return !evidence.hasOpeningHours || !(evidence.hasPhone || evidence.hasAddress);

    case "cta":
      // A closing prompt. Defensible when there is a real way to act on it.
      return !(evidence.hasPhone || evidence.hasAddress);
  }
}

/**
 * Apply the policy to a whole generated page.
 *
 * Pure: returns new objects and mutates nothing, so the generator's own result
 * stays intact for logging or comparison.
 */
export function enforceSampleFlags(
  content: DemoSiteContent,
  business: DemoSiteBusiness,
): DemoSiteContent {
  const evidence = evidenceFor(business);

  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      // OR, never assignment. The generator may volunteer that something is
      // sample; it may never withdraw the marking.
      sample: section.sample || sectionMustBeSample(section, evidence),
    })),
  };
}

/** Does this page contain any sample content at all? */
export function hasSampleContent(content: DemoSiteContent): boolean {
  return content.sections.some((section) => section.sample);
}

/**
 * The headings of the sample sections, for the preview chrome.
 *
 * The chrome states plainly which parts of the page are placeholder, so the
 * disclosure survives even if someone screenshots the page without the inline
 * tags. Hero sections are named by their kind, since their heading is the
 * business's own pitch line rather than a section label.
 */
export function sampleSectionLabels(content: DemoSiteContent): string[] {
  return content.sections
    .filter((section) => section.sample)
    .map((section) => (section.kind === "hero" ? "Header" : section.heading));
}
