import type {
  DemoCta,
  DemoLayout,
  DemoSection,
  DemoSiteBusiness,
  DemoSiteSpec,
} from "@/lib/demo-site";
import { samplesForCategory } from "@/lib/demo-samples";

import { demoFontVars } from "./fonts";
import { Icon, iconForService } from "./icons";
import { DEMO_THEMES, type DemoThemeTokens } from "./theme";

/**
 * Renders a stored `DemoSiteSpec` as the proposed website.
 *
 * ── SAFETY ────────────────────────────────────────────────────────────────
 *
 * Every generated value arrives here as a plain string and is placed in JSX as
 * a child, which React escapes. There is no `dangerouslySetInnerHTML` in this
 * file or anywhere in the demo rendering path, and no generated value is ever
 * used as an attribute that a browser would execute or navigate to.
 *
 * The only `href`s on the page are:
 *   - `tel:` built from the APPLICATION-OWNED phone number, with everything but
 *     digits and a leading plus removed here;
 *   - `#section-id` fragments, where the id was already validated as a
 *     lowercase slug and checked to match a section in this same spec;
 *   - social links the business published on its OWN site, read by research.
 *
 * No generated content becomes a link to anywhere.
 *
 * ── FACTS ─────────────────────────────────────────────────────────────────
 *
 * The business name, phone, address, hours and social links rendered below are
 * read from `spec.business`, which application code copied from the lead and
 * its researched profile. The generator's content subtree has no field for any
 * of them.
 *
 * ── LAYOUT ────────────────────────────────────────────────────────────────
 *
 * `content.layout` selects one of four whole-page compositions. Every site
 * used to share one arrangement -- centred hero, card grid, split about -- so
 * a portfolio of demos read as one template with the names swapped. The layout
 * is a NAME from a closed set; every grid, size and spacing decision behind it
 * is owned here. See `DemoLayout` for why the choice is page-level rather than
 * per-section.
 *
 * Pure and synchronous, so it is directly renderable in a test.
 */

const SHELL = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const NARROW = "mx-auto w-full max-w-4xl px-5 sm:px-8";

/** Vertical rhythm per layout. Compact is tighter; showcase breathes. */
function sectionPadding(layout: DemoLayout): string {
  switch (layout) {
    case "compact":
      return "py-14 sm:py-16";
    case "showcase":
      return "py-20 sm:py-32";
    default:
      return "py-16 sm:py-24";
  }
}

/**
 * Reduce a listed phone number to something safe for a `tel:` URI.
 *
 * Digits and a single leading plus only. The value is provider data and could
 * contain anything; this keeps it from becoming another scheme.
 */
export function telHref(phone: string): string | null {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 5) return null;
  return `tel:${plus}${digits}`;
}

/** Where a non-call CTA points: the contact section, or the first section. */
function fallbackAnchor(sections: DemoSection[]): string {
  const contact = sections.find((s) => s.kind === "contact");
  return contact ? contact.id : sections[0].id;
}

function CtaButton({
  cta,
  business,
  sections,
  className,
}: {
  cta: DemoCta;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  className: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors";

  // A `call` action resolves against the stored number. When none was listed,
  // the button becomes an in-page link to the contact section rather than a
  // dead `tel:` or an invented number.
  if (cta.action === "call") {
    const href = business.phone ? telHref(business.phone) : null;
    if (href) {
      return (
        <a href={href} className={`${base} ${className}`}>
          {cta.label}
        </a>
      );
    }
  }

  const target = cta.targetSectionId ?? fallbackAnchor(sections);
  return (
    <a href={`#${target}`} className={`${base} ${className}`}>
      {cta.label}
    </a>
  );
}

/**
 * The marker on a section whose copy is placeholder rather than evidenced.
 *
 * Deliberately small. The thorough disclosure lives in the preview chrome,
 * which lists every sample section by name and which a generator cannot
 * reach; this is the reminder in place, so someone scrolling the page cannot
 * mistake a services list we wrote for one the business gave us.
 *
 * It is driven by `section.sample`, which `enforceSampleFlags` recomputed from
 * the facts held -- not by anything the generator claimed.
 */
function SampleTag({ theme, className = "" }: { theme: DemoThemeTokens; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase ${theme.sampleTag} ${className}`}
    >
      Sample content
    </span>
  );
}

/**
 * A section's label, rule and heading.
 *
 * One component so the typographic hierarchy is identical everywhere and
 * changes in one place. `editorial` sets a small accented label above the
 * heading and a hairline rule; the others use the heading alone.
 */
function SectionHead({
  heading,
  intro,
  label,
  sample,
  theme,
  layout,
  align = "left",
}: {
  heading: string;
  intro?: string;
  label?: string;
  sample: boolean;
  theme: DemoThemeTokens;
  layout: DemoLayout;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  const size =
    layout === "compact"
      ? "text-2xl sm:text-3xl"
      : layout === "showcase"
        ? "text-3xl sm:text-5xl"
        : "text-3xl sm:text-4xl";

  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {layout === "editorial" && label ? (
        <div className={`flex items-center gap-3 ${centered ? "justify-center" : ""}`}>
          <span aria-hidden="true" className={`h-px w-8 ${theme.accentRule}`} />
          <span
            className={`text-xs font-semibold tracking-[0.18em] uppercase ${theme.accent}`}
          >
            {label}
          </span>
        </div>
      ) : null}

      {sample ? (
        <SampleTag theme={theme} className={layout === "editorial" && label ? "mt-4" : "mb-4"} />
      ) : null}

      <h2
        className={`font-semibold tracking-tight text-balance ${size} ${theme.heading} ${
          layout === "editorial" && label ? "mt-3" : ""
        }`}
      >
        {heading}
      </h2>

      {intro ? (
        <p className={`mt-4 text-base leading-relaxed text-pretty ${theme.body}`}>{intro}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  section,
  business,
  sections,
  theme,
  layout,
}: {
  section: Extract<DemoSection, { kind: "hero" }>;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  theme: DemoThemeTokens;
  layout: DemoLayout;
}) {
  const eyebrow = (
    <p
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${theme.eyebrow}`}
    >
      {section.eyebrow}
    </p>
  );

  const buttons = (
    <div
      className={`flex flex-wrap items-center gap-3 ${layout === "showcase" ? "justify-center" : ""}`}
    >
      <CtaButton
        cta={section.primaryCta}
        business={business}
        sections={sections}
        className={theme.buttonPrimary}
      />
      {section.secondaryCta ? (
        <CtaButton
          cta={section.secondaryCta}
          business={business}
          sections={sections}
          className={theme.buttonSecondary}
        />
      ) : null}
    </div>
  );

  // Decoration is CSS only. No external images are fetched, and no photograph
  // of a business we have never seen is implied.
  const decor = (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl ${theme.heroDecor}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-40 -left-32 h-[24rem] w-[24rem] rounded-full blur-3xl ${theme.heroDecor}`}
      />
    </>
  );

  if (layout === "editorial") {
    // Asymmetric: the headline holds the left column at large size, the
    // supporting copy and actions sit right. Flat -- no blurs -- because the
    // type is doing the work.
    return (
      <section id={section.id} className={`relative isolate ${theme.hero}`}>
        <div className={`${SHELL} relative grid gap-10 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16`}>
          <div className="lg:col-span-7">
            {eyebrow}
            {section.sample ? <SampleTag theme={theme} className="ml-2 align-middle" /> : null}
            <h1
              className={`mt-6 text-4xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl ${theme.display}`}
            >
              {section.heading}
            </h1>
          </div>

          <div className="flex flex-col justify-end lg:col-span-5">
            <span aria-hidden="true" className={`mb-6 hidden h-px w-full lg:block ${theme.accentRule}`} />
            <p className={`text-lg leading-relaxed text-pretty ${theme.heroText}`}>
              {section.subheading}
            </p>
            <div className="mt-8">{buttons}</div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "showcase") {
    // Full-bleed and centred, with the largest type on the site.
    return (
      <section id={section.id} className={`relative isolate overflow-hidden ${theme.hero}`}>
        {decor}
        <div className={`${SHELL} relative py-28 text-center sm:py-40`}>
          <div className="flex items-center justify-center gap-2">
            {eyebrow}
            {section.sample ? <SampleTag theme={theme} /> : null}
          </div>
          <h1
            className={`mx-auto mt-8 max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl ${theme.display}`}
          >
            {section.heading}
          </h1>
          <p
            className={`mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl ${theme.heroText}`}
          >
            {section.subheading}
          </p>
          <div className="mt-10">{buttons}</div>
        </div>
      </section>
    );
  }

  if (layout === "compact") {
    return (
      <section id={section.id} className={`relative isolate overflow-hidden ${theme.hero}`}>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl ${theme.heroDecor}`}
        />
        <div className={`${NARROW} relative py-16 sm:py-20`}>
          {eyebrow}
          {section.sample ? <SampleTag theme={theme} className="ml-2 align-middle" /> : null}
          <h1
            className={`mt-5 max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl ${theme.display}`}
          >
            {section.heading}
          </h1>
          <p className={`mt-5 max-w-xl text-base leading-relaxed text-pretty ${theme.heroText}`}>
            {section.subheading}
          </p>
          <div className="mt-8">{buttons}</div>
        </div>
      </section>
    );
  }

  // classic
  return (
    <section id={section.id} className={`relative isolate overflow-hidden ${theme.hero}`}>
      {decor}
      <div className={`${SHELL} relative py-20 sm:py-32`}>
        {eyebrow}
        {section.sample ? <SampleTag theme={theme} className="ml-2 align-middle" /> : null}
        <h1
          className={`mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl ${theme.display}`}
        >
          {section.heading}
        </h1>
        <p className={`mt-6 max-w-2xl text-lg leading-relaxed text-pretty ${theme.heroText}`}>
          {section.subheading}
        </p>
        <div className="mt-10">{buttons}</div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Offering
// ---------------------------------------------------------------------------

function Offering({
  section,
  theme,
  layout,
  banded,
}: {
  section: Extract<DemoSection, { kind: "offering" }>;
  theme: DemoThemeTokens;
  layout: DemoLayout;
  banded: boolean;
}) {
  const shell = `${sectionPadding(layout)} ${banded ? theme.band : ""}`;

  if (layout === "editorial") {
    // A ruled list. Each row is title and body side by side, separated by
    // hairlines -- the arrangement a print piece would use, and nothing like
    // the card grid the other layouts get.
    return (
      <section id={section.id} className={shell}>
        <div className={SHELL}>
          <SectionHead
            heading={section.heading}
            intro={section.intro}
            label="Services"
            sample={section.sample}
            theme={theme}
            layout={layout}
          />

          <ul className="mt-14">
            {section.items.map((item) => (
              <li
                key={item.title}
                className={`grid gap-4 border-t py-8 sm:grid-cols-12 sm:gap-8 ${theme.rule}`}
              >
                <div className="flex items-start gap-4 sm:col-span-5">
                  <span className={`shrink-0 ${theme.accent}`}>
                    <Icon name={iconForService(item.title)} className="h-6 w-6" />
                  </span>
                  <h3 className={`text-xl font-semibold tracking-tight ${theme.heading}`}>
                    {item.title}
                  </h3>
                </div>
                <p className={`text-base leading-relaxed text-pretty sm:col-span-7 ${theme.body}`}>
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (layout === "showcase") {
    // Alternating full-width rows: an icon panel on one side, copy on the
    // other, flipping each row so the eye zig-zags down the page.
    return (
      <section id={section.id} className={shell}>
        <div className={SHELL}>
          <SectionHead
            heading={section.heading}
            intro={section.intro}
            label="Services"
            sample={section.sample}
            theme={theme}
            layout={layout}
            align="center"
          />

          <ul className="mt-16 space-y-12">
            {section.items.map((item, index) => (
              <li key={item.title} className="grid items-center gap-8 sm:grid-cols-2 sm:gap-14">
                <div
                  className={`flex aspect-[16/10] items-center justify-center rounded-3xl ${theme.placeholder} ${
                    index % 2 === 1 ? "sm:order-2" : ""
                  }`}
                >
                  <Icon name={iconForService(item.title)} className="h-16 w-16 opacity-70" />
                </div>
                <div>
                  <h3 className={`text-2xl font-semibold tracking-tight ${theme.heading}`}>
                    {item.title}
                  </h3>
                  <p className={`mt-4 text-base leading-relaxed text-pretty ${theme.body}`}>
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // classic and compact: a card grid, with compact running tighter.
  const columns = layout === "compact" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section id={section.id} className={shell}>
      <div className={layout === "compact" ? NARROW : SHELL}>
        <SectionHead
          heading={section.heading}
          intro={section.intro}
          label="Services"
          sample={section.sample}
          theme={theme}
          layout={layout}
        />

        <ul className={`mt-12 grid gap-6 ${columns}`}>
          {section.items.map((item) => (
            <li key={item.title} className={`rounded-2xl p-7 ${theme.card}`}>
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${theme.iconWrap}`}
              >
                <Icon name={iconForService(item.title)} className="h-5 w-5" />
              </span>
              <h3 className={`mt-5 text-lg font-semibold tracking-tight ${theme.heading}`}>
                {item.title}
              </h3>
              <p className={`mt-2 text-sm leading-relaxed text-pretty ${theme.body}`}>
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

function Positioning({
  section,
  theme,
  layout,
  banded,
}: {
  section: Extract<DemoSection, { kind: "positioning" }>;
  theme: DemoThemeTokens;
  layout: DemoLayout;
  banded: boolean;
}) {
  const shell = `${sectionPadding(layout)} ${banded ? theme.band : ""}`;

  if (layout === "editorial") {
    // Single column, generous measure, points as a ruled run underneath.
    return (
      <section id={section.id} className={shell}>
        <div className={NARROW}>
          <SectionHead
            heading={section.heading}
            label="About"
            sample={section.sample}
            theme={theme}
            layout={layout}
          />
          <p className={`mt-8 text-xl leading-relaxed text-pretty ${theme.body}`}>
            {section.body}
          </p>
          {/* Complete literals, never an assembled `sm:grid-cols-${n}` --
              Tailwind only emits classes it can see spelled out in source, so
              a computed one produces an unstyled single column. */}
          <ul
            className={`mt-10 grid gap-6 ${
              section.points.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            {section.points.map((point) => (
              <li key={point} className={`border-t pt-4 ${theme.rule}`}>
                <span className={`text-sm leading-relaxed ${theme.body}`}>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (layout === "showcase") {
    // Copy left, points as bordered blocks right.
    return (
      <section id={section.id} className={shell}>
        <div className={`${SHELL} grid gap-12 lg:grid-cols-2 lg:gap-20`}>
          <div>
            <SectionHead
              heading={section.heading}
              label="About"
              sample={section.sample}
              theme={theme}
              layout={layout}
            />
            <p className={`mt-6 text-lg leading-relaxed text-pretty ${theme.body}`}>
              {section.body}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:content-center">
            {section.points.map((point) => (
              <li key={point} className={`rounded-2xl p-6 ${theme.card}`}>
                <span className={`block text-sm leading-relaxed ${theme.body}`}>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // classic and compact
  return (
    <section id={section.id} className={shell}>
      <div
        className={
          layout === "compact"
            ? NARROW
            : `${SHELL} grid gap-12 lg:grid-cols-2 lg:gap-20`
        }
      >
        <div>
          <SectionHead
            heading={section.heading}
            sample={section.sample}
            theme={theme}
            layout={layout}
          />
          <p className={`mt-6 text-base leading-relaxed text-pretty ${theme.body}`}>
            {section.body}
          </p>
        </div>

        <ul className={`space-y-4 ${layout === "compact" ? "mt-8" : "lg:pt-4"}`}>
          {section.points.map((point) => (
            <li key={point} className="flex gap-4">
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${theme.marker}`}
              >
                <Icon name="star" className="h-3.5 w-3.5" />
              </span>
              <span className={`text-base leading-relaxed ${theme.body}`}>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

/**
 * A labelled CSS block, never a stock photograph standing in for work we have
 * not seen. The icon marks it as a frame awaiting a picture.
 */
function Placeholder({
  label,
  theme,
  className,
}: {
  label: string;
  theme: DemoThemeTokens;
  className: string;
}) {
  return (
    <li className={`relative flex flex-col justify-end overflow-hidden rounded-2xl ${theme.placeholder} ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <Icon name="camera" className="h-10 w-10 opacity-25" />
      </span>
      <span className="relative p-5 text-sm font-medium">{label}</span>
    </li>
  );
}

function Gallery({
  section,
  theme,
  layout,
  banded,
}: {
  section: Extract<DemoSection, { kind: "gallery" }>;
  theme: DemoThemeTokens;
  layout: DemoLayout;
  banded: boolean;
}) {
  const shell = `${sectionPadding(layout)} ${banded ? theme.band : ""}`;

  if (layout === "showcase") {
    // A mosaic: the first frame is given twice the room, so the block reads as
    // a considered arrangement rather than a row of equal tiles.
    return (
      <section id={section.id} className={shell}>
        <div className={SHELL}>
          <SectionHead
            heading={section.heading}
            intro={section.body}
            label="Gallery"
            sample={section.sample}
            theme={theme}
            layout={layout}
            align="center"
          />
          <ul className="mt-14 grid auto-rows-[11rem] grid-cols-2 gap-4 sm:auto-rows-[13rem] lg:grid-cols-4">
            {section.placeholders.map((placeholder, index) => (
              <Placeholder
                key={`${placeholder.label}-${index}`}
                label={placeholder.label}
                theme={theme}
                className={index === 0 ? "col-span-2 row-span-2" : ""}
              />
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (layout === "editorial") {
    return (
      <section id={section.id} className={shell}>
        <div className={SHELL}>
          <SectionHead
            heading={section.heading}
            intro={section.body}
            label="Gallery"
            sample={section.sample}
            theme={theme}
            layout={layout}
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {section.placeholders.map((placeholder, index) => (
              <Placeholder
                key={`${placeholder.label}-${index}`}
                label={placeholder.label}
                theme={theme}
                className={index % 3 === 0 ? "aspect-[4/3]" : "aspect-square"}
              />
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const columns = layout === "compact" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section id={section.id} className={shell}>
      <div className={layout === "compact" ? NARROW : SHELL}>
        <SectionHead
          heading={section.heading}
          intro={section.body}
          sample={section.sample}
          theme={theme}
          layout={layout}
        />
        <ul className={`mt-12 grid gap-5 ${columns}`}>
          {section.placeholders.map((placeholder, index) => (
            <Placeholder
              key={`${placeholder.label}-${index}`}
              label={placeholder.label}
              theme={theme}
              className="aspect-[4/3]"
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * A readable label for a social URL, from its host only.
 *
 * Host, never the path: a handle in a path could be anything, and this is
 * presentation. The link itself is exactly what the business published.
 */
function socialLabel(link: string): string {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return link;
  }
}

function ContactRow({
  label,
  theme,
  children,
  className = "",
}: {
  label: string;
  theme: DemoThemeTokens;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>{label}</dt>
      <dd className={`mt-1.5 text-base ${theme.body}`}>{children}</dd>
    </div>
  );
}

function Contact({
  section,
  business,
  theme,
  layout,
  banded,
}: {
  section: Extract<DemoSection, { kind: "contact" }>;
  business: DemoSiteBusiness;
  theme: DemoThemeTokens;
  layout: DemoLayout;
  banded: boolean;
}) {
  const href = business.phone ? telHref(business.phone) : null;
  const stacked = layout === "compact";

  // Contact values come from spec.business -- application-owned facts copied
  // from the lead. Nothing in this card was written by the generator.
  const card = (
    <dl className={`divide-y rounded-2xl p-7 ${theme.card} ${theme.divide}`}>
      <ContactRow label="Phone" theme={theme} className="pb-5">
        {business.phone === null ? (
          // A neutral empty slot. "Not listed" is OUR vocabulary about a
          // provider record, and has no meaning to a visitor.
          <span className={theme.muted}>To be added</span>
        ) : href ? (
          <a href={href} className={`font-medium underline underline-offset-4 ${theme.heading}`}>
            {business.phone}
          </a>
        ) : (
          <span className={`font-medium ${theme.heading}`}>{business.phone}</span>
        )}
      </ContactRow>

      <ContactRow label="Address" theme={theme} className="py-5">
        {business.address ?? <span className={theme.muted}>To be added</span>}
      </ContactRow>

      <ContactRow label="Opening hours" theme={theme} className="py-5">
        {/* Real hours when the business published them on its own site and
            research read them there. Otherwise a plausible schedule for the
            category, rendered by APPLICATION code from `demo-samples.ts` and
            tagged as sample right here in the card.

            The distinction is the whole point. A blank line taught an owner
            nothing; a schedule presented as theirs would be the single worst
            thing a demo could show them. A schedule visibly labelled as a
            placeholder shows the design and asks the question.

            The generator never writes a time: `hoursNote` is prose, and the
            schema has no field a schedule could occupy. */}
        {business.openingHours.length > 0 ? (
          <ul className="space-y-0.5">
            {business.openingHours.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="space-y-0.5 tabular-nums">
              {samplesForCategory(business.category).hours.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
            <SampleTag theme={theme} className="mt-3" />
          </>
        )}
      </ContactRow>

      {/* Omitted entirely when there is nothing to show. Phone and address stay
          visible when empty, because a blank there is a question the owner needs
          to answer; a business with no social presence has nothing to answer,
          and an empty row would just look unfinished. */}
      {business.socialLinks.length > 0 ? (
        <ContactRow label="Follow" theme={theme} className="pt-5">
          {/* The profiles the business links to from its OWN site. Never a
              guessed handle: a wrong link in a demo is worse than none. */}
          <ul className="space-y-1">
            {business.socialLinks.map((link) => (
              <li key={link}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline underline-offset-4 break-all"
                >
                  {socialLabel(link)}
                </a>
              </li>
            ))}
          </ul>
        </ContactRow>
      ) : null}
    </dl>
  );

  return (
    <section id={section.id} className={`${sectionPadding(layout)} ${banded ? theme.band : ""}`}>
      <div
        className={
          stacked ? NARROW : `${SHELL} grid gap-12 lg:grid-cols-2 lg:gap-20`
        }
      >
        <div>
          <SectionHead
            heading={section.heading}
            label="Contact"
            sample={section.sample}
            theme={theme}
            layout={layout}
          />
          <p className={`mt-6 text-base leading-relaxed text-pretty ${theme.body}`}>
            {section.body}
          </p>
          <p className={`mt-2 text-sm ${theme.muted}`}>{section.hoursNote}</p>
        </div>
        <div className={stacked ? "mt-8" : ""}>{card}</div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Closing call to action
// ---------------------------------------------------------------------------

function CallToAction({
  section,
  business,
  sections,
  theme,
  layout,
}: {
  section: Extract<DemoSection, { kind: "cta" }>;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  theme: DemoThemeTokens;
  layout: DemoLayout;
}) {
  const inner = (
    <>
      {section.sample ? <SampleTag theme={theme} className="mb-5" /> : null}
      <h2
        className={`text-3xl font-semibold tracking-tight text-balance sm:text-4xl ${theme.ctaHeading}`}
      >
        {section.heading}
      </h2>
      <p className={`mt-4 text-base leading-relaxed text-pretty ${theme.ctaBody}`}>
        {section.body}
      </p>
      <div className="mt-8">
        <CtaButton
          cta={section.cta}
          business={business}
          sections={sections}
          className={theme.ctaButton}
        />
      </div>
    </>
  );

  if (layout === "editorial") {
    // Boxed rather than full-bleed, so the page ends on a considered block
    // instead of a slab of colour.
    return (
      <section id={section.id} className={sectionPadding(layout)}>
        <div className={SHELL}>
          <div className={`rounded-3xl px-8 py-14 text-center sm:px-16 ${theme.ctaBand}`}>
            <div className="mx-auto max-w-2xl">{inner}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={section.id} className={theme.ctaBand}>
      <div
        className={`${SHELL} ${layout === "showcase" ? "py-24 sm:py-32" : "py-16 sm:py-20"} text-center`}
      >
        <div className="mx-auto max-w-2xl">{inner}</div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DemoSiteView({ spec }: { spec: DemoSiteSpec }) {
  const { business, content } = spec;
  const theme = DEMO_THEMES[content.theme];
  const { sections, layout } = content;

  // Alternate the band background so adjacent sections stay visually separated
  // whatever order the generator chose. Computed up front rather than mutated
  // during render.
  const banded = new Map<string, boolean>();
  content.sections
    .filter((s) => s.kind !== "hero" && s.kind !== "cta")
    .forEach((s, index) => banded.set(s.id, index % 2 === 0));

  const contactAnchor = fallbackAnchor(sections);
  const phoneHref = business.phone ? telHref(business.phone) : null;

  return (
    // `demo-root` scopes the type to this page; the two custom properties
    // choose the faces. See `fonts.ts` for why this is CSS rather than a
    // Tailwind arbitrary value.
    <div
      className={`demo-root min-h-screen ${theme.page}`}
      style={demoFontVars(content.theme)}
    >
      <header className={`sticky top-0 z-10 ${theme.nav}`}>
        <div className={`${SHELL} flex h-16 items-center justify-between gap-6`}>
          {/* The brand is the business name from application-owned facts. */}
          <a href={`#${sections[0].id}`} className={theme.brand}>
            {business.name}
          </a>

          <div className="flex items-center gap-4 sm:gap-7">
            <nav aria-label="Demo site" className="hidden items-center gap-7 md:flex">
              {content.navigation.map((item) => (
                <a
                  key={item.targetSectionId}
                  href={`#${item.targetSectionId}`}
                  className={`text-sm font-medium transition-colors ${theme.navLink}`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* A real site puts its main action in the bar, and KEEPS IT ON A
                PHONE. This used to sit inside the `md:` group with the links,
                so on mobile the header was a business name and nothing else --
                no navigation and, worse, no way to call. Local businesses are
                browsed on phones almost exclusively, so that was the one
                breakpoint where it had to work.

                Resolves to the stored number, or to the contact section when
                none was listed -- never to a dead `tel:`. */}
            <a
              href={phoneHref ?? `#${contactAnchor}`}
              className={`inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${theme.buttonPrimary}`}
            >
              {phoneHref ? "Call us" : "Get in touch"}
            </a>

            {/* The mobile menu. A `<details>` element rather than a state hook:
                this renderer is a Server Component and must stay one, and a
                disclosure is exactly what the browser already does natively.
                No JavaScript, so it works before hydration and without it. */}
            {content.navigation.length > 0 ? (
              <details className="relative md:hidden">
                <summary
                  aria-label="Open menu"
                  className={`flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg ${theme.navLink}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-5 w-5"
                  >
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </summary>

                <nav
                  aria-label="Demo site"
                  className={`absolute right-0 z-20 mt-2 w-52 rounded-xl p-2 shadow-lg ${theme.card}`}
                >
                  {content.navigation.map((item) => (
                    <a
                      key={item.targetSectionId}
                      href={`#${item.targetSectionId}`}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${theme.navLink}`}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </details>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        {sections.map((section) => {
          switch (section.kind) {
            case "hero":
              return (
                <Hero
                  key={section.id}
                  section={section}
                  business={business}
                  sections={sections}
                  theme={theme}
                  layout={layout}
                />
              );
            case "offering":
              return (
                <Offering
                  key={section.id}
                  section={section}
                  theme={theme}
                  layout={layout}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "positioning":
              return (
                <Positioning
                  key={section.id}
                  section={section}
                  theme={theme}
                  layout={layout}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "gallery":
              return (
                <Gallery
                  key={section.id}
                  section={section}
                  theme={theme}
                  layout={layout}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "contact":
              return (
                <Contact
                  key={section.id}
                  section={section}
                  business={business}
                  theme={theme}
                  layout={layout}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "cta":
              return (
                <CallToAction
                  key={section.id}
                  section={section}
                  business={business}
                  sections={sections}
                  theme={theme}
                  layout={layout}
                />
              );
          }
        })}
      </main>

      {/* A structured footer rather than one line. A real small-business site
          repeats the essentials at the bottom, and a demo that does not looks
          unfinished at exactly the point a visitor goes looking for them. */}
      <footer className={theme.footer}>
        <div className={`${SHELL} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
          <div className="lg:col-span-2">
            <p className={`text-lg font-semibold tracking-tight ${theme.heading}`}>
              {business.name}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">{content.footer.note}</p>
          </div>

          {content.navigation.length > 0 ? (
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase">Pages</p>
              <ul className="mt-3 space-y-2 text-sm">
                {content.navigation.map((item) => (
                  <li key={item.targetSectionId}>
                    <a
                      href={`#${item.targetSectionId}`}
                      className={`transition-colors ${theme.navLink}`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold tracking-wide uppercase">Contact</p>
            <ul className="mt-3 space-y-2 text-sm">
              {business.phone && phoneHref ? (
                <li>
                  <a href={phoneHref} className="underline underline-offset-4">
                    {business.phone}
                  </a>
                </li>
              ) : null}
              {business.address ? <li>{business.address}</li> : null}
              <li>{business.city}</li>
            </ul>
          </div>
        </div>

        <div className={`border-t ${theme.rule}`}>
          <div className={`${SHELL} py-6 text-xs`}>
            {business.name} — {business.city}
          </div>
        </div>
      </footer>
    </div>
  );
}
