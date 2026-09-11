/**
 * The new-generation renderer, rendered for real.
 *
 * Every assertion here runs over MANY designs -- a sweep of businesses and
 * variants that between them reach every hero, every section treatment and
 * every direction -- because a renderer with sixty-odd combinations breaks in
 * the combination nobody looked at.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { designFor } from "@/lib/demo-design/genome";
import { ABOUT_VARIANTS, CONTACT_VARIANTS, CTA_VARIANTS, GALLERY_VARIANTS, HERO_VARIANTS, SERVICES_VARIANTS } from "@/lib/demo-design/types";
import type { DemoDesign } from "@/lib/demo-design/types";
import { enforceSampleFlags } from "@/lib/demo-sample-policy";
import type { DemoSiteBusiness, DemoSiteContent, DemoSiteGeneratorInput } from "@/lib/demo-site";
import { mockDemoSiteProvider } from "@/server/demo/mock";

import { DemoSiteV2 } from "./site";
import { WORDS, type Locale } from "./words";

/** How React writes text into markup, for comparing against rendered HTML. */
const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const XSS = `<script>alert(1)</script><img src=x onerror="alert(2)">`;

const CATEGORIES = ["Hair salon", "Barber shop", "Beauty salon", "Nail salon", "Tattoo & piercing", "Spa"];
const NAMES = ["Salon Lumière", "Chez Nadia Coiffure", "Barbier Rosemont", "Studio 88", "L'Atelier des Ongles", "Maison Verte — Soins"];

function business(name: string, category: string, over: Partial<DemoSiteBusiness> = {}): DemoSiteBusiness {
  return {
    name,
    category,
    city: "Montréal",
    phone: "+1 514 555 0100",
    address: "100 Rue Test",
    websiteListed: false,
    source: "overture",
    snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    socialLinks: [],
    openingHours: [],
    bookingUrl: null,
    ownDescription: null,
    profileSourced: false,
    ...over,
  };
}

function input(b: DemoSiteBusiness): DemoSiteGeneratorInput {
  return {
    businessName: b.name,
    category: b.category,
    city: b.city,
    phoneListed: b.phone !== null,
    addressListed: b.address !== null,
    websiteListed: false,
    socialLinksListed: false,
    openingHoursListed: false,
    bookingUrlListed: false,
    recommendedSiteType: "booking-focused-site",
    recommendedPages: ["Home", "Services", "Contact"],
    homepageSections: ["Intro", "Services", "Contact"],
    keySellingPoints: ["Easy to find"],
    callsToAction: ["Call the shop"],
    designDirection: { tone: "Warm", palette: "Neutral", imagery: "Premises", typography: "Sans" },
    draftPositioning: "A local business, easy to contact.",
    businessSummary: "Listed locally.",
  };
}

async function contentFor(b: DemoSiteBusiness): Promise<DemoSiteContent> {
  return enforceSampleFlags(await mockDemoSiteProvider.generate(input(b)), b);
}

function render(b: DemoSiteBusiness, content: DemoSiteContent, design: DemoDesign, locale: Locale = "fr"): string {
  return renderToStaticMarkup(<DemoSiteV2 business={b} content={content} design={design} locale={locale} langHref="/x?lang=en" />);
}

/** Every (business, variant) pair in the sweep, rendered once. */
async function sweep() {
  const out: { b: DemoSiteBusiness; content: DemoSiteContent; design: DemoDesign; html: string }[] = [];
  for (const [i, category] of CATEGORIES.entries()) {
    for (const name of NAMES) {
      const b = business(name, category, i % 2 === 0 ? {} : { phone: null });
      const content = await contentFor(b);
      for (let variant = 0; variant < 6; variant += 1) {
        const design = designFor({ name, category, address: b.address }, variant);
        out.push({ b, content, design, html: render(b, content, design) });
      }
    }
  }
  return out;
}

describe("DemoSiteV2", async () => {
  const pages = await sweep();

  it("the sweep reaches every hero and every section treatment", () => {
    const seen = (pick: (d: DemoDesign) => string) => new Set(pages.map((p) => pick(p.design)));
    expect(seen((d) => d.hero)).toEqual(new Set(HERO_VARIANTS));
    expect(seen((d) => d.services)).toEqual(new Set(SERVICES_VARIANTS));
    expect(seen((d) => d.about)).toEqual(new Set(ABOUT_VARIANTS));
    expect(seen((d) => d.gallery)).toEqual(new Set(GALLERY_VARIANTS));
    expect(seen((d) => d.contact)).toEqual(new Set(CONTACT_VARIANTS));
    expect(seen((d) => d.cta)).toEqual(new Set(CTA_VARIANTS));
  });

  it("has exactly one h1 on every page", () => {
    for (const { html, design } of pages) {
      expect(html.match(/<h1[\s>]/g)?.length, `${design.hero}`).toBe(1);
    }
  });

  it("never leaks a JavaScript value into the page", () => {
    for (const { html } of pages) {
      expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });

  it("never repeats an id", () => {
    for (const { html, design } of pages) {
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(repeated, `${design.hero}/${design.services}/${design.about}/${design.gallery}`).toEqual([]);
    }
  });

  it("tags sample content visibly whenever a section is sample", () => {
    for (const { html, content } of pages) {
      if (content.sections.some((s) => s.sample)) expect(html).toContain(escapeHtml(WORDS.fr.sample));
    }
  });

  it("dials the stored number, and offers no call link when none is listed", () => {
    for (const { html, b } of pages) {
      if (b.phone) expect(html).toContain('href="tel:');
      else expect(html).not.toContain("tel:");
    }
  });

  it("opens in French and switches through a plain link", () => {
    const { html } = pages[0];
    expect(html).toMatch(/<div[^>]*class="dx [^"]*"[^>]*lang="fr"|lang="fr"[^>]*class="dx /);
    expect(html).toContain('href="/x?lang=en"');
    expect(html).toContain(WORDS.fr.credit.overture);
  });

  it("draws the load curtain only on designs with some energy, hidden from assistive tech", () => {
    for (const { html, design } of pages) {
      const curtain = html.match(/<div class="dx-intro"[^>]*>/);
      if (design.motion === "calm") expect(curtain).toBeNull();
      else expect(curtain?.[0]).toContain('aria-hidden="true"');
    }
    expect(pages.some((p) => p.design.motion === "calm")).toBe(true);
    expect(pages.some((p) => p.design.motion !== "calm")).toBe(true);
  });

  it("colours reach the page only as custom properties from the genome", () => {
    for (const { html, design } of pages.slice(0, 12)) {
      expect(html).toContain(`--dx-bg:${design.palette.bg}`);
      expect(html).toContain(`--dx-accent:${design.palette.accent}`);
    }
  });

  it("renders hostile business data as text, never markup", async () => {
    const b = business(XSS, "Hair salon");
    const content = await contentFor(b);
    for (let variant = 0; variant < 12; variant += 1) {
      const html = render(b, content, designFor({ name: XSS, category: "Hair salon", address: null }, variant));
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img src=x");
    }
  });
});

describe("service icons in both languages", () => {
  it("gives a French service title the icon its English twin gets", async () => {
    const { POOLS_EN } = await import("@/lib/demo-samples-en");
    const { POOLS_FR } = await import("@/lib/demo-samples-fr");
    const { iconForService } = await import("../icons");
    for (const key of Object.keys(POOLS_EN)) {
      POOLS_EN[key].services.forEach((service, i) => {
        const french = POOLS_FR[key].services[i];
        expect(iconForService(french.title), `${key}: "${french.title}" vs "${service.title}"`).toBe(iconForService(service.title));
      });
    }
  });
});

describe("French typography survives rendering", () => {
  it("keeps the non-breaking space before a question mark inside one word", async () => {
    const { Heading } = await import("./parts");
    const html = renderToStaticMarkup(<Heading text={"Envie de changement\u00a0?"} emphasis="none" />);
    // Three words, the last carrying its question mark -- never a fourth "?" word.
    expect(html.match(/<span>/g)?.length).toBe(6);
    expect(html).toContain("changement\u00a0?");
  });
});
