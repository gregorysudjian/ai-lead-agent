import type { CSSProperties } from "react";

import type { DemoDesign } from "@/lib/demo-design/types";
import { sampleHoursFor } from "@/lib/demo-samples";
import type { DemoSection, DemoSiteBusiness } from "@/lib/demo-site";
import { classifyWebsite } from "@/lib/format";
import { formatPhone, phoneHref } from "@/lib/phone";

import { Icon, iconForService } from "../icons";
import { Badge, MarkDivider, TileArt } from "./art";
import { Cta, fitGiant, Heading, PhotoSlot, SampleTag, SectionLabel } from "./parts";
import { localizeScheduleLine, type Locale, type Words } from "./words";

/**
 * Every section after the hero, each with the treatments the genome can pick.
 *
 * Facts -- phone, address, hours, social links -- are read from
 * `spec.business` here, by the renderer, and never from generated copy. Hours
 * are the business's own when held, otherwise the trade's sample schedule,
 * visibly tagged. A customer-facing page lists only the days it holds and
 * never fills the rest in as closed (CLAUDE.md).
 */

type Section<K extends DemoSection["kind"]> = Extract<DemoSection, { kind: K }>;

interface Base {
  design: DemoDesign;
  words: Words;
  index: number;
  className?: string;
}

function Head({
  index,
  label,
  heading,
  intro,
  sample,
  design,
  words,
  center = false,
}: {
  index: number;
  label: string;
  heading: string;
  intro?: string;
  sample: boolean;
  design: DemoDesign;
  words: Words;
  center?: boolean;
}) {
  return (
    <header className={`dx-reveal ${center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      <div className={`flex flex-wrap items-center gap-3 ${center ? "justify-center" : ""}`}>
        <SectionLabel index={index} label={label} />
        {sample ? <SampleTag words={words} /> : null}
      </div>
      <Heading text={heading} emphasis={design.emphasis} className="dx-h2 mt-5" />
      {intro ? <p className="dx-lede dx-muted mt-5 text-pretty">{intro}</p> : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export function Services({ section, design, words, index, className = "" }: Base & { section: Section<"offering"> }) {
  const head = (
    <Head index={index} label={words.sectionLabel.offering} heading={section.heading} intro={section.intro} sample={section.sample} design={design} words={words} />
  );

  if (design.services === "index") {
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell">
          {head}
          <ol className="mt-14">
            {section.items.map((item, i) => (
              <li key={item.title} className="dx-index-row dx-reveal">
                <span className="dx-display dx-accent-text text-2xl tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="dx-display dx-h3 dx-index-title">{item.title}</h3>
                <p className="dx-muted col-start-2 md:col-start-auto">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  if (design.services === "sticky-stack") {
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">{head}</div>
          </div>
          <ol className="grid gap-6 lg:col-span-7 lg:col-start-6">
            {section.items.map((item, i) => (
              <li
                key={item.title}
                className="dx-stack-card dx-card p-7 sm:p-10"
                style={{ "--i": i, background: i % 2 === 1 ? "var(--dx-accent-soft)" : undefined } as CSSProperties}
              >
                <div className="flex items-start justify-between gap-6">
                  <span className="dx-display dx-accent-text text-5xl leading-none tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="dx-accent-text">
                    <Icon name={iconForService(item.title)} className="h-7 w-7" />
                  </span>
                </div>
                <h3 className="dx-display dx-h3 mt-10">{item.title}</h3>
                <p className="dx-muted mt-3 max-w-lg">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  if (design.services === "bento") {
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell">
          {head}
          <ul className="dx-bento mt-14">
            {section.items.map((item, i) => (
              <li key={item.title} className="dx-card dx-lift dx-reveal relative overflow-hidden p-7 sm:p-9" style={{ minHeight: i === 0 ? "22rem" : "14rem" }}>
                {i === 0 ? (
                  <div className="absolute inset-0 opacity-30">
                    <TileArt motif={design.motif} palette={design.palette} seed={design.seed} index={9} />
                  </div>
                ) : null}
                <div className="relative flex h-full flex-col justify-between gap-8">
                  <span className="dx-accent-text">
                    <Icon name={iconForService(item.title)} className="h-7 w-7" />
                  </span>
                  <div>
                    <h3 className={`dx-display ${i === 0 ? "dx-h2" : "dx-h3"}`}>{item.title}</h3>
                    <p className="dx-muted mt-3 max-w-md">{item.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // rail
  return (
    <section id={section.id} className={`dx-section ${className}`}>
      <div className="dx-shell">{head}</div>
      <ol className="dx-rail-scroll dx-reveal mt-14">
        {section.items.map((item, i) => (
          <li key={item.title} className="dx-card dx-lift flex min-h-[22rem] flex-col justify-between p-8">
            <span className="dx-display dx-accent-text text-7xl leading-none tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="dx-display dx-h3">{item.title}</h3>
              <p className="dx-muted mt-3">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export function About({
  section,
  design,
  words,
  index,
  business,
  brand,
  mark,
  className = "",
}: Base & { section: Section<"positioning">; business: DemoSiteBusiness; brand: string; mark: string }) {
  if (design.about === "statement") {
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell">
          <div className="flex flex-wrap items-center gap-3">
            <SectionLabel index={index} label={words.sectionLabel.positioning} />
            {section.sample ? <SampleTag words={words} /> : null}
          </div>
          {/* A long paragraph at headline size becomes a wall; it steps down a size. */}
          <p className={`dx-display dx-statement dx-reveal mt-8 max-w-5xl text-balance ${section.body.length > 160 ? "dx-h2-sm" : "dx-h2"}`}>{section.body}</p>
          <ul className="dx-rule mt-14 grid gap-6 border-t pt-8 sm:grid-cols-3">
            {section.points.map((point) => (
              <li key={point} className="dx-reveal flex items-start gap-3">
                <MarkDivider motif={design.motif} palette={design.palette} />
                <span className="pt-1.5">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (design.about === "stamps") {
    return (
      <section id={section.id} className={`dx-section overflow-hidden ${className}`}>
        <div className="dx-shell grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Head index={index} label={words.sectionLabel.positioning} heading={section.heading} sample={section.sample} design={design} words={words} />
            <p className="dx-lede dx-muted dx-reveal mt-6">{section.body}</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-6">
            {section.points.map((point, i) => (
              <li
                key={point}
                className="dx-reveal dx-display flex aspect-square w-40 items-center justify-center rounded-full p-5 text-center text-lg leading-tight"
                style={{
                  background: i === 1 ? "var(--dx-accent)" : "var(--dx-surface)",
                  color: i === 1 ? "var(--dx-on-accent)" : "var(--dx-ink)",
                  border: "1.5px solid var(--dx-line)",
                  transform: `rotate(${[-8, 6, -3][i % 3]}deg)`,
                }}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // split
  return (
    <section id={section.id} className={`dx-section ${className}`}>
      <div className="dx-shell grid items-center gap-14 lg:grid-cols-12">
        <div className="relative lg:col-span-5">
          <div className="dx-par" style={{ "--depth": "50px" } as CSSProperties}>
            <PhotoSlot label={words.photoLabels[3]} design={design} index={3} className="aspect-[4/5] w-full" />
          </div>
          <div className="dx-par absolute -right-4 -top-8 hidden sm:block" style={{ "--depth": "110px" } as CSSProperties}>
            <Badge text={`${brand} · ${business.city}`} mark={mark} palette={design.palette} size={118} />
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Head index={index} label={words.sectionLabel.positioning} heading={section.heading} sample={section.sample} design={design} words={words} />
          <p className="dx-lede dx-muted dx-reveal mt-6">{section.body}</p>
          <ul className="mt-10 space-y-4">
            {section.points.map((point) => (
              <li key={point} className="dx-rule dx-reveal flex items-center gap-4 border-b pb-4">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--dx-accent)" }} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export function Gallery({ section, design, words, index, className = "" }: Base & { section: Section<"gallery"> }) {
  const head = (
    <Head index={index} label={words.sectionLabel.gallery} heading={section.heading} intro={section.body} sample={section.sample} design={design} words={words} />
  );
  const labels = section.placeholders.map((p) => p.label);

  if (design.gallery === "rail") {
    const tiles = labels.map((label, i) => (
      <PhotoSlot key={label} label={label} design={design} index={10 + i} className="aspect-[3/4] w-[min(78vw,26rem)] shrink-0" />
    ));
    return (
      <section id={section.id} className={className}>
        <div className="dx-shell dx-section pb-10">{head}</div>
        {/* Pinned horizontal scroll on wide screens with scroll timelines; a
            native swipeable rail everywhere else (CSS decides which shows). */}
        <div className="dx-hrail" style={{ height: `${100 + labels.length * 45}vh` }}>
          <div className="dx-hrail-pin">
            <div className="dx-hrail-track">{tiles}</div>
          </div>
        </div>
        <div className="dx-hrail-track-fallback pb-24">
          {labels.map((label, i) => (
            <PhotoSlot key={label} label={label} design={design} index={10 + i} scope="f" className="aspect-[3/4] w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (design.gallery === "parallax") {
    const columns = [labels.filter((_, i) => i % 2 === 0), labels.filter((_, i) => i % 2 === 1)];
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell">
          {head}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 sm:gap-8">
            {columns.map((column, c) => (
              <div key={c} className={`dx-par grid gap-5 sm:gap-8 ${c === 1 ? "sm:mt-24" : ""}`} style={{ "--depth": c === 0 ? "40px" : "-60px" } as CSSProperties}>
                {column.map((label, i) => (
                  <div key={label} className="dx-zoom overflow-hidden" style={{ borderRadius: "var(--dx-r)" }}>
                    <PhotoSlot label={label} design={design} index={20 + c * 10 + i} className={`w-full ${(c + i) % 2 === 0 ? "aspect-[4/5]" : "aspect-[5/4]"}`} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // mosaic -- one arrangement per tile count, so no count leaves a hole in
  // the grid (four tiles once left the last one alone on half a row).
  const MOSAIC: Record<number, string[]> = {
    1: ["sm:col-span-6 sm:row-span-2"],
    2: ["sm:col-span-4 sm:row-span-2", "sm:col-span-2 sm:row-span-2"],
    3: ["sm:col-span-4 sm:row-span-2", "sm:col-span-2", "sm:col-span-2"],
    4: ["sm:col-span-4 sm:row-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-6"],
    5: ["sm:col-span-4 sm:row-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-3", "sm:col-span-3"],
    6: ["sm:col-span-4 sm:row-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-2"],
  };
  const spans = MOSAIC[Math.min(Math.max(labels.length, 1), 6)];
  return (
    <section id={section.id} className={`dx-section ${className}`}>
      <div className="dx-shell">
        {head}
        <ul className="mt-14 grid auto-rows-[12rem] gap-4 sm:grid-cols-6 sm:auto-rows-[14rem]">
          {labels.map((label, i) => (
            <li key={label} className={`dx-unmask ${spans[i % spans.length]}`}>
              <PhotoSlot label={label} design={design} index={40 + i} className="h-full w-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

function socialName(link: string): string {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return link;
  }
}

function Schedule({ business, locale, words }: { business: DemoSiteBusiness; locale: Locale; words: Words }) {
  if (business.openingHours.length > 0) {
    return (
      <ul className="space-y-1 tabular-nums">
        {business.openingHours.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <ul className="space-y-1 tabular-nums">
        {sampleHoursFor(business.category).map((line) => (
          <li key={line}>{localizeScheduleLine(line, locale)}</li>
        ))}
      </ul>
      <SampleTag words={words} className="mt-3" />
    </>
  );
}

function PhoneValue({ business, words, large = false }: { business: DemoSiteBusiness; words: Words; large?: boolean }) {
  if (business.phone === null) return <span className="dx-muted">{words.toBeAdded}</span>;
  const href = phoneHref(business.phone);
  const text = formatPhone(business.phone);
  // A phone number must never break across lines; the large size is capped so
  // it fits a third of the page.
  const className = large
    ? "dx-display text-3xl whitespace-nowrap tabular-nums sm:text-4xl"
    : "font-semibold whitespace-nowrap tabular-nums";
  return href ? (
    <a href={href} className={`${className} underline decoration-1 underline-offset-[0.2em]`}>
      {text}
    </a>
  ) : (
    <span className={className}>{text}</span>
  );
}

function Socials({ business, words }: { business: DemoSiteBusiness; words: Words }) {
  const links = business.socialLinks
    .map((link) => classifyWebsite(link))
    .filter((r): r is { kind: "linkable"; href: string } => r.kind === "linkable");
  if (links.length === 0) return null;
  return (
    <div>
      <p className="dx-label dx-muted">{words.follow}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="dx-lang">
              {socialName(link.href)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Contact({
  section,
  design,
  words,
  index,
  business,
  locale,
  className = "",
}: Base & { section: Section<"contact">; business: DemoSiteBusiness; locale: Locale }) {
  if (design.contact === "board") {
    return (
      <section id={section.id} className={`dx-section dx-inverted ${className}`}>
        <div className="dx-shell">
          <Head index={index} label={words.sectionLabel.contact} heading={section.heading} intro={section.body} sample={section.sample} design={design} words={words} />
          <div className="dx-rule mt-14 grid gap-10 border-t pt-10 lg:grid-cols-3">
            <div className="dx-reveal">
              <p className="dx-label dx-muted">{words.phone}</p>
              <p className="mt-3">
                <PhoneValue business={business} words={words} large />
              </p>
            </div>
            <div className="dx-reveal">
              <p className="dx-label dx-muted">{words.address}</p>
              <p className="dx-display dx-h3 mt-3">{business.address ?? <span className="dx-muted">{words.toBeAdded}</span>}</p>
              <p className="dx-muted mt-1">{business.city}</p>
            </div>
            <div className="dx-reveal">
              <p className="dx-label dx-muted">{words.hours}</p>
              <div className="mt-3">
                <Schedule business={business} locale={locale} words={words} />
              </div>
              <p className="dx-small dx-muted mt-3">{section.hoursNote}</p>
            </div>
          </div>
          <div className="mt-10">
            <Socials business={business} words={words} />
          </div>
        </div>
      </section>
    );
  }

  const card = (
    <dl className="dx-card dx-reveal divide-y p-7 sm:p-9" style={{ ["--tw-divide-opacity" as string]: 1, borderColor: "var(--dx-line)" }}>
      <div className="pb-6">
        <dt className="dx-label dx-muted">{words.phone}</dt>
        <dd className="mt-2 text-lg">
          <PhoneValue business={business} words={words} />
        </dd>
      </div>
      <div className="dx-rule py-6">
        <dt className="dx-label dx-muted">{words.address}</dt>
        <dd className="mt-2">
          {business.address ?? <span className="dx-muted">{words.toBeAdded}</span>}
          <span className="dx-muted block">{business.city}</span>
        </dd>
      </div>
      <div className="dx-rule py-6">
        <dt className="dx-label dx-muted">{words.hours}</dt>
        <dd className="mt-2">
          <Schedule business={business} locale={locale} words={words} />
        </dd>
      </div>
      {business.socialLinks.length > 0 ? (
        <div className="dx-rule pt-6">
          <Socials business={business} words={words} />
        </div>
      ) : null}
    </dl>
  );

  if (design.contact === "card") {
    return (
      <section id={section.id} className={`dx-section ${className}`}>
        <div className="dx-shell">
          <Head index={index} label={words.sectionLabel.contact} heading={section.heading} intro={section.body} sample={section.sample} design={design} words={words} center />
          <p className="dx-small dx-muted mt-3 text-center">{section.hoursNote}</p>
          <div className="mx-auto mt-12 max-w-xl">{card}</div>
        </div>
      </section>
    );
  }

  // split
  return (
    <section id={section.id} className={`dx-section ${className}`}>
      <div className="dx-shell grid gap-14 lg:grid-cols-2">
        <div>
          <Head index={index} label={words.sectionLabel.contact} heading={section.heading} intro={section.body} sample={section.sample} design={design} words={words} />
          <p className="dx-small dx-muted mt-3">{section.hoursNote}</p>
        </div>
        {card}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Closing call to action
// ---------------------------------------------------------------------------

export function Closing({
  section,
  sections,
  design,
  words,
  business,
  className = "",
}: Omit<Base, "index"> & { section: Section<"cta">; sections: DemoSection[]; business: DemoSiteBusiness }) {
  const tag = section.sample ? <SampleTag words={words} /> : null;

  if (design.cta === "marquee") {
    const phrase = section.heading;
    return (
      <section id={section.id} className={`dx-inverted overflow-hidden py-20 sm:py-28 ${className}`}>
        <div className="dx-marquee border-0 py-0" aria-hidden="true">
          <div className="dx-marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex">
                {[0, 1, 2].map((n) => (
                  <span key={n} className="dx-display dx-giant flex items-center gap-10 pr-10 whitespace-nowrap">
                    {phrase}
                    <span className="dx-accent-text">✳</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="dx-shell mt-12 flex flex-col items-center gap-6 text-center">
          <h2 className="sr-only">{phrase}</h2>
          {tag}
          <p className="dx-lede dx-muted max-w-xl">{section.body}</p>
          <Cta cta={section.cta} business={business} sections={sections} />
        </div>
      </section>
    );
  }

  if (design.cta === "band") {
    return (
      <section id={section.id} className={`py-10 sm:py-16 ${className}`}>
        <div className="dx-shell">
          <div
            className="dx-reveal grid items-center gap-8 p-9 sm:p-14 lg:grid-cols-12"
            style={{ background: "var(--dx-accent)", color: "var(--dx-on-accent)", borderRadius: "var(--dx-r)" }}
          >
            <div className="lg:col-span-8">
              {tag}
              <h2 className="dx-display dx-h2 mt-3">{section.heading}</h2>
              <p className="dx-lede mt-4 max-w-xl opacity-90">{section.body}</p>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <Cta cta={section.cta} business={business} sections={sections} className="!bg-[var(--dx-on-accent)] !text-[var(--dx-accent)]" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // giant
  return (
    <section id={section.id} className={`dx-section relative overflow-hidden ${className}`}>
      <div className="dx-shell relative text-center">
        <div className="flex justify-center">{tag}</div>
        <Heading text={section.heading} emphasis={design.emphasis} className="dx-giant dx-reveal mx-auto mt-6 max-w-[16ch]" style={fitGiant(section.heading, design.displayCase === "upper")} />
        <p className="dx-lede dx-muted dx-reveal mx-auto mt-8 max-w-xl">{section.body}</p>
        <div className="dx-reveal mt-10 flex justify-center">
          <Cta cta={section.cta} business={business} sections={sections} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Marquee
// ---------------------------------------------------------------------------

/** A ticker of the services and the neighbourhood. The copy is duplicated, and the duplicate hidden. */
export function Marquee({ items, design }: { items: string[]; design: DemoDesign }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <div className="flex" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="dx-marquee-item dx-display">
          {item}
          <svg aria-hidden="true" viewBox="0 0 100 100" className="h-5 w-5">
            <path d="M50 6 C54 40 60 46 94 50 C60 54 54 60 50 94 C46 60 40 54 6 50 C40 46 46 40 50 6 Z" fill={design.palette.accent} />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div className="dx-marquee">
      <div className="dx-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
