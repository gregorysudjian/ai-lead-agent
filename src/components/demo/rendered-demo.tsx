import { contentFor, type DemoSiteSpec } from "@/lib/demo-site";
import { asLocale, type Locale } from "@/lib/locale";

import { DemoSiteView } from "./demo-site-view";
import { DemoSiteV2 } from "./v2/site";

/**
 * A stored demo, drawn with the renderer it was generated for.
 *
 * The one place that decides between the two, so the internal preview and
 * the public share page can never disagree about what a demo looks like.
 *
 *   - A spec WITHOUT a design was generated before designs existed. It is
 *     drawn by the original renderer, in English, exactly as it was when it
 *     was generated and perhaps shown to someone. Old demos are never
 *     silently redesigned.
 *   - A spec WITH a design is drawn by the new renderer, from that stored
 *     design -- not recomputed -- so later changes to the design code cannot
 *     change a page a business has already seen.
 */

/**
 * The language a demo can actually be shown in.
 *
 * French when asked for (or by default) and the demo HAS a French page;
 * English otherwise. An English-only demo never shows French chrome around
 * English copy.
 */
export function demoLocale(spec: DemoSiteSpec, requested: unknown): Locale {
  if (!spec.design || !spec.alternates?.fr) return "en";
  return asLocale(requested);
}

export function RenderedDemo({
  spec,
  locale,
  basePath,
}: {
  spec: DemoSiteSpec;
  /** From `demoLocale`. */
  locale: Locale;
  /** This page's path without a query: the language switch links back to it. */
  basePath: string;
}) {
  if (!spec.design) return <DemoSiteView spec={spec} />;

  // French is the default, so French is the bare path and English the query.
  const otherHref = locale === "fr" ? `${basePath}?lang=en` : basePath;
  return (
    <DemoSiteV2
      business={spec.business}
      content={contentFor(spec, locale)}
      design={spec.design}
      locale={locale}
      langHref={spec.alternates?.fr ? otherHref : null}
    />
  );
}
