import type { DemoDesign } from "@/lib/demo-design/types";
import type { DemoSiteBusiness, DemoSiteContent } from "@/lib/demo-site";
import { formatPhone, phoneHref } from "@/lib/phone";

import type { Words } from "./words";

/**
 * The site's own navigation and footer.
 *
 * Every nav carries the language switch -- a plain link, so it needs no
 * JavaScript -- and a call button that dials the stored number, or jumps to
 * the contact section when none was listed. The mobile menu is a <details>
 * element, so the renderer stays a Server Component and the menu works before
 * hydration.
 */

interface ChromeProps {
  content: DemoSiteContent;
  business: DemoSiteBusiness;
  design: DemoDesign;
  words: Words;
  brand: string;
  /** Link to this page in the other language, or null to hide the switch. */
  langHref: string | null;
  /** The other language's short code, shown on the switch. */
  otherLocale: string;
}

/**
 * The pages the menu lists. The closing call-to-action is left out: its
 * heading ("Get in touch") duplicated the Contact link, and the nav already
 * carries a call button.
 */
function navItems(content: DemoSiteContent) {
  return content.navigation.filter((item) => {
    const target = content.sections.find((s) => s.id === item.targetSectionId);
    return target !== undefined && target.kind !== "cta" && target.kind !== "hero";
  });
}

function contactAnchor(content: DemoSiteContent): string {
  return content.sections.find((s) => s.kind === "contact")?.id ?? content.sections[0].id;
}

function CallButton({
  content,
  business,
  words,
  className = "",
}: {
  content: DemoSiteContent;
  business: DemoSiteBusiness;
  words: Words;
  className?: string;
}) {
  const hero = content.sections.find((s) => s.kind === "hero");
  const href = business.phone ? phoneHref(business.phone) : null;
  const label = hero && hero.kind === "hero" && hero.primaryCta.action === "call" && href ? hero.primaryCta.label : null;
  return (
    <a href={href ?? `#${contactAnchor(content)}`} className={`dx-btn shrink-0 !px-5 !py-3 !text-sm ${className}`} data-magnetic="">
      {label ?? (href ? formatPhone(business.phone as string) : hero && hero.kind === "hero" ? hero.primaryCta.label : words.contact)}
    </a>
  );
}

function LangSwitch({ langHref, otherLocale, words }: { langHref: string | null; otherLocale: string; words: Words }) {
  if (langHref === null) return null;
  return (
    <a href={langHref} className="dx-lang" hrefLang={otherLocale} lang={otherLocale} title={words.switchTo}>
      {otherLocale}
    </a>
  );
}

function MobileMenu({ content, words }: { content: DemoSiteContent; words: Words }) {
  if (navItems(content).length === 0) return null;
  return (
    <details className="dx-menu relative md:hidden">
      <summary className="dx-lang" aria-label={words.menu}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
        </svg>
      </summary>
      <nav aria-label={words.menu} className="dx-menu-panel">
        {navItems(content).map((item) => (
          <a key={item.targetSectionId} href={`#${item.targetSectionId}`} className="dx-nav-link block">
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}

export function Nav(props: ChromeProps) {
  const { content, business, design, words, brand, langHref, otherLocale } = props;
  const links = (
    <nav aria-label={words.pages} className="hidden items-center gap-1 md:flex">
      {navItems(content).map((item) => (
        <a key={item.targetSectionId} href={`#${item.targetSectionId}`} className="dx-nav-link">
          {item.label}
        </a>
      ))}
    </nav>
  );
  const brandLink = (
    <a href={`#${content.sections[0].id}`} className="dx-brand" data-long={brand.length > 18 ? "" : undefined}>
      {brand}
    </a>
  );

  if (design.nav === "pill") {
    return (
      <header className="dx-nav">
        <div className="dx-shell dx-nav-inner">
          {brandLink}
          <div className="dx-nav-pill hidden md:flex">
            {navItems(content).map((item) => (
              <a key={item.targetSectionId} href={`#${item.targetSectionId}`} className="dx-nav-link">
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch langHref={langHref} otherLocale={otherLocale} words={words} />
            <MobileMenu content={content} words={words} />
            <CallButton content={content} business={business} words={words} className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>
    );
  }

  if (design.nav === "minimal") {
    return (
      <header className="dx-nav dx-nav-condense">
        <div className="dx-shell dx-nav-inner">
          {brandLink}
          <div className="flex items-center gap-2">
            <LangSwitch langHref={langHref} otherLocale={otherLocale} words={words} />
            <details className="dx-menu relative">
              <summary className="dx-lang gap-2 !px-3">
                <span className="hidden sm:inline">{words.menu}</span>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 7h14M3 13h14" strokeLinecap="round" />
                </svg>
              </summary>
              <nav aria-label={words.pages} className="dx-menu-panel">
                {navItems(content).map((item) => (
                  <a key={item.targetSectionId} href={`#${item.targetSectionId}`} className="dx-nav-link block">
                    {item.label}
                  </a>
                ))}
              </nav>
            </details>
            <CallButton content={content} business={business} words={words} className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>
    );
  }

  // split
  return (
    <header className="dx-nav dx-nav-condense">
      <div className="dx-shell dx-nav-inner">
        {brandLink}
        {links}
        <div className="flex items-center gap-2">
          <LangSwitch langHref={langHref} otherLocale={otherLocale} words={words} />
          <MobileMenu content={content} words={words} />
          <CallButton content={content} business={business} words={words} className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}

/**
 * The footer: the essentials again, and -- on wordmark footers -- the name
 * across the full width.
 *
 * The FULL listed name appears here even when the logo uses the shorter brand,
 * and so does the data credit a licence requires: OpenStreetMap's ODbL or
 * Overture's CDLA-Permissive 2.0, never presented as the other.
 */
export function Footer(props: ChromeProps) {
  const { content, business, design, words, brand } = props;
  const tel = business.phone ? phoneHref(business.phone) : null;
  const credit = business.source === "osm" ? words.credit.osm : business.source === "overture" ? words.credit.overture : null;

  const columns = (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <p className="dx-display text-3xl leading-tight">{brand}</p>
        <p className="dx-muted mt-3 max-w-sm">{content.footer.note}</p>
      </div>
      {navItems(content).length > 0 ? (
        <div>
          <p className="dx-label dx-muted">{words.pages}</p>
          <ul className="mt-4 space-y-2">
            {navItems(content).map((item) => (
              <li key={item.targetSectionId}>
                <a href={`#${item.targetSectionId}`} className="hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="dx-label dx-muted">{words.contact}</p>
        <ul className="mt-4 space-y-2">
          {business.phone ? (
            <li>
              {tel ? (
                <a href={tel} className="tabular-nums hover:underline">
                  {formatPhone(business.phone)}
                </a>
              ) : (
                business.phone
              )}
            </li>
          ) : null}
          {business.address ? <li>{business.address}</li> : null}
          <li>{business.city}</li>
        </ul>
      </div>
    </div>
  );

  const baseline = (
    <div className="dx-rule dx-small dx-muted mt-14 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-between">
      <span>
        {business.name} — {business.city}
      </span>
      {credit ? <span>{credit}</span> : null}
    </div>
  );

  if (design.footer === "wordmark") {
    return (
      <footer className="dx-inverted overflow-hidden pt-20">
        <div className="dx-shell">
          {columns}
          {baseline}
        </div>
        <p aria-hidden="true" className="dx-display dx-reveal mt-10 w-full overflow-hidden px-2 text-center leading-[0.8] whitespace-nowrap" style={{ fontSize: `clamp(3rem, ${Math.max(6, Math.min(22, 150 / Math.max(brand.length, 1)))}vw, 18rem)`, color: "var(--dx-invert-accent)" }}>
          {brand}
        </p>
      </footer>
    );
  }

  return (
    <footer className="dx-band py-16">
      <div className="dx-shell">
        {columns}
        {baseline}
      </div>
    </footer>
  );
}
