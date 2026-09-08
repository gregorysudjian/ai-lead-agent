import { Archivo, Fraunces, Inter, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";

import type { DemoTheme } from "@/lib/demo-site";

/**
 * Typefaces for demo sites.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Every demo rendered in the dashboard's own font, and the themes that wanted
 * a serif asked for `font-serif` -- the generic system serif, which is Times
 * on one machine and something else on the next. So five themes shared one
 * typographic voice, and that is a large part of why the sites read as one
 * template. Type is the first thing that makes a page look like a real brand.
 *
 * ── HOW ───────────────────────────────────────────────────────────────────
 *
 * `next/font/google` downloads and SELF-HOSTS these at build time. The
 * rendered page makes no request to Google, which matters here: a demo page
 * fetches nothing from a third party, and the same rule that keeps stock
 * imagery off these pages keeps runtime font requests off them too. The
 * dashboard already loads Geist this way, so this is the established pattern
 * rather than a new dependency.
 *
 * All five are variable fonts, so no weight list is needed and the download
 * stays one file per family.
 *
 * ── CHOICES ───────────────────────────────────────────────────────────────
 *
 * One body face for every theme, and a display face that carries the theme's
 * character. Inter throughout the body keeps long copy readable and stops the
 * pages differing in ways that hurt rather than help -- the variety belongs in
 * the headings, the layout and the palette, not in the paragraph text.
 */

const inter = Inter({ subsets: ["latin"], variable: "--demo-font-inter", display: "swap" });

/** Warm, slightly rustic serif. Bakeries, cafes, traditional trades. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--demo-font-fraunces",
  display: "swap",
});

/** High-contrast serif. Reads expensive -- beauty, nails, florists. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--demo-font-playfair",
  display: "swap",
});

/** Wide, heavy grotesque. Barbers, gyms, garages. */
const archivo = Archivo({ subsets: ["latin"], variable: "--demo-font-archivo", display: "swap" });

/** Friendly geometric sans. Dentists, pharmacies -- approachable, not clinical. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--demo-font-jakarta",
  display: "swap",
});

/**
 * Attach to an ancestor of the demo page so the font variables resolve.
 *
 * Every family is declared here rather than per theme, because which theme a
 * demo uses is known at render time and `next/font` must be called at module
 * scope. The unused families cost nothing at runtime -- a CSS variable that
 * nothing references does not load its font file.
 */
export const DEMO_FONT_VARIABLES = [
  inter.variable,
  fraunces.variable,
  playfair.variable,
  archivo.variable,
  jakarta.variable,
].join(" ");

/** The display face each theme uses. Body is Inter throughout. */
const DISPLAY_BY_THEME: Record<DemoTheme, string> = {
  "warm-classic": "var(--demo-font-fraunces)",
  "elegant-dark": "var(--demo-font-playfair)",
  "bold-contrast": "var(--demo-font-archivo)",
  "fresh-modern": "var(--demo-font-jakarta)",
  // Restrained on purpose: this theme's whole idea is that nothing shouts.
  "calm-minimal": "var(--demo-font-inter)",
};

/**
 * The custom properties to set on the demo page root.
 *
 * Returned as a plain object so the renderer can spread it into `style`.
 *
 * Plain CSS rather than a Tailwind arbitrary-value font utility. That would
 * work, but a class Tailwind fails to emit fails SILENTLY, and a font that
 * quietly does not apply is the sort of thing nobody notices.
 *
 * Note the syntax is deliberately NOT written out anywhere in this codebase.
 * Tailwind v4 scans comments as well as code, so a syntactically valid
 * arbitrary value inside a comment is emitted as a real rule -- documenting
 * that utility with an ellipsis standing in for the variable produced
 * `font-family: var(…)` in the stylesheet and broke every page.
 */
export function demoFontVars(theme: DemoTheme): Record<string, string> {
  return {
    "--demo-display": DISPLAY_BY_THEME[theme],
    "--demo-body": "var(--demo-font-inter)",
  };
}
