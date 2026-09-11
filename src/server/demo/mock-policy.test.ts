import { describe, expect, it } from "vitest";

import type { DemoSiteGeneratorInput } from "@/lib/demo-site";

import { HANDLED_SITE_TYPES, layoutFor, mockDemoSiteProvider } from "./mock";

/**
 * The line the generator holds, now that it may write sample copy.
 *
 * The old rule was "say nothing you cannot evidence", and it produced pages
 * whose every slot read "To be added." Honest, and useless: an owner shown a
 * blank template cannot picture their site, so the proposal died on the page.
 *
 * The rule now is "say what the section would say, and mark it as sample".
 * That moves the line; it does not remove it. What is still forbidden is the
 * CHECKABLE SPECIFIC -- a price, a founding year, an award, a named member of
 * staff, a review score, a phone number, an address, a URL. Generic
 * placeholder copy reads as a placeholder. One wrong specific makes the whole
 * proposal look like it was written without looking at the business.
 *
 * These patterns are the mechanical half of that rule; the judgement half is
 * the prose guidance at the top of `demo-samples.ts`.
 */

const input = (over: Partial<DemoSiteGeneratorInput> = {}): DemoSiteGeneratorInput => ({
  businessName: "Salon Test",
  category: "Hair salon",
  city: "Montreal",
  phoneListed: true,
  addressListed: true,
  websiteListed: false,
  socialLinksListed: false,
  openingHoursListed: false,
  bookingUrlListed: false,
  recommendedSiteType: "booking-focused-site",
  recommendedPages: ["Home", "Services", "Contact"],
  homepageSections: ["Intro", "Services", "Contact"],
  keySellingPoints: ["Nothing we actually know"],
  callsToAction: ["Call the shop"],
  designDirection: {
    tone: "Warm and local",
    palette: "Two neutrals plus one accent",
    imagery: "Photographs of the premises",
    typography: "One readable sans-serif",
  },
  draftPositioning: "A hair salon in Montreal.",
  businessSummary: "Listed as a hair salon in Montreal.",
  ...over,
});

/** Every supported category, plus one deliberately outside the registry. */
const CATEGORIES = [
  "Hair salon",
  "Barber shop",
  "Beauty salon",
  "Nail salon",
  "Tattoo & piercing",
  "Restaurant",
  "Cafe",
  "Dentist",
  "Pharmacy",
  "Bakery",
  "Gym",
  "Florist",
  "Car repair",
  "Locksmith",
];

describe("sample copy invents no checkable specific", () => {
  const FORBIDDEN: { label: string; pattern: RegExp }[] = [
    { label: "a currency amount", pattern: /[$£€¥]\s?\d/ },
    { label: "a price in words", pattern: /\b(?:from|only|just)\s+\d+\b/i },
    { label: "a percentage", pattern: /\d\s?%/ },
    {
      label: "a founding year",
      pattern: /\b(?:since|est\.?|established)\s+(?:1[89]|20)\d{2}\b/i,
    },
    { label: "a count of years in business", pattern: /\b\d+\+?\s+years\b/i },
    { label: "a star rating", pattern: /\b\d(?:\.\d)?\s*star\b/i },
    {
      label: "a review or customer count",
      pattern: /\b\d+\s+(?:reviews|ratings|customers|clients)\b/i,
    },
    {
      label: "an award or certification",
      pattern: /\b(?:award|awarded|certified|accredited|licensed|licence|diploma)\b/i,
    },
    { label: "a URL", pattern: /\b(?:https?:\/\/|www\.)/i },
    { label: "an email address", pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
    { label: "a phone-shaped number", pattern: /\d{3}[\s.-]\d{3,4}[\s.-]\d{3,4}/ },
    { label: "a clock time", pattern: /\b\d{1,2}[:.]\d{2}\b/ },
  ];

  it("writes no forbidden specific, for any category or layout", async () => {
    for (const category of CATEGORIES) {
      for (const siteType of HANDLED_SITE_TYPES) {
        for (const phoneListed of [true, false]) {
          const content = await mockDemoSiteProvider.generate(
            input({
              category,
              recommendedSiteType: siteType,
              phoneListed,
              addressListed: !phoneListed,
            }),
          );
          const text = JSON.stringify(content);
          for (const { label, pattern } of FORBIDDEN) {
            expect(
              text,
              `${category} / ${siteType} must not contain ${label}`,
            ).not.toMatch(pattern);
          }
        }
      }
    }
  });

  it("leaves no unfilled template placeholder in customer-facing copy", async () => {
    // A typo like {citty} would ship as a visible hole on a page shown to a
    // business owner. `fillSample` substitutes exactly two keys and leaves
    // anything else untouched, precisely so this can catch it.
    for (const category of CATEGORIES) {
      const content = await mockDemoSiteProvider.generate(input({ category }));
      expect(JSON.stringify(content), category).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it("uses the business's own name and city, never a stand-in", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ businessName: "Nordvik", category: "Bakery", city: "Oslo" }),
    );
    const text = JSON.stringify(content);
    expect(text).toContain("Nordvik");
    expect(text).toContain("Oslo");
    // The names used while writing the samples must never survive into output.
    expect(text).not.toContain("Salon Test");
    expect(text).not.toContain("Montreal");
  });
});

describe("the generator declares its own content as sample", () => {
  /**
   * Only half the mechanism: `enforceSampleFlags` recomputes each flag from
   * the facts held and OR-s it in, so nothing here can present invented copy
   * as confirmed. The generator should still be honest on its own account,
   * because a future reader will reasonably assume that it is.
   */
  it("marks every section sample for a business we know nothing about", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate(
        input({ recommendedSiteType: siteType, openingHoursListed: false }),
      );
      for (const section of content.sections) {
        expect(section.sample, `${siteType} / ${section.kind}`).toBe(true);
      }
    }
  });

  it("confirms the contact section once real hours and a contact route exist", async () => {
    // The payoff from parsing OpenStreetMap's `opening_hours`. Its copy is an
    // invitation rather than a claim, and the values beside it are rendered
    // from facts -- so with real published hours and a real way to reach the
    // business, nothing in it is placeholder.
    //
    // Without this the best fact we hold about a website-less business would
    // still carry a "sample content" tag, because `enforceSampleFlags` only
    // ever ORs the flag on and a hardcoded `true` can never be withdrawn.
    const content = await mockDemoSiteProvider.generate(
      input({ openingHoursListed: true, phoneListed: true }),
    );
    const contact = content.sections.find((s) => s.kind === "contact");
    expect(contact?.sample).toBe(false);
  });

  it("keeps the contact section sample when the hours are real but nothing can be reached", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ openingHoursListed: true, phoneListed: false, addressListed: false }),
    );
    expect(content.sections.find((s) => s.kind === "contact")?.sample).toBe(true);
  });

  it("keeps the contact section sample when the hours are ours rather than theirs", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ openingHoursListed: false, phoneListed: true, addressListed: true }),
    );
    expect(content.sections.find((s) => s.kind === "contact")?.sample).toBe(true);
  });

  it("still marks the invented sections sample even with full contact evidence", async () => {
    // Real hours confirm the contact block. They say nothing about a services
    // list we wrote, so those stay marked.
    const content = await mockDemoSiteProvider.generate(
      input({ openingHoursListed: true, phoneListed: true, addressListed: true }),
    );
    for (const kind of ["hero", "offering", "positioning"] as const) {
      expect(content.sections.find((s) => s.kind === kind)?.sample, kind).toBe(true);
    }
  });
});

describe("the page is actually complete", () => {
  /**
   * Completeness is now a tested property, because the failure this change
   * exists to fix was a technically-honest page nobody could react to.
   */
  it("builds a full page for a business we know almost nothing about", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({
        businessName: "Nordvik",
        category: "Bakery",
        city: "Oslo",
        phoneListed: false,
        addressListed: false,
        websiteListed: false,
        recommendedSiteType: "small-brochure-site",
      }),
    );

    expect(content.sections.length).toBeGreaterThanOrEqual(5);
    expect(content.navigation.length).toBeGreaterThanOrEqual(3);

    const offering = content.sections.find((s) => s.kind === "offering");
    if (offering?.kind !== "offering") throw new Error("unreachable");
    expect(offering.items.length).toBeGreaterThanOrEqual(3);
    for (const item of offering.items) {
      // Real sentences, not one-word stubs.
      expect(item.body.length).toBeGreaterThan(40);
    }

    const about = content.sections.find((s) => s.kind === "positioning");
    if (about?.kind !== "positioning") throw new Error("unreachable");
    expect(about.points.length).toBeGreaterThanOrEqual(2);
    expect(about.body.length).toBeGreaterThan(60);
  });

  it("never falls back to 'to be added' anywhere on the page", async () => {
    // The marker the old generator leaned on. Its absence is the point of the
    // change, so it is asserted rather than assumed.
    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate(
        input({ recommendedSiteType: siteType, phoneListed: false, addressListed: false }),
      );
      expect(JSON.stringify(content).toLowerCase(), siteType).not.toContain("to be added");
    }
  });

  it("gives different categories genuinely different copy", async () => {
    // A template with the name swapped in is what this change exists to stop.
    // A salon and a garage must not read the same.
    const salon = await mockDemoSiteProvider.generate(input({ category: "Hair salon" }));
    const garage = await mockDemoSiteProvider.generate(input({ category: "Car repair" }));

    const titles = (content: typeof salon) => {
      const offering = content.sections.find((s) => s.kind === "offering");
      if (offering?.kind !== "offering") throw new Error("unreachable");
      return offering.items.map((item) => item.title).join("|");
    };

    expect(titles(salon)).not.toBe(titles(garage));
    expect(titles(salon).length).toBeGreaterThan(0);
  });

  it("still produces byte-identical output for identical input", async () => {
    // Determinism survives the rewrite: no clock, no randomness, no network.
    const a = await mockDemoSiteProvider.generate(input({ category: "Florist" }));
    const b = await mockDemoSiteProvider.generate(input({ category: "Florist" }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("the page never invites an action we cannot back", () => {
  /**
   * A real bug this caught: a barber shop with an address but no phone got a
   * closing section reading "Call ahead if you prefer a set time" directly
   * above a contact card reading "Phone: to be added".
   *
   * That is the exact failure mode the whole sample-content design is trying
   * to avoid. An owner does not read it as a placeholder; they read it as
   * proof that nobody looked at their listing before writing to them.
   */
  it("says nothing about calling when no phone number is listed", async () => {
    for (const category of CATEGORIES) {
      for (const siteType of HANDLED_SITE_TYPES) {
        const content = await mockDemoSiteProvider.generate(
          input({
            category,
            recommendedSiteType: siteType,
            phoneListed: false,
            addressListed: true,
          }),
        );
        expect(
          JSON.stringify(content).toLowerCase(),
          `${category} / ${siteType} must not mention calling without a phone`,
        ).not.toContain("call");
      }
    }
  });

  it("says nothing about visiting when no address is listed", async () => {
    for (const category of CATEGORIES) {
      const content = await mockDemoSiteProvider.generate(
        input({ category, phoneListed: true, addressListed: false }),
      );
      const text = JSON.stringify(content).toLowerCase();
      for (const phrase of [
        "come and see",
        "drop in",
        "come in and",
        "visit us",
        "walk in",
        "come and find",
      ]) {
        expect(text, `${category} must not invite a visit with no address`).not.toContain(
          phrase,
        );
      }
    }
  });

  it("resolves the primary button to a real action in every case", async () => {
    // `call` is only ever chosen when a number exists. With neither a phone
    // nor an address the button scrolls, which always works.
    for (const phoneListed of [true, false]) {
      const content = await mockDemoSiteProvider.generate(
        input({ phoneListed, addressListed: false }),
      );
      const hero = content.sections[0];
      if (hero.kind !== "hero") throw new Error("unreachable");
      expect(hero.primaryCta.action).toBe(phoneListed ? "call" : "scroll");
    }
  });
});

describe("layouts differ between businesses", () => {
  /**
   * "The websites are very similar" was the complaint. A theme changed the
   * colours, but every page used the same arrangement, so a portfolio of demos
   * read as one template with the names swapped.
   *
   * The layout is chosen from the business's own NAME rather than its
   * category, so two salons on the same street get visibly different pages.
   */
  const NAMES = [
    "Salon Bella", "Coiffure Rivard", "Studio Neuf", "Chez Mostafa",
    "Le Petit Salon", "Atelier Coupe", "Maison Claire", "Salon Nord",
    "Beau Cheveux", "La Boucle", "Tresse et Cie", "Salon Lumiere",
  ];

  it("does not give every business the same layout", () => {
    const layouts = new Set(
      NAMES.map((businessName) => layoutFor(input({ businessName }))),
    );
    // The real assertion: more than one design in use across a dozen salons.
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("spreads businesses across every general-purpose layout", () => {
    const layouts = new Set(
      NAMES.map((businessName) => layoutFor(input({ businessName }))),
    );
    for (const expected of ["classic", "editorial", "showcase"]) {
      expect(layouts.has(expected as never), `no business landed on ${expected}`).toBe(true);
    }
  });

  it("is stable for the same business", () => {
    // Regenerating must not silently redesign a site the operator already
    // showed someone. The choice is a hash, not a counter or a clock.
    for (const businessName of NAMES) {
      const first = layoutFor(input({ businessName }));
      const second = layoutFor(input({ businessName }));
      expect(second, businessName).toBe(first);
    }
  });

  it("ignores the category, so two salons can differ", () => {
    const a = layoutFor(input({ businessName: "Salon Bella", category: "Hair salon" }));
    const b = layoutFor(input({ businessName: "Salon Bella", category: "Bakery" }));
    expect(b).toBe(a);
  });

  it("always uses compact for a one-page site", () => {
    // A real constraint, not a preference: the other designs assume enough
    // sections to establish a rhythm and look sparse when handed four.
    for (const businessName of NAMES) {
      expect(
        layoutFor(input({ businessName, recommendedSiteType: "one-page-site" })),
        businessName,
      ).toBe("compact");
    }
  });

  it("always uses showcase for a portfolio site", () => {
    for (const businessName of NAMES) {
      expect(
        layoutFor(input({ businessName, recommendedSiteType: "portfolio-site" })),
        businessName,
      ).toBe("showcase");
    }
  });

  it("puts a layout on every page it generates", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate(
        input({ recommendedSiteType: siteType }),
      );
      expect(content.layout, siteType).toBeTruthy();
    }
  });
});

describe("French copy holds the same line", () => {
  /**
   * Every rule above, again, for the French page -- which is the page a
   * Montreal owner reads first. French needs its own patterns: "depuis 1998"
   * is the founding year, "primé" the award, "prix" the price, and \b is no
   * use next to an accented letter, so words are bounded with \p{L}.
   */
  const word = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, "iu");
  const FORBIDDEN_FR: { label: string; pattern: RegExp }[] = [
    { label: "a currency amount", pattern: /\d\s?\$|\$\s?\d/ },
    { label: "a founding year", pattern: /(?:depuis|fondée?\s+en|en\s+affaires\s+depuis)\s+(?:1[89]|20)\d{2}/iu },
    { label: "a count of years", pattern: /\d+\+?\s+ans(?!\p{L})/iu },
    { label: "a star rating or review count", pattern: word("étoiles?|avis|évaluations?") },
    { label: "a price", pattern: word("prix|tarifs?|rabais|gratuite?s?|offerte?s?") },
    {
      label: "an award, a certification or a guarantee",
      pattern: word("primée?s?|certifiée?s?|diplômée?s?|agréée?s?|accréditée?s?|licenciée?s?|garantie?s?|meilleure?s?\s+(?:de|à|en)"),
    },
    { label: "a payment method", pattern: word("comptant|carte\s+de\s+crédit|interac") },
    { label: "a clock time", pattern: /\d{1,2}\s?h(?:\s?\d{2})?(?!\p{L})|\d{1,2}[:.]\d{2}/u },
    { label: "a URL or email", pattern: /https?:\/\/|www\.|@[a-z0-9-]+\./i },
  ];

  const fr = (over: Partial<DemoSiteGeneratorInput> = {}) => input({ ...over, locale: "fr" });

  it("writes no forbidden specific in French, for any category or layout", async () => {
    for (const category of CATEGORIES) {
      for (const siteType of HANDLED_SITE_TYPES) {
        for (const phoneListed of [true, false]) {
          for (const name of ["Salon Test", "Chez Nadia", "Barbier 88", "Studio Noir", "Maison Verte"]) {
            const content = await mockDemoSiteProvider.generate(
              fr({ businessName: name, category, recommendedSiteType: siteType, phoneListed, addressListed: !phoneListed }),
            );
            const text = JSON.stringify(content);
            for (const { label, pattern } of FORBIDDEN_FR) {
              expect(text, `${category} / ${siteType} / ${name} must not contain ${label}`).not.toMatch(pattern);
            }
          }
        }
      }
    }
  });

  it("the English pages still clear the English patterns with every pick", async () => {
    // The pools added lines; the original sweep used one name. Every name
    // here lands on different picks.
    for (const category of CATEGORIES) {
      for (const name of ["Chez Nadia", "Barbier 88", "Studio Noir", "Maison Verte", "Salon 7"]) {
        const text = JSON.stringify(await mockDemoSiteProvider.generate(input({ businessName: name, category })));
        expect(text, `${category} / ${name}`).not.toMatch(/[$£€¥]\s?\d|\d\s?%|\b\d+\+?\s+years\b|\b(?:award|certified|licensed|accredited|cash|card accepted)\b/i);
      }
    }
  });

  it("says nothing about calling in French when no phone number is listed", async () => {
    for (const category of CATEGORIES) {
      for (const name of ["Salon Test", "Chez Nadia", "Barbier 88", "Studio Noir", "Maison Verte"]) {
        const content = await mockDemoSiteProvider.generate(
          fr({ businessName: name, category, phoneListed: false, addressListed: true }),
        );
        const text = JSON.stringify(content).toLowerCase();
        for (const phrase of ["appel", "téléphon", "coup de fil"]) {
          expect(text, `${category} / ${name} must not mention calling without a phone`).not.toContain(phrase);
        }
      }
    }
  });

  it("says nothing about visiting in French when no address is listed", async () => {
    for (const category of CATEGORIES) {
      for (const name of ["Salon Test", "Chez Nadia", "Barbier 88", "Studio Noir", "Maison Verte"]) {
        const content = await mockDemoSiteProvider.generate(
          fr({ businessName: name, category, phoneListed: true, addressListed: false }),
        );
        // Whole words: "prévenez-nous" (let us know) contains "venez" (come).
        expect(JSON.stringify(content), `${category} / ${name} must not invite a visit with no address`).not.toMatch(
          word("passez|venez|amenez|entrez|nous\s+trouver|nous\s+voir"),
        );
      }
    }
  });

  it("leaves no unfilled placeholder in French", async () => {
    for (const category of CATEGORIES) {
      const content = await mockDemoSiteProvider.generate(fr({ category }));
      expect(JSON.stringify(content), category).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it("builds the French page with exactly the English page's structure", async () => {
    // Switching language must change the words and nothing else.
    for (const category of CATEGORIES) {
      for (const siteType of HANDLED_SITE_TYPES) {
        for (const [phoneListed, addressListed] of [[true, true], [true, false], [false, true], [false, false]]) {
          const over = { category, recommendedSiteType: siteType, phoneListed, addressListed, businessName: "Chez Nadia" };
          const en = await mockDemoSiteProvider.generate(input(over));
          const french = await mockDemoSiteProvider.generate(fr(over));
          const shape = (c: typeof en) =>
            JSON.stringify({
              theme: c.theme,
              layout: c.layout,
              nav: c.navigation.map((n) => n.targetSectionId),
              sections: c.sections.map((s) => ({
                kind: s.kind,
                id: s.id,
                sample: s.sample,
                n: "items" in s ? s.items.length : "points" in s ? s.points.length : "placeholders" in s ? s.placeholders.length : 0,
                ctas:
                  s.kind === "hero"
                    ? [s.primaryCta.action, s.primaryCta.targetSectionId, s.secondaryCta?.action, s.secondaryCta?.targetSectionId]
                    : s.kind === "cta"
                      ? [s.cta.action, s.cta.targetSectionId]
                      : [],
              })),
            });
          expect(shape(french), `${category} / ${siteType}`).toBe(shape(en));
        }
      }
    }
  });

  it("calls the business by its brand, not its whole directory listing", async () => {
    const content = await mockDemoSiteProvider.generate(
      fr({ businessName: "Klyne Beauty - Salon de coiffure Africaine, Dreadlocks, Tresses", category: "Hair salon" }),
    );
    const about = content.sections.find((s) => s.kind === "positioning");
    const text = JSON.stringify(content.sections);
    expect(text).not.toContain("Dreadlocks");
    if (about?.kind === "positioning" && about.body.includes("Klyne")) expect(about.body).toContain("Klyne Beauty");
    // The page title keeps the full stored name: it is the business's own.
    expect(content.siteTitle).toContain("Dreadlocks");
  });

  it("is written in French", async () => {
    const content = await mockDemoSiteProvider.generate(fr({ category: "Barber shop", addressListed: true, phoneListed: true }));
    expect(content.tagline).toBe("Barbier à Montreal");
    expect(content.navigation.map((n) => n.label)).toContain("À propos");
    const hero = content.sections[0];
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.primaryCta.label).toBe("Appelez-nous");
  });
});
