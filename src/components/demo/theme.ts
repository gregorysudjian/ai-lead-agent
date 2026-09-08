import type { DemoTheme } from "@/lib/demo-site";

/**
 * Application-owned visual tokens for demo sites.
 *
 * A generator picks a theme NAME from a closed set. Every colour, gradient,
 * radius and type treatment behind that name is written here, by us. No CSS,
 * class name or colour value ever crosses the generator boundary, so generated
 * output cannot restyle the page, hide content, or introduce a rule that
 * behaves differently from what a reviewer saw.
 *
 * Class strings are complete literals rather than assembled fragments, because
 * Tailwind only emits classes it can see spelled out in source.
 */
export interface DemoThemeTokens {
  /** Fixed light/dark identity of the demo itself -- it is a customer's site,
   *  not part of our dashboard, so it does not follow the viewer's theme. */
  page: string;
  nav: string;
  brand: string;
  navLink: string;
  hero: string;
  heroDecor: string;
  eyebrow: string;
  display: string;
  heroText: string;
  buttonPrimary: string;
  buttonSecondary: string;
  band: string;
  heading: string;
  body: string;
  muted: string;
  card: string;
  marker: string;
  placeholder: string;
  ctaBand: string;
  ctaHeading: string;
  ctaBody: string;
  ctaButton: string;
  footer: string;
  rule: string;
  /** The small marker on a section carrying sample content. */
  sampleTag: string;
  /** Container for a service icon. Quieter than `marker`, which is filled. */
  iconWrap: string;
  /** Accent text, for rules, numerals and small labels in editorial layouts. */
  accent: string;
  /** A hairline rule in the accent colour. */
  accentRule: string;
  /**
   * Divider colour for `divide-y` lists.
   *
   * Separate from `rule` because they are different CSS properties. `rule` is
   * a border-color on the element itself; `divide-*` sets a border on the
   * CHILDREN, and border-color does not inherit -- so without this the
   * dividers fall back to currentColor and read far too heavy.
   */
  divide: string;
}

export const DEMO_THEMES: Record<DemoTheme, DemoThemeTokens> = {
  "warm-classic": {
    page: "bg-[#fdf9f3] text-stone-800",
    nav: "border-b border-stone-200/80 bg-[#fdf9f3]/85 backdrop-blur",
    brand: "font-serif text-lg font-semibold tracking-tight text-stone-900",
    navLink: "text-stone-600 hover:text-amber-800",
    hero: "bg-gradient-to-b from-[#f6e7d0] via-[#fdf9f3] to-[#fdf9f3]",
    heroDecor: "bg-amber-200/45",
    eyebrow: "bg-amber-100 text-amber-900 ring-1 ring-amber-300/70",
    display: "font-serif text-stone-900",
    heroText: "text-stone-700",
    buttonPrimary: "bg-amber-800 text-amber-50 hover:bg-amber-900",
    buttonSecondary: "border border-stone-300 bg-white/70 text-stone-800 hover:bg-white",
    band: "bg-[#f7f0e6]",
    heading: "font-serif text-stone-900",
    body: "text-stone-700",
    muted: "text-stone-500",
    card: "border border-stone-200 bg-white shadow-sm",
    marker: "bg-amber-800 text-amber-50",
    placeholder: "bg-gradient-to-br from-amber-200/70 to-stone-200 text-stone-600",
    ctaBand: "bg-stone-900",
    ctaHeading: "font-serif text-amber-50",
    ctaBody: "text-stone-300",
    ctaButton: "bg-amber-400 text-stone-900 hover:bg-amber-300",
    footer: "border-t border-stone-200 bg-[#f7f0e6] text-stone-600",
    rule: "border-stone-200",
    sampleTag: "bg-stone-200/80 text-stone-600 ring-1 ring-stone-300/70",
    iconWrap: "bg-amber-100/80 text-amber-900 ring-1 ring-amber-200/80",
    accent: "text-amber-800",
    accentRule: "bg-amber-700/40",
    divide: "divide-stone-200",
  },

  "fresh-modern": {
    page: "bg-white text-slate-700",
    nav: "border-b border-slate-200/80 bg-white/85 backdrop-blur",
    brand: "text-lg font-bold tracking-tight text-slate-900",
    navLink: "text-slate-600 hover:text-teal-700",
    hero: "bg-gradient-to-br from-teal-50 via-white to-emerald-50",
    heroDecor: "bg-teal-300/35",
    eyebrow: "bg-teal-50 text-teal-800 ring-1 ring-teal-200",
    display: "text-slate-900",
    heroText: "text-slate-600",
    buttonPrimary: "bg-teal-700 text-white hover:bg-teal-800",
    buttonSecondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    band: "bg-slate-50",
    heading: "text-slate-900",
    body: "text-slate-600",
    muted: "text-slate-500",
    card: "border border-slate-200 bg-white shadow-sm",
    marker: "bg-teal-700 text-white",
    placeholder: "bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-800",
    ctaBand: "bg-teal-700",
    ctaHeading: "text-white",
    ctaBody: "text-teal-50",
    ctaButton: "bg-white text-teal-800 hover:bg-teal-50",
    footer: "border-t border-slate-200 bg-slate-50 text-slate-600",
    rule: "border-slate-200",
    sampleTag: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    iconWrap: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    accent: "text-teal-700",
    accentRule: "bg-teal-600/40",
    divide: "divide-slate-200",
  },

  "bold-contrast": {
    page: "bg-neutral-50 text-neutral-800",
    nav: "border-b-2 border-neutral-900 bg-neutral-50/90 backdrop-blur",
    brand: "text-lg font-black tracking-tight text-neutral-900 uppercase",
    navLink: "font-medium text-neutral-700 hover:text-neutral-950",
    hero: "bg-neutral-900",
    heroDecor: "bg-lime-400/25",
    eyebrow: "bg-lime-400 text-neutral-900",
    display: "text-neutral-50",
    heroText: "text-neutral-300",
    buttonPrimary: "bg-lime-400 text-neutral-900 hover:bg-lime-300",
    buttonSecondary: "border-2 border-neutral-100 text-neutral-100 hover:bg-neutral-800",
    band: "bg-white",
    heading: "text-neutral-900",
    body: "text-neutral-700",
    muted: "text-neutral-500",
    card: "border-2 border-neutral-900 bg-white",
    marker: "bg-neutral-900 text-lime-400",
    placeholder: "bg-neutral-200 text-neutral-700",
    ctaBand: "bg-lime-400",
    ctaHeading: "text-neutral-900",
    ctaBody: "text-neutral-800",
    ctaButton: "bg-neutral-900 text-lime-400 hover:bg-neutral-800",
    footer: "border-t-2 border-neutral-900 bg-neutral-50 text-neutral-700",
    rule: "border-neutral-300",
    sampleTag: "bg-neutral-200 text-neutral-700 ring-1 ring-neutral-400",
    iconWrap: "bg-neutral-900 text-lime-400",
    accent: "text-neutral-900",
    accentRule: "bg-neutral-900",
    divide: "divide-neutral-300",
  },

  "calm-minimal": {
    page: "bg-white text-slate-700",
    nav: "border-b border-slate-100 bg-white/85 backdrop-blur",
    brand: "text-lg font-semibold tracking-tight text-slate-900",
    navLink: "text-slate-500 hover:text-indigo-700",
    hero: "bg-gradient-to-b from-slate-50 to-white",
    heroDecor: "bg-indigo-200/35",
    eyebrow: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    display: "text-slate-900",
    heroText: "text-slate-600",
    buttonPrimary: "bg-slate-900 text-white hover:bg-slate-800",
    buttonSecondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    band: "bg-slate-50/70",
    heading: "text-slate-900",
    body: "text-slate-600",
    muted: "text-slate-400",
    card: "border border-slate-100 bg-white shadow-sm",
    marker: "bg-indigo-600 text-white",
    placeholder: "bg-gradient-to-br from-slate-100 to-indigo-100 text-slate-600",
    ctaBand: "bg-slate-900",
    ctaHeading: "text-white",
    ctaBody: "text-slate-300",
    ctaButton: "bg-white text-slate-900 hover:bg-slate-100",
    footer: "border-t border-slate-100 bg-white text-slate-500",
    rule: "border-slate-100",
    sampleTag: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    iconWrap: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
    accent: "text-indigo-700",
    accentRule: "bg-indigo-500/35",
    divide: "divide-slate-100",
  },

  "elegant-dark": {
    page: "bg-zinc-950 text-zinc-300",
    nav: "border-b border-white/10 bg-zinc-950/85 backdrop-blur",
    brand: "font-serif text-lg font-semibold tracking-tight text-zinc-50",
    navLink: "text-zinc-400 hover:text-amber-200",
    hero: "bg-gradient-to-br from-zinc-900 via-zinc-950 to-black",
    heroDecor: "bg-amber-400/15",
    eyebrow: "bg-white/5 text-amber-200 ring-1 ring-amber-200/30",
    display: "font-serif text-zinc-50",
    heroText: "text-zinc-400",
    buttonPrimary: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
    buttonSecondary: "border border-white/20 text-zinc-100 hover:bg-white/10",
    band: "bg-zinc-900/60",
    heading: "font-serif text-zinc-50",
    body: "text-zinc-400",
    muted: "text-zinc-500",
    card: "border border-white/10 bg-white/5",
    marker: "bg-amber-300 text-zinc-950",
    placeholder: "bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-400",
    ctaBand: "bg-amber-300",
    ctaHeading: "font-serif text-zinc-950",
    ctaBody: "text-zinc-800",
    ctaButton: "bg-zinc-950 text-amber-200 hover:bg-zinc-900",
    footer: "border-t border-white/10 bg-zinc-950 text-zinc-500",
    rule: "border-white/10",
    sampleTag: "bg-white/10 text-zinc-400 ring-1 ring-white/15",
    iconWrap: "bg-white/5 text-amber-200 ring-1 ring-amber-200/25",
    accent: "text-amber-200",
    accentRule: "bg-amber-200/40",
    divide: "divide-white/10",
  },
};
