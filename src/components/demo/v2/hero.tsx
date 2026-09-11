import type { CSSProperties } from "react";

import type { DemoDesign } from "@/lib/demo-design/types";
import type { DemoSection, DemoSiteBusiness } from "@/lib/demo-site";

import { Badge, HeroArt } from "./art";
import { Cta, fitGiant, Heading, PhotoSlot, SampleTag } from "./parts";
import type { Words } from "./words";

/**
 * Six hero compositions. The genome picks one per site; each is a different
 * arrangement, not a recolour, because the hero is what decides whether a
 * page reads as designed or as a template.
 *
 * Which element is the page's h1 follows the composition: where the business
 * name is the design (wordmark, poster, monogram) the name is the h1 and the
 * generated heading is its tagline; elsewhere the heading is the h1.
 */

type HeroSection = Extract<DemoSection, { kind: "hero" }>;

export interface HeroProps {
  section: HeroSection;
  sections: DemoSection[];
  business: DemoSiteBusiness;
  design: DemoDesign;
  words: Words;
  brand: string;
  mark: string;
  /** The category in the page's language ("Barbier", not "Barber shop"). */
  trade: string;
}

function Eyebrow({ section, words, className = "" }: { section: HeroSection; words: Words; className?: string }) {
  return (
    <div className={`dx-fade-in flex flex-wrap items-center gap-3 ${className}`}>
      <p className="dx-label dx-accent-text">{section.eyebrow}</p>
      {section.sample ? <SampleTag words={words} /> : null}
    </div>
  );
}

function Actions({ section, sections, business, className = "" }: Pick<HeroProps, "section" | "sections" | "business"> & { className?: string }) {
  return (
    <div className={`dx-fade-in flex flex-wrap items-center gap-3 ${className}`} style={{ "--i": 3 } as CSSProperties}>
      <Cta cta={section.primaryCta} business={business} sections={sections} />
      {section.secondaryCta ? <Cta cta={section.secondaryCta} business={business} sections={sections} ghost /> : null}
    </div>
  );
}

function ScrollHint({ words }: { words: Words }) {
  return (
    <div aria-hidden="true" className="dx-fade-in dx-small dx-muted mt-14 hidden items-center gap-3 sm:flex" style={{ "--i": 5 } as CSSProperties}>
      <span className="relative block h-9 w-5 rounded-full border border-current">
        <span className="dx-float absolute left-1/2 top-2 block h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" />
      </span>
      {words.scroll}
    </div>
  );
}

/** The business name, enormous, across the width. */
function WordmarkHero(props: HeroProps) {
  const { section, design, words, brand } = props;
  return (
    <section id={section.id} className="dx-section relative overflow-hidden" style={{ paddingTop: "clamp(2rem, 6vw, 4rem)" }}>
      <HeroArt motif={design.motif} palette={design.palette} seed={design.seed} className="opacity-70" />
      <div className="dx-shell relative">
        <Eyebrow section={section} words={words} />
        <Heading text={brand} as="h1" emphasis={design.emphasis} animate className="dx-giant dx-hero-exit mt-6 break-words" style={fitGiant(brand, design.displayCase === "upper")} />
        <div className="dx-rule mt-12 grid gap-8 border-t pt-8 lg:grid-cols-12">
          <p className="dx-display dx-h3 dx-fade-in lg:col-span-6" style={{ "--i": 2 } as CSSProperties}>
            {section.heading}
          </p>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="dx-lede dx-muted dx-fade-in" style={{ "--i": 2 } as CSSProperties}>
              {section.subheading}
            </p>
            <Actions {...props} className="mt-8" />
          </div>
        </div>
        <ScrollHint words={words} />
      </div>
    </section>
  );
}

/** Headline and actions beside a tall framed panel, with a name badge. */
function SplitHero(props: HeroProps) {
  const { section, design, words, business, brand, mark, trade } = props;
  return (
    <section id={section.id} className="dx-section relative overflow-hidden" style={{ paddingTop: "clamp(2rem, 5vw, 4rem)" }}>
      <div className="dx-shell grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <Eyebrow section={section} words={words} />
          <Heading text={section.heading} as="h1" emphasis={design.emphasis} animate className="dx-h1 mt-6" />
          <p className="dx-lede dx-muted dx-fade-in mt-7 max-w-xl" style={{ "--i": 2 } as CSSProperties}>
            {section.subheading}
          </p>
          <Actions {...props} className="mt-9" />
        </div>
        <div className="relative lg:col-span-6">
          <div className="dx-unmask dx-zoom overflow-hidden" style={{ borderRadius: "var(--dx-r)" }}>
            <PhotoSlot label={words.photoLabels[0]} design={design} index={0} className="aspect-[4/5] w-full" />
          </div>
          {/* Top-right, clear of the photo label in the bottom-left corner. */}
          <div className="dx-par absolute -top-8 -right-3 sm:-right-8" style={{ "--depth": "70px" } as CSSProperties}>
            <Badge text={`${brand} · ${trade} · ${business.city}`} mark={mark} palette={design.palette} size={150} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** A full-bleed poster: inverted ground, stacked display type, a sticker. */
function PosterHero(props: HeroProps) {
  const { section, design, words, brand, mark, business, trade } = props;
  return (
    <section id={section.id} className="dx-inverted relative overflow-hidden">
      <HeroArt motif={design.motif} palette={{ ...design.palette, accentSoft: design.palette.invertAccent, accentText: design.palette.invertAccent }} seed={design.seed} fieldOpacity={0.12} />
      <div className="dx-shell relative flex min-h-[86vh] flex-col justify-center py-24 text-center">
        <Eyebrow section={section} words={words} className="justify-center" />
        <Heading text={brand} as="h1" emphasis={design.emphasis} animate className="dx-giant dx-hero-exit mx-auto mt-6 max-w-[14ch] break-words" style={fitGiant(brand, design.displayCase === "upper")} />
        <p className="dx-display dx-h3 dx-fade-in mx-auto mt-8 max-w-2xl" style={{ "--i": 2 } as CSSProperties}>
          {section.heading}
        </p>
        <p className="dx-lede dx-muted dx-fade-in mx-auto mt-4 max-w-xl" style={{ "--i": 3 } as CSSProperties}>
          {section.subheading}
        </p>
        <Actions {...props} className="mt-10 justify-center" />
        <div className="dx-par absolute right-4 top-24 hidden md:block" style={{ "--depth": "110px" } as CSSProperties}>
          <Badge text={`${trade} · ${business.city}`} mark={mark} palette={{ ...design.palette, accentText: design.palette.invertAccent }} size={132} />
        </div>
      </div>
    </section>
  );
}

/** A centred medallion: rotating name ring, the name, the promise. */
function MonogramHero(props: HeroProps) {
  const { section, design, words, brand, mark, business } = props;
  return (
    <section id={section.id} className="dx-section relative overflow-hidden text-center" style={{ paddingTop: "clamp(2.5rem, 6vw, 5rem)" }}>
      <HeroArt motif={design.motif} palette={design.palette} seed={design.seed} className="opacity-60" />
      <div className="dx-shell relative flex flex-col items-center">
        <div className="dx-fade-in">
          <Badge text={`${brand} · ${business.city}`} mark={mark} palette={design.palette} size={172} />
        </div>
        <Eyebrow section={section} words={words} className="mt-10 justify-center" />
        <Heading text={brand} as="h1" emphasis={design.emphasis} animate className="dx-h1 mt-5 max-w-4xl break-words" />
        <p className="dx-display dx-h3 dx-fade-in mt-7 max-w-2xl" style={{ "--i": 2 } as CSSProperties}>
          {section.heading}
        </p>
        <p className="dx-lede dx-muted dx-fade-in mt-4 max-w-xl" style={{ "--i": 3 } as CSSProperties}>
          {section.subheading}
        </p>
        <Actions {...props} className="mt-10 justify-center" />
        <ScrollHint words={words} />
      </div>
    </section>
  );
}

/** Magazine layout: an index column, a huge headline, a wide parallax panel. */
function EditorialHero(props: HeroProps) {
  const { section, design, words, business, brand } = props;
  return (
    <section id={section.id} className="dx-section relative overflow-hidden" style={{ paddingTop: "clamp(2rem, 5vw, 4rem)" }}>
      <div className="dx-shell">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Eyebrow section={section} words={words} />
            <p className="dx-small dx-muted dx-fade-in mt-6 max-w-[16rem]" style={{ "--i": 1 } as CSSProperties}>
              {brand} — {business.city}
            </p>
          </div>
          <div className="lg:col-span-9">
            <Heading text={section.heading} as="h1" emphasis={design.emphasis} animate className="dx-h1" />
            <div className="dx-rule mt-10 grid gap-8 border-t pt-8 md:grid-cols-2">
              <p className="dx-lede dx-muted dx-fade-in" style={{ "--i": 2 } as CSSProperties}>
                {section.subheading}
              </p>
              <Actions {...props} className="md:justify-end" />
            </div>
          </div>
        </div>
        <div className="dx-unmask mt-16 overflow-hidden" style={{ borderRadius: "var(--dx-r)" }}>
          <div className="dx-par" style={{ "--depth": "-40px" } as CSSProperties}>
            <PhotoSlot label={words.photoLabels[1]} design={design} index={1} className="aspect-[16/7] w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Layered panels: a coloured card with the promise, overlapping a frame. */
function StackHero(props: HeroProps) {
  const { section, design, words, brand, business, sections, trade } = props;
  return (
    <section id={section.id} className="dx-section relative overflow-hidden" style={{ paddingTop: "clamp(2rem, 5vw, 4rem)" }}>
      <div className="dx-shell relative grid gap-6 lg:grid-cols-12">
        <div
          // An explicit column start, not just a span: an auto-placed item
          // never overlaps an explicitly placed one, so without it this card
          // was pushed into implicit columns past the twelfth.
          className="dx-fade-in relative z-10 p-8 sm:p-12 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:mt-16"
          style={{ background: "var(--dx-accent)", color: "var(--dx-on-accent)", borderRadius: "var(--dx-r)" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="dx-label">{section.eyebrow}</p>
            {section.sample ? <SampleTag words={words} /> : null}
          </div>
          <Heading text={section.heading} as="h1" emphasis={design.emphasis === "outline" ? "italic" : design.emphasis === "accent" ? "none" : design.emphasis} animate className="dx-h1 mt-6" />
          <p className="dx-lede mt-6 max-w-xl opacity-90">{section.subheading}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Cta cta={section.primaryCta} business={business} sections={sections} className="!bg-[var(--dx-on-accent)] !text-[var(--dx-accent)]" />
            {section.secondaryCta ? <Cta cta={section.secondaryCta} business={business} sections={sections} ghost /> : null}
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7 lg:row-start-1">
          <div className="dx-par" style={{ "--depth": "60px" } as CSSProperties}>
            <PhotoSlot label={words.photoLabels[0]} design={design} index={2} className="aspect-[4/5] w-full" labelEnd />
          </div>
        </div>
        <div className="dx-card dx-par dx-fade-in relative z-20 max-w-xs p-5 lg:col-span-4 lg:col-start-9 lg:-mt-24" style={{ "--depth": "120px", "--i": 4 } as CSSProperties}>
          <p className="dx-display text-2xl leading-tight">{brand}</p>
          <p className="dx-small dx-muted mt-1">
            {trade} · {business.city}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Hero(props: HeroProps) {
  switch (props.design.hero) {
    case "wordmark":
      return <WordmarkHero {...props} />;
    case "split":
      return <SplitHero {...props} />;
    case "poster":
      return <PosterHero {...props} />;
    case "monogram":
      return <MonogramHero {...props} />;
    case "editorial":
      return <EditorialHero {...props} />;
    case "stack":
      return <StackHero {...props} />;
  }
}
