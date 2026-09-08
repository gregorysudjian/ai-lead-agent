/**
 * Rendering safety for demo sites.
 *
 * These tests render the real component with `renderToStaticMarkup` and inspect
 * the HTML that comes out. That is the honest way to assert "generated content
 * can never become executable markup": not by reading the source and hoping,
 * but by feeding hostile strings through the actual renderer.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DemoSiteSpec, DemoTheme } from "@/lib/demo-site";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";

import { DemoSiteView, telHref } from "./demo-site-view";

/** A string that would execute or navigate if it were ever treated as markup. */
const XSS = `<script>alert(1)</script><img src=x onerror="alert(2)">`;
const JS_URL = "javascript:alert(3)";

const spec = (over: {
  business?: Partial<DemoSiteSpec["business"]>;
  theme?: DemoTheme;
  hostile?: boolean;
} = {}): DemoSiteSpec => {
  const text = over.hostile ? XSS : "Plain copy";
  return {
    business: {
      name: over.hostile ? XSS : "Salon Test",
      category: "Hair salon",
      city: "Montreal",
      phone: "+1 514 555 0100",
      address: "100 Rue Test",
      websiteListed: false,
      source: "osm",
      snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    socialLinks: [],
    openingHours: [],
    bookingUrl: null,
    ownDescription: null,
    profileSourced: false,
      ...over.business,
    },
    content: {
      siteTitle: text,
      tagline: text,
      theme: over.theme ?? "calm-minimal",
      navigation: [{ label: text, targetSectionId: "services" }],
      sections: [
        {
          kind: "hero",
          id: "top",
          sample: false,
          eyebrow: text,
          heading: text,
          subheading: text,
          primaryCta: { label: text, action: "call" },
          secondaryCta: { label: text, action: "directions" },
        },
        {
          kind: "offering",
          id: "services",
          sample: false,
          heading: text,
          intro: text,
          items: [{ title: text, body: text }],
        },
        {
          kind: "positioning",
          id: "about",
          sample: false,
          heading: text,
          body: text,
          points: [text],
        },
        {
          kind: "gallery",
          id: "work",
          sample: false,
          heading: text,
          body: text,
          placeholders: [{ label: text }],
        },
        {
          kind: "contact",
          id: "visit",
          sample: false,
          heading: text,
          body: text,
          hoursNote: text,
        },
        {
          kind: "cta",
          id: "start",
          sample: false,
          heading: text,
          body: text,
          cta: { label: text, action: "scroll", targetSectionId: "visit" },
        },
      ],
      footer: { note: text },
    },
  };
};

const render = (s: DemoSiteSpec) => renderToStaticMarkup(<DemoSiteView spec={s} />);

describe("untrusted strings render as text, never as markup", () => {
  const html = render(spec({ hostile: true }));

  it("escapes generated content so no script element is produced", () => {
    // The literal text appears (escaped); an actual <script> element does not.
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<script ");
  });

  it("escapes an injected img so no real onerror attribute is emitted", () => {
    // The payload survives as visible text (`onerror=&quot;`), which is the
    // point -- what must not exist is a genuine attribute with a real quote.
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("<img");
  });

  it("escapes a hostile business name copied from provider data", () => {
    // The name comes from spec.business -- application-owned, but still
    // provider text, and OpenStreetMap is publicly editable.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("emits no inline event handler attribute of any kind", () => {
    for (const attr of ["onclick=", "onload=", "onmouseover=", "onfocus="]) {
      expect(html.toLowerCase()).not.toContain(attr);
    }
  });

  it("emits no inline stylesheet and no style attribute", () => {
    expect(html).not.toContain("<style");
    expect(html).not.toContain(" style=");
  });
});

describe("links are constructed by the application, never by the generator", () => {
  it("emits only tel: and in-page fragment hrefs", () => {
    const html = render(spec({ hostile: true }));
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("tel:") || href.startsWith("#")).toBe(true);
    }
  });

  it("never emits a javascript: URL even when one is supplied as copy", () => {
    const hostile = spec();
    hostile.content.sections[0] = {
      kind: "hero",
      id: "top",
      sample: false,
      eyebrow: JS_URL,
      heading: JS_URL,
      subheading: JS_URL,
      primaryCta: { label: JS_URL, action: "scroll", targetSectionId: "visit" },
      secondaryCta: null,
    };

    const html = render(hostile);
    // It appears as visible text only. There is no field it could reach an
    // href from, so no href carries it.
    expect(html).toContain(JS_URL);
    expect(html).not.toContain(`href="${JS_URL}"`);
  });

  it("builds tel: from the stored number, stripping everything but digits", () => {
    const html = render(spec({ business: { phone: "+1 (514) 555-0100 ext. 2" } }));
    expect(html).toContain('href="tel:+15145550100');
  });

  it("rejects a phone value too short to be a number", () => {
    expect(telHref("n/a")).toBeNull();
    expect(telHref("12")).toBeNull();
  });

  it("keeps a phone-shaped value out of an href when it is unusable", () => {
    const html = render(spec({ business: { phone: "call us" } }));
    expect(html).not.toContain('href="tel:');
    // The raw value is still shown as text -- we do not silently drop data.
    expect(html).toContain("call us");
  });
});

describe("the demo states only what the lead recorded", () => {
  it("renders the business name, phone and address from spec.business", () => {
    const html = render(spec());
    expect(html).toContain("Salon Test");
    expect(html).toContain("+1 514 555 0100");
    expect(html).toContain("100 Rue Test");
  });

  it("shows an empty slot rather than inventing a missing phone or address", () => {
    const html = render(spec({ business: { phone: null, address: null } }));
    expect(html).toContain("To be added");
    expect(html).not.toContain('href="tel:');
    // Our internal vocabulary about a provider record has no place on a page
    // meant to read as the business's own site.
    expect(html).not.toContain("Not listed");
  });

  it("renders every theme without falling back or throwing", () => {
    for (const theme of Object.keys(DEMO_THEME_LABELS) as DemoTheme[]) {
      expect(() => render(spec({ theme }))).not.toThrow();
    }
  });
});

describe("no rendering path can inject markup", () => {
  const DEMO_SOURCES = ["src/components/demo", "src/app/demos"];

  function sourceFiles(dir: string): string[] {
    const entries = readdirSync(join(process.cwd(), dir), { withFileTypes: true });
    return entries.flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      // Test files are excluded: this very file names the API in order to
      // forbid it, and scanning itself would always fail.
      if (entry.name.includes(".test.")) return [];
      return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts") ? [path] : [];
    });
  }

  it("sets raw inner HTML nowhere in the demo code", () => {
    for (const dir of DEMO_SOURCES) {
      for (const file of sourceFiles(dir)) {
        const source = readFileSync(join(process.cwd(), file), "utf8");
        // The JSX prop form, so prose in a comment explaining why we do not
        // use it does not trip the check.
        expect(source, `${file} must not set inner HTML`).not.toContain(
          "dangerouslySetInner" + "HTML=",
        );
      }
    }
  });
});
