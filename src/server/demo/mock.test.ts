import { describe, expect, it } from "vitest";

import type { RecommendedSiteType } from "@/lib/analysis";
import type { DemoSiteGeneratorInput } from "@/lib/demo-site";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";

import { HANDLED_SITE_TYPES, mockDemoSiteProvider, themeFor } from "./mock";
import { DemoSiteProviderError } from "./types";

/**
 * The deterministic generator.
 *
 * Two things are asserted throughout: that it is genuinely deterministic and
 * offline, and that it holds the line on inventing facts.
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
  keySellingPoints: ["Open six days a week is not something we know"],
  callsToAction: ["Call the shop"],
  designDirection: {
    tone: "Warm and local",
    palette: "Two neutrals plus one accent",
    imagery: "Photographs of the premises",
    typography: "One readable sans-serif",
  },
  draftPositioning: "A hair salon in Montreal, easy to find and easy to contact.",
  businessSummary: "Listed as a hair salon in Montreal.",
  ...over,
});

describe("the generator is deterministic and offline", () => {
  it("produces identical content for identical input", async () => {
    const first = await mockDemoSiteProvider.generate(input());
    const second = await mockDemoSiteProvider.generate(input());
    expect(first).toEqual(second);
  });

  it("serialises identically across runs", async () => {
    const a = JSON.stringify(await mockDemoSiteProvider.generate(input()));
    const b = JSON.stringify(await mockDemoSiteProvider.generate(input()));
    expect(a).toBe(b);
  });

  it("identifies itself by a ruleset version, not a model", () => {
    expect(mockDemoSiteProvider.name).toBe("mock");
    expect(mockDemoSiteProvider.model).toBe("deterministic-demo-rules-v3");
  });

  it("rejects a business with no usable name", async () => {
    await expect(mockDemoSiteProvider.generate(input({ businessName: "   " }))).rejects.toBeInstanceOf(
      DemoSiteProviderError,
    );
  });

  it("rejects a business with no usable category or city", async () => {
    await expect(mockDemoSiteProvider.generate(input({ category: "" }))).rejects.toBeInstanceOf(
      DemoSiteProviderError,
    );
    await expect(mockDemoSiteProvider.generate(input({ city: "" }))).rejects.toBeInstanceOf(
      DemoSiteProviderError,
    );
  });
});

describe("every recommended site type produces a coherent site", () => {
  it.each(HANDLED_SITE_TYPES.map((t) => [t]))("handles %s", async (siteType) => {
    const content = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: siteType as RecommendedSiteType }),
    );

    expect(content.sections.length).toBeGreaterThanOrEqual(4);
    expect(content.sections[0].kind).toBe("hero");
    expect(content.sections.some((s) => s.kind === "contact")).toBe(true);
    expect(content.sections.some((s) => s.kind === "cta")).toBe(true);
    expect(content.theme in DEMO_THEME_LABELS).toBe(true);
  });

  it("shows a booking layout without claiming a booking system exists", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "booking-focused-site" }),
    );

    // Sample copy may describe appointments -- it is marked as sample. What
    // may never happen is an ACTION we cannot back: the button resolves to a
    // phone call or an in-page scroll, never to a booking system nobody told
    // us about. `DemoCtaAction` has no member that could express one.
    const hero = content.sections[0];
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.primaryCta.label.toLowerCase()).not.toContain("book");
  });

  it("gives a portfolio site a gallery of placeholders, not photographs", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "portfolio-site" }),
    );
    const gallery = content.sections.find((s) => s.kind === "gallery");
    expect(gallery).toBeDefined();
    if (gallery?.kind !== "gallery") throw new Error("unreachable");
    expect(gallery.placeholders.length).toBeGreaterThan(0);
  });

  it("keeps a one-page site compact", async () => {
    const compact = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "one-page-site" }),
    );
    const brochure = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "small-brochure-site" }),
    );
    expect(compact.sections.length).toBeLessThan(brochure.sections.length);
  });

  it("gives every section a unique id that the navigation resolves against", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate(
        input({ recommendedSiteType: siteType }),
      );
      const ids = content.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of content.navigation) {
        expect(ids).toContain(item.targetSectionId);
      }
    }
  });
});

describe("it designs around missing data instead of inventing it", () => {
  it("does not offer a call action when no phone was listed", async () => {
    const content = await mockDemoSiteProvider.generate(input({ phoneListed: false }));
    const actions = content.sections.flatMap((s) =>
      s.kind === "hero"
        ? [s.primaryCta.action, ...(s.secondaryCta ? [s.secondaryCta.action] : [])]
        : s.kind === "cta"
          ? [s.cta.action]
          : [],
    );
    expect(actions).not.toContain("call");
  });

  it("offers a call action when a phone was listed", async () => {
    const content = await mockDemoSiteProvider.generate(input({ phoneListed: true }));
    const hero = content.sections[0];
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.primaryCta.action).toBe("call");
  });

  it("does not offer directions when no address was listed", async () => {
    const content = await mockDemoSiteProvider.generate(input({ addressListed: false }));
    const hero = content.sections[0];
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.secondaryCta?.action).not.toBe("directions");
  });

  it("promises no contact route when none was listed", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ phoneListed: false, addressListed: false }),
    );
    const contact = content.sections.find((s) => s.kind === "contact");
    if (contact?.kind !== "contact") throw new Error("unreachable");

    // It invites neither a call nor a visit, and it does not narrate the
    // provider record to a visitor who has no idea what one is.
    const body = contact.body.toLowerCase();
    expect(body).not.toContain("call");
    expect(body).not.toContain("come and see");
    expect(body).not.toContain("listed");
  });
});

describe("it invents no business facts", () => {
  /** Everything the brief forbids a generator from asserting. */
  const FORBIDDEN = [
    "$",
    "€",
    "£",
    "%",
    "award",
    "certified",
    "certification",
    "years in business",
    "since 19",
    "since 20",
    "testimonial",
    "5-star",
    "five star",
    "reviews say",
    "instagram",
    "facebook",
    "http://",
    "https://",
    "www.",
    ".com",
    "9am",
    "9:00",
    "monday",
    "open 24",
  ];

  it("produces no price, award, tenure, testimonial, hours or link", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      for (const phoneListed of [true, false]) {
        const content = await mockDemoSiteProvider.generate(
          input({ recommendedSiteType: siteType, phoneListed }),
        );
        // Nothing is excluded any more: the generator writes every string,
        // the positioning section included, so all of it is in scope.
        const text = JSON.stringify(content).toLowerCase();
        for (const needle of FORBIDDEN) {
          expect(text, `${siteType} must not contain "${needle}"`).not.toContain(needle);
        }
      }
    }
  });

  it("never fabricates a schedule in the hours note", async () => {
    const content = await mockDemoSiteProvider.generate(input());
    const contact = content.sections.find((s) => s.kind === "contact");
    if (contact?.kind !== "contact") throw new Error("unreachable");

    // The note is prose. The schedule itself -- real hours when we hold them,
    // a clearly-tagged sample when we do not -- is rendered by application
    // code from `spec.business`, so no generator can write a time into it.
    expect(contact.hoursNote).not.toMatch(/[0-9]/);
  });

  it("has no field in which a URL could be returned at all", async () => {
    const content = await mockDemoSiteProvider.generate(input());
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(content);

    for (const forbidden of ["href", "url", "link", "src", "image", "html", "style"]) {
      expect([...keys].map((k) => k.toLowerCase())).not.toContain(forbidden);
    }
  });
});

describe("theme selection is led by the category, not by prose", () => {
  const base = input();

  it("ignores the design direction for a category we have an opinion about", () => {
    // The bug this replaces: the deterministic analyser describes its palette
    // as "high contrast for readability" -- a note about LEGIBILITY -- and
    // theme selection matched the words "high contrast" against the loud
    // lime-on-black theme. Every florist, dentist and bakery in the database
    // came out looking like a skate shop.
    const salon = { ...base, category: "Hair salon" };
    const asAnalysed = themeFor({
      ...salon,
      designDirection: {
        ...salon.designDirection,
        palette: "Two neutrals plus one accent colour, high contrast for readability",
      },
    });
    expect(asAnalysed).not.toBe("bold-contrast");
    // And the prose genuinely has no say: a different palette, same answer.
    expect(
      themeFor({ ...salon, designDirection: { ...salon.designDirection, palette: "muted" } }),
    ).toBe(asAnalysed);
  });

  it("never gives a florist the loudest theme", () => {
    for (const businessName of ["Verdure Chic", "Chora Design Floral", "Fleuriste Lynda"]) {
      expect(themeFor({ ...base, category: "Florist", businessName })).not.toBe("bold-contrast");
    }
  });

  it("varies the theme between businesses in the same category", () => {
    // Two salons on the same street must not get identical pages.
    const themes = new Set(
      ["Salon Bella", "Coiffure Rivard", "Studio Neuf", "Maison Claire", "La Boucle"].map(
        (businessName) => themeFor({ ...base, category: "Hair salon", businessName }),
      ),
    );
    expect(themes.size).toBeGreaterThan(1);
  });

  it("is stable for the same business", () => {
    const salon = { ...base, category: "Hair salon", businessName: "Salon Bella" };
    expect(themeFor(salon)).toBe(themeFor(salon));
  });

  it("consults the mood only for a category it does not recognise", () => {
    const unknown = { ...base, category: "Locksmith" };
    expect(
      themeFor({ ...unknown, designDirection: { ...unknown.designDirection, tone: "warm" } }),
    ).toBe("warm-classic");
    expect(
      themeFor({ ...unknown, designDirection: { ...unknown.designDirection, tone: "elegant dark" } }),
    ).toBe("elegant-dark");
  });

  it("falls back to a site-type default for an unknown category and mood", () => {
    const blank = {
      ...base,
      category: "Locksmith",
      designDirection: { tone: "x", palette: "y", imagery: "z", typography: "w" },
    };
    expect(themeFor({ ...blank, recommendedSiteType: "booking-focused-site" })).toBe("fresh-modern");
    expect(themeFor({ ...blank, recommendedSiteType: "menu-and-location-site" })).toBe("warm-classic");
    expect(themeFor({ ...blank, recommendedSiteType: "one-page-site" })).toBe("calm-minimal");
  });

  it("only ever returns a theme we defined", () => {
    const hostile = {
      ...base,
      category: "Locksmith",
      designDirection: {
        tone: "background:red;color:#fff",
        palette: "<style>body{display:none}</style>",
        imagery: "javascript:alert(1)",
        typography: "font-family: Comic Sans",
      },
    };
    expect(themeFor(hostile) in DEMO_THEME_LABELS).toBe(true);
  });

  it("returns a defined theme for every supported category", () => {
    for (const category of [
      "Hair salon", "Barber shop", "Beauty salon", "Nail salon", "Restaurant",
      "Cafe", "Dentist", "Pharmacy", "Bakery", "Gym", "Florist", "Car repair",
    ]) {
      expect(themeFor({ ...base, category }) in DEMO_THEME_LABELS, category).toBe(true);
    }
  });
});

describe("the copy speaks to the business's customers, not to us", () => {
  /**
   * Our internal vocabulary. A visitor to a barber's website has no idea what
   * a "provider", a "listing" or an "analysis" is, and a page that talks about
   * its own sections is a wireframe, not a proposal. Checked as whole words so
   * an innocent substring cannot trip it.
   */
  const INTERNAL_WORDS = [
    "site",
    "website",
    "page",
    "pages",
    "section",
    "sections",
    "layout",
    "wording",
    "placeholder",
    "wireframe",
    "prototype",
    "template",
    "mock",
    "demo",
    "draft",
    "proposal",
    "provider",
    "listing",
    "listed",
    "analysis",
    "verified",
    "unverified",
    "lead",
    "customer",
    "customers",
  ];

  /** Phrasing addressed to the business owner rather than to their customer. */
  const OWNER_PHRASES = [
    "to be replaced",
    "in your own words",
    "written with you",
    "with you rather than",
    "starting point",
    "on this page",
    "would carry",
    "you confirm",
    "has not been verified",
    "kept up to date",
  ];

  /**
   * Every human-readable string the generator produced.
   *
   * Machine fields (ids, kinds, the theme name, CTA actions) are skipped --
   * they are never shown as words. So is `siteTitle`, which is the business's
   * own name copied verbatim: we must not rewrite that, whatever it contains.
   */
  const MACHINE_KEYS = new Set(["id", "kind", "theme", "action", "targetSectionId", "siteTitle"]);

  function copyOf(content: Awaited<ReturnType<typeof mockDemoSiteProvider.generate>>): string {
    const found: string[] = [];
    const walk = (value: unknown, key?: string) => {
      if (key !== undefined && MACHINE_KEYS.has(key)) return;
      if (typeof value === "string") return void found.push(value);
      if (Array.isArray(value)) return void value.forEach((v) => walk(v));
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, k);
      }
    };
    walk(content);
    return found.join(" | ");
  }

  const words = (text: string) => new Set(text.toLowerCase().split(/[^a-z]+/));

  it("uses none of our internal vocabulary, for any site type", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      for (const phoneListed of [true, false]) {
        for (const addressListed of [true, false]) {
          const content = await mockDemoSiteProvider.generate(
            input({ recommendedSiteType: siteType, phoneListed, addressListed }),
          );
          const present = words(copyOf(content));
          for (const banned of INTERNAL_WORDS) {
            expect(present.has(banned), `${siteType} must not say "${banned}"`).toBe(false);
          }
        }
      }
    }
  });

  it("never addresses the business owner", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      const text = copyOf(await mockDemoSiteProvider.generate(input({ recommendedSiteType: siteType })))
        .toLowerCase();
      for (const phrase of OWNER_PHRASES) {
        expect(text, `${siteType} must not say "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it("quotes no prose from the analysis", async () => {
    // Every analysis string carries a marker. None of them may reach the page:
    // the analysis shapes structure and theme, it does not supply copy.
    const marked = input({
      businessSummary: "ZZSUMMARY restates the provider listing only and is unverified.",
      keySellingPoints: ["ZZPOINT clear description of what the business offers"],
      callsToAction: ["ZZCTA"],
      homepageSections: ["ZZHOMEPAGE"],
      recommendedPages: ["ZZPAGE"],
      // The last passthrough: the hero heading used to be this string verbatim.
      draftPositioning: "ZZPOSITIONING easy to find and easy to contact",
    });

    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate({
        ...marked,
        recommendedSiteType: siteType,
      });
      const text = JSON.stringify(content);
      for (const marker of [
        "ZZSUMMARY",
        "ZZPOINT",
        "ZZCTA",
        "ZZHOMEPAGE",
        "ZZPAGE",
        "ZZPOSITIONING",
      ]) {
        expect(text, `${siteType} leaked ${marker}`).not.toContain(marker);
      }
    }
  });

  it("still names the business and its city, which are facts we hold", async () => {
    const content = await mockDemoSiteProvider.generate(input());
    expect(content.siteTitle).toBe("Salon Test");
    expect(JSON.stringify(content)).toContain("Montreal");
  });

  it("marks an unavailable slot without claiming anything about it", async () => {
    const content = await mockDemoSiteProvider.generate(input());
    const contact = content.sections.find((s) => s.kind === "contact");
    if (contact?.kind !== "contact") throw new Error("unreachable");

    // The note addresses the visitor, never the owner, and carries no times.
    expect(contact.hoursNote).not.toMatch(/[0-9]/);
    expect(contact.hoursNote.toLowerCase()).not.toContain("to be added");
  });
});
