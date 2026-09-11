import {
  Abril_Fatface,
  Anton,
  Archivo,
  Bebas_Neue,
  Bodoni_Moda,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Gloock,
  Instrument_Serif,
  Inter,
  Inter_Tight,
  Italiana,
  Limelight,
  Manrope,
  Marcellus,
  Newsreader,
  Outfit,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Poiret_One,
  Space_Grotesk,
  Space_Mono,
  Syne,
  Unbounded,
  Work_Sans,
  Young_Serif,
} from "next/font/google";

import type { BodyFontKey, DisplayFontKey } from "@/lib/demo-design/types";

/**
 * Typefaces for new-generation demo sites.
 *
 * Self-hosted through `next/font`: downloaded at BUILD time and served by us,
 * so a demo page makes no request to Google, which CLAUDE.md requires of every
 * demo asset.
 *
 * `preload: false` on every family, deliberately. A page uses exactly two of
 * these; preloading would make every demo page download all twenty-nine. With
 * preload off, a family's file is fetched only when an element actually uses
 * it, and `display: swap` keeps text visible while it arrives.
 *
 * Every family here is a KEY in `lib/demo-design/types.ts`. The genome can
 * only name a face that exists in this file, and `fonts.test.ts` fails if the
 * two lists ever drift apart.
 */

// Options are written out in full on every call: the next/font loader reads
// them at build time and accepts only literal objects -- no spread, no shared
// constant.

const instrumentSerif = Instrument_Serif({ subsets: ["latin"], display: "swap", preload: false, weight: "400", style: ["normal", "italic"], variable: "--dx-f-instrument-serif" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-playfair" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-fraunces" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: "400", style: ["normal", "italic"], variable: "--dx-f-dm-serif" });
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-newsreader" });
const youngSerif = Young_Serif({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-young-serif" });
const gloock = Gloock({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-gloock" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-cormorant" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-bodoni" });
const italiana = Italiana({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-italiana" });
const marcellus = Marcellus({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-marcellus" });
const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-anton" });
const bebas = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-bebas" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-space-grotesk" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-archivo" });
const interTight = Inter_Tight({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-inter-tight" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-bricolage" });
const syne = Syne({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-syne" });
const unbounded = Unbounded({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-unbounded" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-outfit" });
const abril = Abril_Fatface({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-abril" });
const poiret = Poiret_One({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-poiret" });
const limelight = Limelight({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--dx-f-limelight" });
const spaceMono = Space_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--dx-f-space-mono" });

const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-jakarta" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--dx-f-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-manrope" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--dx-f-work-sans" });

const DISPLAY: Record<DisplayFontKey, { variable: string }> = {
  "instrument-serif": instrumentSerif,
  playfair,
  fraunces,
  "dm-serif": dmSerif,
  newsreader,
  "young-serif": youngSerif,
  gloock,
  cormorant,
  bodoni,
  italiana,
  marcellus,
  anton,
  bebas,
  "space-grotesk": spaceGrotesk,
  archivo,
  "inter-tight": interTight,
  bricolage,
  syne,
  unbounded,
  outfit,
  abril,
  poiret,
  limelight,
  "space-mono": spaceMono,
};

const BODY: Record<BodyFontKey, { variable: string }> = {
  inter,
  jakarta,
  "dm-sans": dmSans,
  manrope,
  "work-sans": workSans,
};

/** Every family's variable class, for the page wrapper. Unused ones load nothing. */
export const V2_FONT_VARIABLES = [...Object.values(DISPLAY), ...Object.values(BODY)]
  .map((font) => font.variable)
  .join(" ");

/** The CSS custom property each face is exposed as. */
export function displayFontVar(key: DisplayFontKey): string {
  return `var(--dx-f-${key})`;
}

export function bodyFontVar(key: BodyFontKey): string {
  return `var(--dx-f-${key})`;
}

/** Keys that have a family wired here, for the drift test. */
export const WIRED_DISPLAY_FONTS = Object.keys(DISPLAY) as DisplayFontKey[];
export const WIRED_BODY_FONTS = Object.keys(BODY) as BodyFontKey[];
