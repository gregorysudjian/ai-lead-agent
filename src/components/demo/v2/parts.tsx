import type { CSSProperties, ReactNode } from "react";

import type { DemoDesign, Emphasis, MotifKey } from "@/lib/demo-design/types";
import type { DemoCta, DemoSection, DemoSiteBusiness } from "@/lib/demo-site";

import { telHref } from "../demo-site-view";
import { TileArt } from "./art";
import type { Words } from "./words";

/**
 * Pieces every new-generation section shares.
 *
 * The honesty rules live here once, so no section can quietly bend them:
 * a call button only ever dials the stored number, and sample content is
 * always tagged in place.
 */

/** The in-page marker on a section whose copy is placeholder. Driven by `section.sample`. */
export function SampleTag({ words, className = "" }: { words: Words; className?: string }) {
  return (
    <span className={`dx-sample ${className}`} title={words.sampleTitle}>
      {words.sample}
    </span>
  );
}

/** Where a non-call CTA points: the contact section, or the first one. */
function fallbackAnchor(sections: DemoSection[]): string {
  const contact = sections.find((s) => s.kind === "contact");
  return contact ? contact.id : sections[0].id;
}

/**
 * A call to action, resolved by application code.
 *
 * `call` dials the stored number; with none, it becomes an in-page link to
 * the contact section rather than a dead `tel:` or an invented number. The
 * other actions are in-page anchors. The generator only ever chose a label.
 */
export function Cta({
  cta,
  business,
  sections,
  ghost = false,
  className = "",
}: {
  cta: DemoCta;
  business: DemoSiteBusiness;
  sections: DemoSection[];
  ghost?: boolean;
  className?: string;
}) {
  const style = `dx-btn ${ghost ? "dx-btn-ghost" : ""} ${className}`;
  const label = (
    <>
      {cta.label}
      <svg aria-hidden="true" viewBox="0 0 16 16" className="dx-btn-arrow h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  if (cta.action === "call") {
    const href = business.phone ? telHref(business.phone) : null;
    if (href) {
      return (
        <a href={href} className={style} data-magnetic="">
          {label}
        </a>
      );
    }
  }
  return (
    <a href={`#${cta.targetSectionId ?? fallbackAnchor(sections)}`} className={style} data-magnetic="">
      {label}
    </a>
  );
}

/** "01 — Services": the editorial index above a section heading. */
export function SectionLabel({ index, label, className = "" }: { index: number; label: string; className?: string }) {
  return (
    <p className={`dx-label dx-accent-text flex items-center gap-3 ${className}`}>
      <span className="tabular-nums">{String(index).padStart(2, "0")}</span>
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-60" />
      <span>{label}</span>
    </p>
  );
}

const EMPHASIS_CLASS: Record<Emphasis, string> = {
  italic: "dx-em-italic",
  accent: "dx-em-accent",
  outline: "dx-em-outline",
  none: "",
};

/**
 * A heading whose words rise in on load, with its closing words emphasised.
 *
 * Split into words on the server, so the animation needs no JavaScript and a
 * browser under reduced motion simply shows the words. The emphasised words
 * are the last one or two -- a purely typographic choice about text the page
 * already says, never a change to it.
 */
/**
 * The spaces a line may break at. NOT `\s`, which in JavaScript also matches
 * the non-breaking space -- and French sets one before "?" precisely so the
 * mark never starts a line. Splitting on `\s` threw it away, and "Envie de
 * changement ?" put the question mark alone on the last line.
 */
const BREAKABLE_SPACE = /[ \t\n\r]+/;

/**
 * A font size for giant type that the longest word can actually fit.
 *
 * Giant type is sized by the viewport, which is right for "Dru" and wrong for
 * "ST-LAURENT": a word wider than the page wraps wherever the browser may
 * break it, and a hyphenated name then leaves "ST-" alone on a line. So the
 * size is capped at what the longest word needs to fit in ~80% of the width,
 * with a per-character width that is wider for upper case.
 */
export function fitGiant(text: string, upper: boolean): CSSProperties {
  const longest = Math.max(1, ...text.split(BREAKABLE_SPACE).map((word) => word.length));
  const perChar = upper ? 0.7 : 0.6;
  return { fontSize: `min(clamp(3.4rem, 13.5vw, 13rem), ${(80 / (longest * perChar)).toFixed(2)}vw)` };
}

export function Heading({
  text,
  as: Tag = "h2",
  className = "",
  emphasis,
  animate = false,
  style,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  emphasis: Emphasis;
  animate?: boolean;
  style?: CSSProperties;
}) {
  const words = text.split(BREAKABLE_SPACE).filter(Boolean);
  const tail = words.length >= 3 && (words[words.length - 1]?.length ?? 0) <= 4 ? 2 : 1;
  const emphasisFrom = words.length > 1 ? words.length - tail : words.length;

  return (
    <Tag className={`dx-display ${className}`} style={style} aria-label={animate ? text : undefined}>
      {words.map((word, i) => {
        const emphasised = i >= emphasisFrom && emphasis !== "none";
        const inner = <span className={emphasised ? EMPHASIS_CLASS[emphasis] : undefined}>{word}</span>;
        return animate ? (
          <span key={i} aria-hidden="true" className="dx-line mr-[0.22em] inline-block align-bottom last:mr-0">
            <span style={{ "--i": i } as CSSProperties}>{inner}</span>
          </span>
        ) : (
          <span key={i}>
            {inner}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </Tag>
  );
}

/**
 * Where a real photograph will go, said plainly.
 *
 * Generative art inside, an honest label on top. The label is the page's own
 * words ("Your storefront"), not copy about the business.
 */
export function PhotoSlot({
  label,
  design,
  index,
  className = "",
  labelEnd = false,
  scope,
  children,
}: {
  label: string;
  design: DemoDesign;
  index: number;
  className?: string;
  /** Put the label in the bottom-RIGHT corner, for slots whose left edge is overlapped. */
  labelEnd?: boolean;
  /** See TileArt: set when the same slot is rendered twice on one page. */
  scope?: string;
  children?: ReactNode;
}) {
  return (
    <figure className={`dx-photo ${className}`}>
      <div className="absolute inset-0">
        <TileArt motif={design.motif as MotifKey} palette={design.palette} seed={design.seed} index={index} scope={scope} />
      </div>
      {children}
      <figcaption className="dx-photo-label" data-end={labelEnd ? "" : undefined}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2.5" y="5" width="15" height="11" rx="2" />
          <circle cx="10" cy="10.5" r="3" />
          <path d="M7 5l1.2-2h3.6L13 5" />
        </svg>
        {label}
      </figcaption>
    </figure>
  );
}
