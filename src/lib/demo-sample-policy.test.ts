import { describe, expect, it } from "vitest";

import {
  enforceSampleFlags,
  evidenceFor,
  hasSampleContent,
  sampleSectionLabels,
  sectionMustBeSample,
  type SampleEvidence,
} from "./demo-sample-policy";
import type { DemoSection, DemoSiteBusiness, DemoSiteContent } from "./demo-site";

/**
 * The safety property this module exists for.
 *
 * A generator declares `sample` on each section. That declaration is not
 * trusted: the flag is recomputed from the facts actually held and OR-ed in,
 * so a generator can only ever mark MORE content as sample. Presenting
 * invented copy as confirmed is not something a persuasive prompt can achieve,
 * because the claim is overwritten rather than believed.
 */

function business(over: Partial<DemoSiteBusiness> = {}): DemoSiteBusiness {
  return {
    name: "Salon Bella",
    category: "Hair salon",
    city: "Montreal",
    phone: null,
    address: null,
    websiteListed: false,
    source: "osm",
    snapshotFetchedAt: "2026-01-01T00:00:00.000Z",
    socialLinks: [],
    openingHours: [],
    bookingUrl: null,
    ownDescription: null,
    profileSourced: false,
    ...over,
  };
}

const NO_EVIDENCE: SampleEvidence = {
  hasOwnDescription: false,
  hasOpeningHours: false,
  hasPhone: false,
  hasAddress: false,
};

const FULL_EVIDENCE: SampleEvidence = {
  hasOwnDescription: true,
  hasOpeningHours: true,
  hasPhone: true,
  hasAddress: true,
};

function section(kind: DemoSection["kind"], sample: boolean): DemoSection {
  const base = { id: "s1", sample };
  switch (kind) {
    case "hero":
      return {
        ...base,
        kind: "hero",
        eyebrow: "e",
        heading: "h",
        subheading: "s",
        primaryCta: { label: "Call us", action: "call" },
        secondaryCta: null,
      };
    case "offering":
      return {
        ...base,
        kind: "offering",
        heading: "h",
        intro: "i",
        items: [{ title: "t", body: "b" }],
      };
    case "positioning":
      return { ...base, kind: "positioning", heading: "h", body: "b", points: ["p"] };
    case "gallery":
      return { ...base, kind: "gallery", heading: "h", body: "b", placeholders: [{ label: "l" }] };
    case "contact":
      return { ...base, kind: "contact", heading: "h", body: "b", hoursNote: "n" };
    case "cta":
      return {
        ...base,
        kind: "cta",
        heading: "h",
        body: "b",
        cta: { label: "Call us", action: "call" },
      };
  }
}

function content(sections: DemoSection[]): DemoSiteContent {
  return {
    siteTitle: "Salon Bella",
    tagline: "Hair salon in Montreal",
    theme: "calm-minimal",
    layout: "classic",
    navigation: [],
    sections,
    footer: { note: "n" },
  };
}

const ALL_KINDS: DemoSection["kind"][] = [
  "hero",
  "offering",
  "positioning",
  "gallery",
  "contact",
  "cta",
];

describe("a generator cannot mark invented copy as confirmed", () => {
  it("forces sample on for every section when we hold no evidence", () => {
    // The generator lies about all six: every one comes back marked sample.
    const dishonest = content(ALL_KINDS.map((kind) => section(kind, false)));
    const enforced = enforceSampleFlags(dishonest, business());

    for (const s of enforced.sections) {
      expect(s.sample, s.kind).toBe(true);
    }
  });

  it("keeps sample on when the generator volunteered it", () => {
    // The flag may always be turned ON by the generator, for content it knows
    // it invented even where the facts would have allowed confirmation.
    const honest = content([section("positioning", true)]);
    const enforced = enforceSampleFlags(honest, business({ ownDescription: "We cut hair." }));
    expect(enforced.sections[0].sample).toBe(true);
  });

  it("is a pure OR: enforcement never turns a flag off", () => {
    for (const kind of ALL_KINDS) {
      for (const declared of [true, false]) {
        for (const evidence of [business(), business({ ownDescription: "x", openingHours: ["Mon"], phone: "+1", address: "1 St" })]) {
          const enforced = enforceSampleFlags(content([section(kind, declared)]), evidence);
          if (declared) {
            expect(enforced.sections[0].sample, `${kind} declared true`).toBe(true);
          }
        }
      }
    }
  });

  it("mutates neither the content nor its sections", () => {
    const original = content([section("hero", false)]);
    const before = JSON.stringify(original);
    enforceSampleFlags(original, business());
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe("sectionMustBeSample", () => {
  it("always requires sample for a gallery, whatever we know", () => {
    // We have never seen the premises and we do not fetch stock imagery.
    expect(sectionMustBeSample(section("gallery", false), FULL_EVIDENCE)).toBe(true);
    expect(sectionMustBeSample(section("gallery", false), NO_EVIDENCE)).toBe(true);
  });

  it("requires sample for copy sections without the business's own description", () => {
    for (const kind of ["hero", "offering", "positioning"] as const) {
      expect(sectionMustBeSample(section(kind, false), NO_EVIDENCE), kind).toBe(true);
      expect(
        sectionMustBeSample(section(kind, false), { ...NO_EVIDENCE, hasOwnDescription: true }),
        kind,
      ).toBe(false);
    }
  });

  it("requires sample for contact until we hold real hours and a way to reach them", () => {
    expect(sectionMustBeSample(section("contact", false), NO_EVIDENCE)).toBe(true);
    // Hours but nothing to act on.
    expect(
      sectionMustBeSample(section("contact", false), { ...NO_EVIDENCE, hasOpeningHours: true }),
    ).toBe(true);
    // A phone but no published hours.
    expect(
      sectionMustBeSample(section("contact", false), { ...NO_EVIDENCE, hasPhone: true }),
    ).toBe(true);
    // Both.
    expect(
      sectionMustBeSample(section("contact", false), {
        ...NO_EVIDENCE,
        hasOpeningHours: true,
        hasPhone: true,
      }),
    ).toBe(false);
  });

  it("requires sample for a closing prompt with no way to act on it", () => {
    expect(sectionMustBeSample(section("cta", false), NO_EVIDENCE)).toBe(true);
    expect(sectionMustBeSample(section("cta", false), { ...NO_EVIDENCE, hasPhone: true })).toBe(false);
    expect(sectionMustBeSample(section("cta", false), { ...NO_EVIDENCE, hasAddress: true })).toBe(false);
  });

  it("treats an analysis as no evidence at all", () => {
    // Not directly expressible here, and that is the point: `SampleEvidence`
    // has no field an analysis could populate. A proposal cannot confirm a
    // fact -- the same stated/observed vs inferred line BusinessProfile draws.
    const keys = Object.keys(NO_EVIDENCE).sort();
    expect(keys).toEqual(["hasAddress", "hasOpeningHours", "hasOwnDescription", "hasPhone"]);
  });
});

describe("evidenceFor", () => {
  it("reads presence, never values", () => {
    expect(evidenceFor(business())).toEqual(NO_EVIDENCE);
    expect(
      evidenceFor(
        business({
          ownDescription: "A salon.",
          openingHours: ["Mon 9-5"],
          phone: "+1 514-555-0100",
          address: "1 Rue Example",
        }),
      ),
    ).toEqual(FULL_EVIDENCE);
  });

  it("does not count an empty hours list as published hours", () => {
    expect(evidenceFor(business({ openingHours: [] })).hasOpeningHours).toBe(false);
  });
});

describe("reporting sample content to the reviewer", () => {
  it("detects whether a page carries any sample content", () => {
    expect(hasSampleContent(content([section("hero", false)]))).toBe(false);
    expect(hasSampleContent(content([section("hero", true)]))).toBe(true);
  });

  it("names the sample sections, calling the hero 'Header'", () => {
    // A hero's heading is the business's pitch line, not a section label, so
    // listing it verbatim in the chrome would read as nonsense.
    const page = content([section("hero", true), section("offering", true)]);
    expect(sampleSectionLabels(page)).toEqual(["Header", "h"]);
  });

  it("lists nothing when everything is confirmed", () => {
    expect(sampleSectionLabels(content([section("hero", false)]))).toEqual([]);
  });
});
