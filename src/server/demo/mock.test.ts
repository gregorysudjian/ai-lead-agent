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

  it("shows a booking layout without claiming a booking system exists", async () => {
    const content = await mockDemoSiteProvider.generate(
      input({ recommendedSiteType: "booking-focused-site" }),
    );

    // The layout proposes appointments; nobody told us the business takes
    // them, so no label, heading or body may say that it does.
    const offering = content.sections.find((s) => s.kind === "offering");
    if (offering?.kind !== "offering") throw new Error("unreachable");
    const appointments = offering.items.find((i) => i.title === "Appointments");
    expect(appointments?.body).toBe("To be added.");

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
    expect(contact.hoursNote).toBe("Opening hours to be added.");
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

    // Hours are never invented, and the note is a plain placeholder rather
    // than an instruction aimed at the owner.
    expect(contact.hoursNote).toBe("Opening hours to be added.");
    expect(contact.hoursNote.toLowerCase()).not.toContain("you");
  });
});

describe("the copy asserts nothing we cannot evidence", () => {
  /**
   * A business we know almost nothing about: a name, a category and a city,
   * with no phone, no address, no website and no reputation data. Whatever the
   * generator writes for this input is, by definition, everything it is
   * willing to say without evidence.
   */
  const bare = (over: Partial<DemoSiteGeneratorInput> = {}) =>
    input({
      businessName: "Nordvik",
      category: "Bakery",
      city: "Oslo",
      phoneListed: false,
      addressListed: false,
      websiteListed: false,
      ...over,
    });

  /**
   * Claims about the business that no stored fact supports.
   *
   * The first block is the wording this test was written to remove; the rest
   * are the equivalents it would be easy to reach for next.
   */
  const UNSUPPORTED = [
    // Previously present, verbatim.
    "careful work",
    "a straight answer",
    "no surprises",
    "do the work properly",
    "plain answers",
    "no runaround",
    "respects your time",
    "one call is all it takes",
    "easy to reach",
    "easy to get to",
    "happy to help",
    "take it from there",
    "with no guesswork",
    "closed door",
    "suits you",
    "finished lately",
    "everything you need",
    "serving ",
    // Equivalents it would be easy to reach for next.
    "quality",
    "professional",
    "reliable",
    "trusted",
    "honest",
    "friendly",
    "welcoming",
    "fast",
    "quick",
    "convenient",
    "affordable",
    "value for money",
    "best",
    "leading",
    "expert",
    "experienced",
    "specialist",
    "specialise",
    "specialize",
    "guarantee",
    "we promise",
    "years of",
    "award",
    "popular",
    "regulars",
    "satisfied",
    "satisfaction",
    "highly rated",
    "well known",
    "always",
    "surrounding areas",
    "service area",
    "we serve",
  ];

  /** Everything the generator wrote, as one lowercase blob. */
  const copy = (content: Awaited<ReturnType<typeof mockDemoSiteProvider.generate>>) =>
    JSON.stringify(content).toLowerCase();

  it("makes no unsupported claim, for any layout or combination of facts", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      for (const phoneListed of [true, false]) {
        for (const addressListed of [true, false]) {
          const text = copy(
            await mockDemoSiteProvider.generate(
              bare({ recommendedSiteType: siteType, phoneListed, addressListed }),
            ),
          );
          for (const claim of UNSUPPORTED) {
            expect(text, `${siteType} must not claim "${claim.trim()}"`).not.toContain(claim);
          }
        }
      }
    }
  });

  it("says nothing about a minimal business beyond its name, category and city", async () => {
    const content = await mockDemoSiteProvider.generate(bare());

    // Every word the generator produced, minus the three facts it holds, the
    // JSON field names, and a small vocabulary of neutral connectives and
    // invitations. Anything left over would be a claim smuggled in as prose.
    const ALLOWED = new Set([
      "",
      // The facts.
      "nordvik",
      "bakery",
      "oslo",
      // Neutral structure, invitations and empty-slot markers.
      "a", "about", "action", "added", "address", "and", "appointments", "be", "below",
      "body", "call", "come", "contact", "cta", "details", "do", "eyebrow", "find",
      "footer", "gallery", "get", "give", "heading", "hero", "hours", "hoursnote", "how",
      "id", "image", "images", "in", "intro", "is", "items", "kind", "label", "menu",
      "navigation", "note", "offering", "opening", "or", "our", "phone", "placeholders",
      "points", "positioning", "primarycta", "scroll", "secondarycta", "sections", "see",
      "services", "sitetitle", "start", "subheading", "tagline", "targetsectionid",
      "theme", "title", "to", "top", "touch", "us", "visit", "we", "what", "where",
      "work", "number", "directions",
      // Theme names, which are enum values rather than prose.
      "calm", "minimal", "warm", "classic", "fresh", "modern", "bold", "contrast",
      "elegant", "dark",
    ]);

    const used = new Set(JSON.stringify(content).toLowerCase().split(/[^a-z]+/));
    const unexpected = [...used].filter((w) => !ALLOWED.has(w));
    expect(unexpected, "unexpected vocabulary in a minimal-facts demo").toEqual([]);
  });

  it("does not turn a listed address into a claim about serving the city", async () => {
    const text = copy(await mockDemoSiteProvider.generate(bare({ addressListed: true })));

    for (const phrase of [
      "serving",
      "we serve",
      "service area",
      "surrounding",
      "across oslo",
      "all of oslo",
      "throughout",
    ]) {
      expect(text).not.toContain(phrase);
    }
    // What a listed address does support: that there is one, in that city.
    expect(text).toContain("find nordvik in oslo");
  });

  it("invents no opening hours when none are known", async () => {
    for (const siteType of HANDLED_SITE_TYPES) {
      const content = await mockDemoSiteProvider.generate(bare({ recommendedSiteType: siteType }));
      const text = copy(content);

      for (const day of ["monday", "tuesday", "saturday", "sunday", "weekday", "weekend", "daily"]) {
        expect(text).not.toContain(day);
      }
      const words = text.split(/[^a-z0-9]+/);
      for (const time of ["am", "pm", "late", "early"]) {
        expect(words).not.toContain(time);
      }

      const contact = content.sections.find((s) => s.kind === "contact");
      if (contact?.kind !== "contact") throw new Error("unreachable");
      expect(contact.hoursNote).toBe("Opening hours to be added.");
    }
  });

  it("does not assert completed or recent work in a portfolio layout", async () => {
    const content = await mockDemoSiteProvider.generate(
      bare({ recommendedSiteType: "portfolio-site" }),
    );
    const gallery = content.sections.find((s) => s.kind === "gallery");
    if (gallery?.kind !== "gallery") throw new Error("unreachable");

    // Empty, numbered slots: the layout is visible, the content plainly absent.
    expect(gallery.heading).toBe("Gallery");
    expect(gallery.body).toBe("Images to be added.");
    for (const placeholder of gallery.placeholders) {
      expect(placeholder.label).toMatch(/^Image [0-9]+$/);
    }

    const text = copy(content);
    for (const claim of [
      "recent work",
      "our work",
      "completed",
      "projects",
      "portfolio of",
      "premises",
      "we have done",
      "in progress",
    ]) {
      expect(text).not.toContain(claim);
    }
  });

  it("does not assert a known menu or catalogue in a menu layout", async () => {
    const content = await mockDemoSiteProvider.generate(
      bare({ recommendedSiteType: "menu-and-location-site" }),
    );
    const offering = content.sections.find((s) => s.kind === "offering");
    if (offering?.kind !== "offering") throw new Error("unreachable");

    const menu = offering.items.find((i) => i.title === "Menu");
    expect(menu?.body).toBe("To be added.");

    const text = copy(content);
    for (const claim of ["our menu", "full list", "everything we", "dishes", "we serve", "freshly"]) {
      expect(text).not.toContain(claim);
    }
  });

  it("invites no contact route it cannot back with a listed value", async () => {
    const none = copy(await mockDemoSiteProvider.generate(bare()));
    expect(none).not.toContain("call us");
    expect(none).not.toContain("give us a call");
    expect(none).not.toContain("come and see us");
    expect(none).toContain("to be added");

    const phoneOnly = copy(await mockDemoSiteProvider.generate(bare({ phoneListed: true })));
    expect(phoneOnly).toContain("call us");
    expect(phoneOnly).not.toContain("come and find us");

    const addressOnly = copy(await mockDemoSiteProvider.generate(bare({ addressListed: true })));
    expect(addressOnly).toContain("come and find us");
    expect(addressOnly).not.toContain("call us");
  });
});
