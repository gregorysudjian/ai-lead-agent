import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DemoLayout, DemoSiteBusiness, DemoSiteSpec } from "@/lib/demo-site";
import { DEMO_LAYOUT_LABELS } from "@/lib/demo-site";

import { DemoSiteView } from "./demo-site-view";
import { iconForService } from "./icons";

/**
 * The complaint this answers: every generated site looked the same.
 *
 * A theme changed the colours, but the arrangement was identical on every
 * page, so a portfolio of demos read as one template with the names swapped.
 * `content.layout` now selects one of four whole-page compositions.
 */

const ALL_LAYOUTS = Object.keys(DEMO_LAYOUT_LABELS) as DemoLayout[];

function business(over: Partial<DemoSiteBusiness> = {}): DemoSiteBusiness {
  return {
    name: "Salon Bella",
    category: "Hair salon",
    city: "Montreal",
    phone: "+1 514-555-0100",
    address: "1 Rue Example",
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

function spec(layout: DemoLayout, over: Partial<DemoSiteBusiness> = {}): DemoSiteSpec {
  return {
    business: business(over),
    content: {
      siteTitle: "Salon Bella",
      tagline: "Hair salon in Montreal",
      theme: "calm-minimal",
      layout,
      navigation: [
        { label: "Services", targetSectionId: "services" },
        { label: "About", targetSectionId: "about" },
        { label: "Contact", targetSectionId: "visit" },
      ],
      sections: [
        {
          kind: "hero",
          id: "top",
          sample: true,
          eyebrow: "Hair salon in Montreal",
          heading: "Your next great haircut starts here",
          subheading: "Cuts, colour and care for every kind of hair.",
          primaryCta: { label: "Call us", action: "call" },
          secondaryCta: { label: "Find us", action: "directions" },
        },
        {
          kind: "offering",
          id: "services",
          sample: true,
          heading: "What we do",
          intro: "A full service for hair.",
          items: [
            { title: "Cuts and styling", body: "Precision cuts for every hair type." },
            { title: "Colour", body: "From subtle tones to a full change." },
            { title: "Treatments", body: "Conditioning and repair treatments." },
          ],
        },
        {
          kind: "gallery",
          id: "gallery",
          sample: true,
          heading: "Our work",
          body: "A look inside the salon.",
          placeholders: [{ label: "The salon" }, { label: "Cut and colour" }, { label: "Finished look" }],
        },
        {
          kind: "positioning",
          id: "about",
          sample: true,
          heading: "About the salon",
          body: "Salon Bella is a hair salon in Montreal.",
          points: ["Walk-ins welcome", "Every hair type", "An unhurried hour"],
        },
        {
          kind: "contact",
          id: "visit",
          sample: true,
          heading: "Find us",
          body: "Call to book a time that suits you.",
          hoursNote: "Our usual opening hours.",
        },
        {
          kind: "cta",
          id: "start",
          sample: true,
          heading: "Book your next appointment",
          body: "Give us a call.",
          cta: { label: "Call us", action: "call" },
        },
      ],
      footer: { note: "Hair salon in Montreal." },
    },
  };
}

const render = (layout: DemoLayout, over: Partial<DemoSiteBusiness> = {}) =>
  renderToStaticMarkup(<DemoSiteView spec={spec(layout, over)} />);

describe("every layout renders a complete page", () => {
  for (const layout of ALL_LAYOUTS) {
    it(`${layout} renders every section`, () => {
      const html = render(layout);
      for (const heading of [
        "Your next great haircut starts here",
        "What we do",
        "Our work",
        "About the salon",
        "Find us",
        "Book your next appointment",
      ]) {
        expect(html, `${layout} is missing "${heading}"`).toContain(heading);
      }
    });

    it(`${layout} keeps the business's own facts on the page`, () => {
      const html = render(layout);
      expect(html).toContain("Salon Bella");
      expect(html).toContain("1 Rue Example");
      expect(html).toContain("tel:+15145550100");
    });

    it(`${layout} marks its sample sections`, () => {
      expect(render(layout)).toContain("Sample content");
    });
  }
});

describe("the layouts are actually different", () => {
  it("produces different markup for every layout", () => {
    // The whole point of the field. If two layouts render identically, one of
    // them is not implemented and the variety is imaginary.
    const rendered = new Map(ALL_LAYOUTS.map((layout) => [layout, render(layout)]));
    const seen = new Map<string, DemoLayout>();

    for (const [layout, html] of rendered) {
      const existing = seen.get(html);
      expect(existing, `${layout} renders identically to ${existing}`).toBeUndefined();
      seen.set(html, layout);
    }
  });

  it("gives the layouts visibly different section arrangements", () => {
    // Not just different whitespace: the editorial layout uses ruled list rows
    // and the showcase layout uses a mosaic, so their markup differs in
    // structure rather than only in class strings.
    const editorial = render("editorial");
    const showcase = render("showcase");
    expect(editorial).not.toBe(showcase);
    // Showcase leads its gallery with a double-width tile.
    expect(showcase).toContain("col-span-2 row-span-2");
    expect(editorial).not.toContain("col-span-2 row-span-2");
  });
});

describe("no generated content becomes a link", () => {
  for (const layout of ALL_LAYOUTS) {
    it(`${layout} links only to tel: and in-page anchors`, () => {
      const html = render(layout);
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(
          href.startsWith("#") || href.startsWith("tel:"),
          `${layout} produced an unexpected href: ${href}`,
        ).toBe(true);
      }
    });
  }

  it("renders a published social link, and only that", () => {
    // The one external href allowed: a profile the business links to from its
    // own site, read by research. Never a guessed handle.
    const html = render("classic", { socialLinks: ["https://instagram.com/salonbella"] });
    expect(html).toContain('href="https://instagram.com/salonbella"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("the page never offers an action it cannot complete", () => {
  for (const layout of ALL_LAYOUTS) {
    it(`${layout} has no dead tel: link when no phone was listed`, () => {
      const html = render(layout, { phone: null });
      expect(html).not.toContain("tel:");
      // The nav action falls back to the contact anchor rather than vanishing.
      expect(html).toContain("Get in touch");
    });
  }
});

describe("Tailwind classes are literals, never assembled", () => {
  /**
   * A mistake made while writing these layouts: `sm:grid-cols-${n}`.
   *
   * It type-checks, it reads fine, and it silently produces an unstyled single
   * column, because Tailwind only emits classes it can see spelled out in the
   * source. Nothing else in the pipeline catches it -- the page renders, it
   * just looks broken.
   */
  const FILES = ["demo-site-view.tsx", "theme.ts", "icons.tsx"];

  const ASSEMBLED = /\b(?:grid-cols|gap|text|bg|p[xytblr]?|m[xytblr]?|w|h|rounded|border)-\$\{/;

  for (const file of FILES) {
    it(`${file} assembles no utility class from a variable`, () => {
      const source = readFileSync(
        path.join(process.cwd(), "src", "components", "demo", file),
        "utf8",
      );
      // Comments are stripped first: this rule is discussed in prose in these
      // very files, and a guard that fires on its own documentation is a guard
      // people delete.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      const match = code.match(ASSEMBLED);
      expect(match?.[0], `${file} builds a class name from an expression`).toBeUndefined();
    });
  }
});

describe("iconForService", () => {
  it("matches the specific keyword before the general one", () => {
    // "hot towel shave" must reach razor, not whatever "towel" would hit, and
    // "kids cuts" must reach users rather than scissors.
    expect(iconForService("Hot towel shave")).toBe("razor");
    expect(iconForService("Kids cuts")).toBe("users");
    expect(iconForService("Cuts and styling")).toBe("scissors");
  });

  it("covers the services the sample library actually writes", () => {
    for (const title of [
      "Cuts and styling",
      "Colour",
      "Treatments",
      "Beard trims",
      "Manicures",
      "Our menu",
      "Coffee",
      "Bread",
      "Check-ups",
      "Prescriptions",
      "Membership",
      "Bouquets",
      "Servicing",
      "Delivery",
    ]) {
      expect(iconForService(title), `${title} fell back to the neutral mark`).not.toBe("dot");
    }
  });

  it("falls back to a neutral mark rather than guessing", () => {
    // A wrong picture -- a tooth beside a florist's delivery -- is worse than
    // a plain dot, because it is exactly the detail that says nobody looked.
    expect(iconForService("Something we have never heard of")).toBe("dot");
  });

  it("is case-insensitive and tolerant of surrounding words", () => {
    expect(iconForService("  WEDDING flowers  ")).toBe("heart");
  });
});
