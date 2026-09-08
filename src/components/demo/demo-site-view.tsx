import type {
  DemoCta,
  DemoSection,
  DemoSiteBusiness,
  DemoSiteSpec,
} from "@/lib/demo-site";

import { samplesForCategory } from "@/lib/demo-samples";

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
 *     lowercase slug and checked to match a section in this same spec.
 *
 * There is no code path by which generated content becomes a link to anywhere.
 *
 * ── FACTS ─────────────────────────────────────────────────────────────────
 *
 * The business name, phone and address rendered below are read from
 * `spec.business`, which application code copied from the lead. The generator's
 * content subtree has no field for any of them.
 *
 * Pure and synchronous, so it is directly renderable in a test.
 */

const SHELL = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const SECTION_PADDING = "py-16 sm:py-24";

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

function SectionHeading({
  children,
  theme,
  className = "",
}: {
  children: string;
  theme: DemoThemeTokens;
  className?: string;
}) {
  return (
    <h2
      className={`text-3xl font-semibold tracking-tight text-balance sm:text-4xl ${theme.heading} ${className}`}
    >
      {children}
    </h2>
  );
}

function Hero({
  section,
  business,
  sections,
  theme,
}: {
  section: Extract<DemoSection, { kind: "hero" }>;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  theme: DemoThemeTokens;
}) {
  return (
    <section id={section.id} className={`relative isolate overflow-hidden ${theme.hero}`}>
      {/* Decoration is CSS only. No external images are fetched, and no
          photograph of a business we have never seen is implied. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl ${theme.heroDecor}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-40 -left-32 h-[24rem] w-[24rem] rounded-full blur-3xl ${theme.heroDecor}`}
      />

      <div className={`${SHELL} relative py-20 sm:py-32`}>
        <p
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${theme.eyebrow}`}
        >
          {section.eyebrow}
        </p>
        {section.sample ? <SampleTag theme={theme} className="ml-2 align-middle" /> : null}

        <h1
          className={`mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl ${theme.display}`}
        >
          {section.heading}
        </h1>

        <p className={`mt-6 max-w-2xl text-lg leading-relaxed text-pretty ${theme.heroText}`}>
          {section.subheading}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
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
      </div>
    </section>
  );
}

function Offering({
  section,
  theme,
  banded,
}: {
  section: Extract<DemoSection, { kind: "offering" }>;
  theme: DemoThemeTokens;
  banded: boolean;
}) {
  return (
    <section id={section.id} className={`${SECTION_PADDING} ${banded ? theme.band : ""}`}>
      <div className={SHELL}>
        {section.sample ? <SampleTag theme={theme} className="mb-4" /> : null}
        <SectionHeading theme={theme}>{section.heading}</SectionHeading>
        <p className={`mt-4 max-w-2xl text-base leading-relaxed text-pretty ${theme.body}`}>
          {section.intro}
        </p>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item, index) => (
            <li key={item.title} className={`rounded-2xl p-7 ${theme.card}`}>
              <span
                aria-hidden="true"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${theme.marker}`}
              >
                {index + 1}
              </span>
              <h3 className={`mt-5 text-lg font-semibold ${theme.heading}`}>{item.title}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${theme.body}`}>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Positioning({
  section,
  theme,
  banded,
}: {
  section: Extract<DemoSection, { kind: "positioning" }>;
  theme: DemoThemeTokens;
  banded: boolean;
}) {
  return (
    <section id={section.id} className={`${SECTION_PADDING} ${banded ? theme.band : ""}`}>
      <div className={`${SHELL} grid gap-12 lg:grid-cols-2 lg:gap-20`}>
        <div>
          {section.sample ? <SampleTag theme={theme} className="mb-4" /> : null}
          <SectionHeading theme={theme}>{section.heading}</SectionHeading>
          <p className={`mt-6 text-base leading-relaxed text-pretty ${theme.body}`}>
            {section.body}
          </p>
        </div>

        <ul className="space-y-4 lg:pt-4">
          {section.points.map((point) => (
            <li key={point} className="flex gap-4">
              <span
                aria-hidden="true"
                className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${theme.marker}`}
              >
                ✓
              </span>
              <span className={`text-base leading-relaxed ${theme.body}`}>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Gallery({
  section,
  theme,
  banded,
}: {
  section: Extract<DemoSection, { kind: "gallery" }>;
  theme: DemoThemeTokens;
  banded: boolean;
}) {
  return (
    <section id={section.id} className={`${SECTION_PADDING} ${banded ? theme.band : ""}`}>
      <div className={SHELL}>
        {section.sample ? <SampleTag theme={theme} className="mb-4" /> : null}
        <SectionHeading theme={theme}>{section.heading}</SectionHeading>
        <p className={`mt-4 max-w-2xl text-base leading-relaxed text-pretty ${theme.body}`}>
          {section.body}
        </p>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.placeholders.map((placeholder) => (
            <li
              key={placeholder.label}
              className={`flex aspect-[4/3] items-end rounded-2xl p-5 ${theme.placeholder}`}
            >
              {/* A labelled CSS block, not a stock photograph standing in for
                  work we have not seen. */}
              <span className="text-xs font-medium tracking-wide uppercase">
                {placeholder.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

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

function Contact({
  section,
  business,
  theme,
  banded,
}: {
  section: Extract<DemoSection, { kind: "contact" }>;
  business: DemoSiteBusiness;
  theme: DemoThemeTokens;
  banded: boolean;
}) {
  const href = business.phone ? telHref(business.phone) : null;

  return (
    <section id={section.id} className={`${SECTION_PADDING} ${banded ? theme.band : ""}`}>
      <div className={`${SHELL} grid gap-12 lg:grid-cols-2 lg:gap-20`}>
        <div>
          {section.sample ? <SampleTag theme={theme} className="mb-4" /> : null}
          <SectionHeading theme={theme}>{section.heading}</SectionHeading>
          <p className={`mt-6 text-base leading-relaxed text-pretty ${theme.body}`}>
            {section.body}
          </p>
        </div>

        {/* Contact values come from spec.business -- application-owned facts
            copied from the lead. Nothing here was written by the generator. */}
        <dl className={`divide-y rounded-2xl p-7 ${theme.card} ${theme.rule}`}>
          <div className="pb-5">
            <dt className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>
              Phone
            </dt>
            <dd className={`mt-1 text-lg font-medium ${theme.heading}`}>
              {business.phone === null ? (
                // A neutral empty slot. "Not listed" is OUR vocabulary about a
                // provider record, and has no meaning to a visitor.
                <span className={theme.muted}>To be added</span>
              ) : href ? (
                <a href={href} className="underline underline-offset-4">
                  {business.phone}
                </a>
              ) : (
                business.phone
              )}
            </dd>
          </div>

          <div className="py-5">
            <dt className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>
              Address
            </dt>
            <dd className={`mt-1 text-base ${theme.body}`}>
              {business.address ?? <span className={theme.muted}>To be added</span>}
            </dd>
          </div>

          <div className="py-5">
            <dt className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>
              Opening hours
            </dt>
            {/* Real hours when the business published them on its own site and
                research read them there. Otherwise a plausible schedule for the
                category, rendered by APPLICATION code from `demo-samples.ts`
                and tagged as sample right here in the card.

                The distinction is the whole point. A blank line taught an owner
                nothing; a schedule presented as theirs would be the single worst
                thing a demo could show them. A schedule visibly labelled as a
                placeholder shows the design and asks the question.

                The generator never writes a time: `hoursNote` is prose, and the
                schema has no field a schedule could occupy. */}
            <dd className={`mt-1 text-base ${theme.body}`}>
              {business.openingHours.length > 0 ? (
                <ul>
                  {business.openingHours.map((entry, i) => (
                    <li key={i}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <ul className="tabular-nums">
                    {samplesForCategory(business.category).hours.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                  <SampleTag theme={theme} className="mt-3" />
                </>
              )}
            </dd>
          </div>

          {/* Omitted entirely when there is nothing to show. Phone and address
              stay visible when empty, because a blank there is a question the
              owner needs to answer; a business with no social presence has
              nothing to answer, and an empty row would just look unfinished. */}
          {business.socialLinks.length > 0 ? (
            <div className="pt-5">
              <dt className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>
                Follow
              </dt>
              <dd className={`mt-1 text-base ${theme.body}`}>
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
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

function CallToAction({
  section,
  business,
  sections,
  theme,
}: {
  section: Extract<DemoSection, { kind: "cta" }>;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  theme: DemoThemeTokens;
}) {
  return (
    <section id={section.id} className={theme.ctaBand}>
      <div className={`${SHELL} flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="max-w-2xl">
          {section.sample ? <SampleTag theme={theme} className="mb-4" /> : null}
          <h2
            className={`text-3xl font-semibold tracking-tight text-balance sm:text-4xl ${theme.ctaHeading}`}
          >
            {section.heading}
          </h2>
          <p className={`mt-4 text-base leading-relaxed text-pretty ${theme.ctaBody}`}>
            {section.body}
          </p>
        </div>
        <CtaButton
          cta={section.cta}
          business={business}
          sections={sections}
          className={`${theme.ctaButton} shrink-0`}
        />
      </div>
    </section>
  );
}

export function DemoSiteView({ spec }: { spec: DemoSiteSpec }) {
  const { business, content } = spec;
  const theme = DEMO_THEMES[content.theme];
  const { sections } = content;

  // Alternate the band background so adjacent sections stay visually separated
  // whatever order the generator chose. Computed up front rather than mutated
  // during render.
  const banded = new Map<string, boolean>();
  content.sections
    .filter((s) => s.kind !== "hero" && s.kind !== "cta")
    .forEach((s, index) => banded.set(s.id, index % 2 === 0));

  return (
    <div className={`min-h-screen ${theme.page}`}>
      <header className={`sticky top-0 z-10 ${theme.nav}`}>
        <div className={`${SHELL} flex h-16 items-center justify-between gap-6`}>
          {/* The brand is the business name from application-owned facts. */}
          <a href={`#${sections[0].id}`} className={theme.brand}>
            {business.name}
          </a>

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
                />
              );
            case "offering":
              return (
                <Offering
                  key={section.id}
                  section={section}
                  theme={theme}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "positioning":
              return (
                <Positioning
                  key={section.id}
                  section={section}
                  theme={theme}
                  banded={banded.get(section.id) ?? false}
                />
              );
            case "gallery":
              return (
                <Gallery
                  key={section.id}
                  section={section}
                  theme={theme}
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
                />
              );
          }
        })}
      </main>

      <footer className={theme.footer}>
        <div className={`${SHELL} flex flex-col gap-2 py-10 text-sm sm:flex-row sm:items-center sm:justify-between`}>
          <p>
            {business.name} — {business.city}
          </p>
          <p className="text-xs">{content.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
