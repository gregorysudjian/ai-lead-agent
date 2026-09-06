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
    expect(mockDemoSiteProvider.model).toBe("deterministic-demo-rules-v1");
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

  it("gives a booking-focused site a booking-shaped primary action", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "booking-focused-site" }),
    );
    const hero = content.sections[0];
    expect(hero.kind).toBe("hero");
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.primaryCta.label.toLowerCase()).toContain("book");
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

  it("says plainly that nothing was listed when nothing was", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ phoneListed: false, addressListed: false }),
    );
    const contact = content.sections.find((s) => s.kind === "contact");
    if (contact?.kind !== "contact") throw new Error("unreachable");
    expect(contact.body.toLowerCase()).toContain("nothing was listed");
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
        // keySellingPoints pass through from the analysis, so exclude them:
        // this test is about what the GENERATOR writes.
        const withoutPassthrough = {
          ...content,
          sections: content.sections.map((s) =>
            s.kind === "positioning" ? { ...s, points: [], body: "" } : s,
          ),
        };
        const text = JSON.stringify(withoutPassthrough).toLowerCase();
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
    expect(contact.hoursNote.toLowerCase()).toContain("confirm");
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

describe("design direction maps to our own themes, never to arbitrary styling", () => {
  const base = input();

  it("resolves recognised moods deterministically", () => {
    expect(themeFor({ ...base, designDirection: { ...base.designDirection, tone: "warm" } })).toBe(
      "warm-classic",
    );
    expect(
      themeFor({ ...base, designDirection: { ...base.designDirection, tone: "elegant dark" } }),
    ).toBe("elegant-dark");
    expect(
      themeFor({ ...base, designDirection: { ...base.designDirection, tone: "bold", palette: "" } }),
    ).toBe("bold-contrast");
  });

  it("falls back to a site-type default when the mood is unrecognised", () => {
    const blank = {
      ...base,
      designDirection: { tone: "x", palette: "y", imagery: "z", typography: "w" },
    };
    expect(themeFor({ ...blank, recommendedSiteType: "booking-focused-site" })).toBe("fresh-modern");
    expect(themeFor({ ...blank, recommendedSiteType: "menu-and-location-site" })).toBe("warm-classic");
    expect(themeFor({ ...blank, recommendedSiteType: "one-page-site" })).toBe("calm-minimal");
  });

  it("only ever returns a theme we defined", () => {
    const hostile = {
      ...base,
      designDirection: {
        tone: "background:red;color:#fff",
        palette: "<style>body{display:none}</style>",
        imagery: "javascript:alert(1)",
        typography: "font-family: Comic Sans",
      },
    };
    expect(themeFor(hostile) in DEMO_THEME_LABELS).toBe(true);
  });
});
