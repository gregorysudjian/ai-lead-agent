import type { CSSProperties } from "react";

import { brandName, monogram } from "@/lib/demo-design/brand";
import { categoryLabel } from "@/lib/demo-samples";
import type { DemoDesign } from "@/lib/demo-design/types";
import type { DemoSiteBusiness, DemoSiteContent } from "@/lib/demo-site";

import { Footer, Nav } from "./chrome";
import { bodyFontVar, displayFontVar, V2_FONT_VARIABLES } from "./fonts";
import { Hero } from "./hero";
import { MotionIsland } from "./motion";
import { About, Closing, Contact, Gallery, Marquee, Services } from "./sections";
import { WORDS, type Locale } from "./words";

import "./site.css";

/**
 * A new-generation demo site: a stored design genome, rendered.
 *
 * A Server Component, like the renderer before it. The only client code is the
 * motion island at the bottom, and the page is complete without it.
 *
 * The genome arrives validated, so every value here is a closed-set name or a
 * `#rrggbb` colour. Colours reach the page as CSS custom properties on the
 * root and nowhere else; fonts as references to self-hosted families.
 *
 * `content` is the copy in the language being shown. Facts come only from
 * `business`, exactly as before.
 */
export interface DemoSiteV2Props {
  business: DemoSiteBusiness;
  content: DemoSiteContent;
  design: DemoDesign;
  locale: Locale;
  /** This page in the other language, or null to hide the switch. */
  langHref: string | null;
}

export function DemoSiteV2({ business, content, design, locale, langHref }: DemoSiteV2Props) {
  const words = WORDS[locale];
  const brand = brandName(business.name);
  const mark = monogram(business.name);
  const trade = categoryLabel(business.category, locale);
  const p = design.palette;

  const vars = {
    "--dx-bg": p.bg,
    "--dx-bg-alt": p.bgAlt,
    "--dx-surface": p.surface,
    "--dx-ink": p.ink,
    "--dx-muted": p.muted,
    "--dx-line": p.line,
    "--dx-accent": p.accent,
    "--dx-on-accent": p.onAccent,
    "--dx-accent-text": p.accentText,
    "--dx-accent-soft": p.accentSoft,
    "--dx-invert": p.invert,
    "--dx-on-invert": p.onInvert,
    "--dx-invert-muted": p.invertMuted,
    "--dx-invert-accent": p.invertAccent,
    "--dx-display": displayFontVar(design.fonts.display),
    "--dx-body": bodyFontVar(design.fonts.body),
  } as CSSProperties;

  const sections = content.sections;
  const offering = sections.find((s) => s.kind === "offering");
  const marqueeItems =
    design.marquee && offering && offering.kind === "offering"
      ? [...offering.items.map((item) => item.title), trade, business.city]
      : [];

  const chrome = { content, business, design, words, brand, langHref, otherLocale: locale === "fr" ? "en" : "fr" };
  // Number the labelled sections from 1 after the hero, and alternate grounds
  // for rhythm; the contact "board" and the closings bring their own ground.
  const numbered = sections.filter((s) => s.kind !== "hero" && s.kind !== "cta").map((s) => s.id);
  const labelOf = (id: string) => numbered.indexOf(id) + 1;
  const band = (id: string) => (labelOf(id) % 2 === 1 ? "dx-band" : "");

  return (
    <div
      className={`dx ${V2_FONT_VARIABLES}`}
      lang={locale}
      data-direction={design.direction}
      data-ground={design.ground}
      data-radius={design.radius}
      data-motion={design.motion}
      data-case={design.displayCase}
      style={vars}
    >
      <div className="dx-progress" aria-hidden="true" />
      <div className="dx-grain" aria-hidden="true" />
      {/* A one-second curtain with the business's mark, lifted on load. CSS
          only, never blocks a click, absent under reduced motion -- and
          absent on calm designs, where a curtain is the wrong temperament. */}
      {design.motion !== "calm" ? (
        <div className="dx-intro" aria-hidden="true">
          <span className="dx-display dx-intro-mark">{mark}</span>
        </div>
      ) : null}

      <Nav {...chrome} />

      <main>
        {sections.map((section) => {
          switch (section.kind) {
            case "hero":
              return (
                <div key={section.id}>
                  <Hero section={section} sections={sections} business={business} design={design} words={words} brand={brand} mark={mark} trade={trade} />
                  {marqueeItems.length > 0 ? <Marquee items={marqueeItems} design={design} /> : null}
                </div>
              );
            case "offering":
              return <Services key={section.id} section={section} design={design} words={words} index={labelOf(section.id)} className={band(section.id)} />;
            case "positioning":
              return (
                <About key={section.id} section={section} design={design} words={words} index={labelOf(section.id)} business={business} brand={brand} mark={mark} className={band(section.id)} />
              );
            case "gallery":
              return <Gallery key={section.id} section={section} design={design} words={words} index={labelOf(section.id)} className={band(section.id)} />;
            case "contact":
              return (
                <Contact key={section.id} section={section} design={design} words={words} index={labelOf(section.id)} business={business} locale={locale} className={design.contact === "board" ? "" : band(section.id)} />
              );
            case "cta":
              return <Closing key={section.id} section={section} sections={sections} design={design} words={words} business={business} />;
          }
        })}
      </main>

      <Footer {...chrome} />
      <MotionIsland />
    </div>
  );
}
