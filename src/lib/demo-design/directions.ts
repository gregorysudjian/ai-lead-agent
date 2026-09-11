import type {
  AboutVariant,
  ArtDirectionKey,
  BodyFontKey,
  ContactVariant,
  CtaVariant,
  DisplayCase,
  DisplayFontKey,
  Emphasis,
  FooterVariant,
  GalleryVariant,
  Ground,
  HeroVariant,
  MotifKey,
  MotionLevel,
  NavVariant,
  Radius,
  ServicesVariant,
} from "./types";

/**
 * Art directions: what makes a generated site coherent.
 *
 * ── WHY DIRECTIONS AND NOT FREE COMBINATION ───────────────────────────────
 *
 * Uniqueness is easy: pick every choice at random and no two sites match. It
 * also produces sites nobody would design -- a condensed poster face over a
 * pastel blob hero with a luxury gold rule. What separates a designed page
 * from a generated one is that its choices agree with each other.
 *
 * So each direction is a small design system: the faces, grounds, accent
 * range, section treatments and motion that belong together. The seed chooses
 * WITHIN a direction and never across them. The number of directions times
 * the choices inside each is what gives variety; the boundaries are what keep
 * each site looking deliberate.
 *
 * ── COLOUR RECIPES ────────────────────────────────────────────────────────
 *
 * Accents are OKLCH ranges: hue windows, and the chroma and lightness a
 * direction's accent lives at. Luxe accents are low-chroma golds and deep
 * jewels; pop accents are loud; editorial accents are quiet inks. The palette
 * engine derives everything else from the chosen accent and ground, and the
 * contrast fixer guarantees the text is readable whatever the seed picks.
 */

export interface ArtDirection {
  key: ArtDirectionKey;
  label: string;
  grounds: readonly Ground[];
  /** Accent hue windows, in degrees. One is chosen, then a hue inside it. */
  hues: readonly (readonly [number, number])[];
  accentChroma: readonly [number, number];
  accentLightness: readonly [number, number];
  /** How much of the accent tints the ground and the ink. 0 = neutral. */
  tint: number;
  displayFonts: readonly DisplayFontKey[];
  bodyFonts: readonly BodyFontKey[];
  displayCase: readonly DisplayCase[];
  emphasis: readonly Emphasis[];
  nav: readonly NavVariant[];
  heroes: readonly HeroVariant[];
  services: readonly ServicesVariant[];
  about: readonly AboutVariant[];
  gallery: readonly GalleryVariant[];
  contact: readonly ContactVariant[];
  cta: readonly CtaVariant[];
  footer: readonly FooterVariant[];
  /** Abstract motifs this direction may use instead of the trade's own. */
  motifs: readonly MotifKey[];
  motion: readonly MotionLevel[];
  radius: readonly Radius[];
  /** Probability of a services ticker. */
  marquee: number;
}

export const DIRECTIONS: Record<ArtDirectionKey, ArtDirection> = {
  editorial: {
    key: "editorial",
    label: "Editorial serif",
    grounds: ["light", "tint"],
    hues: [
      [20, 50],
      [140, 170],
      [230, 260],
      [340, 360],
    ],
    accentChroma: [0.06, 0.12],
    accentLightness: [0.42, 0.55],
    tint: 0.3,
    displayFonts: ["instrument-serif", "playfair", "newsreader", "dm-serif"],
    bodyFonts: ["inter", "dm-sans"],
    displayCase: ["normal"],
    emphasis: ["italic"],
    nav: ["split", "minimal"],
    heroes: ["editorial", "split", "wordmark"],
    services: ["index", "sticky-stack"],
    about: ["statement", "split"],
    gallery: ["parallax", "mosaic"],
    contact: ["split", "board"],
    cta: ["giant", "band"],
    footer: ["wordmark", "columns"],
    motifs: ["arcs", "waves"],
    motion: ["calm", "lively"],
    radius: ["none", "soft"],
    marquee: 0.3,
  },
  "luxe-noir": {
    key: "luxe-noir",
    label: "Luxe noir",
    grounds: ["dark"],
    hues: [
      [60, 90],
      [20, 40],
      [150, 175],
      [300, 330],
    ],
    accentChroma: [0.05, 0.11],
    accentLightness: [0.72, 0.84],
    tint: 0.2,
    displayFonts: ["cormorant", "bodoni", "italiana", "marcellus"],
    bodyFonts: ["manrope", "inter"],
    displayCase: ["normal", "upper"],
    emphasis: ["italic", "accent"],
    nav: ["minimal", "split"],
    heroes: ["monogram", "editorial", "wordmark", "split"],
    services: ["index", "sticky-stack", "rail"],
    about: ["statement", "split"],
    gallery: ["parallax", "rail"],
    contact: ["board", "split"],
    cta: ["giant", "band"],
    footer: ["wordmark"],
    motifs: ["arcs", "sunburst", "orbs"],
    motion: ["calm"],
    radius: ["none", "soft"],
    marquee: 0.25,
  },
  "soft-organic": {
    key: "soft-organic",
    label: "Soft organic",
    grounds: ["tint", "light"],
    hues: [
      [0, 30],
      [280, 330],
      [160, 200],
      [60, 90],
    ],
    accentChroma: [0.08, 0.14],
    accentLightness: [0.5, 0.62],
    tint: 0.8,
    displayFonts: ["fraunces", "outfit", "young-serif", "bricolage"],
    bodyFonts: ["dm-sans", "jakarta"],
    displayCase: ["normal"],
    emphasis: ["italic", "accent"],
    nav: ["pill", "split"],
    heroes: ["split", "monogram", "stack"],
    services: ["bento", "sticky-stack", "rail"],
    about: ["split", "stamps"],
    gallery: ["mosaic", "parallax"],
    contact: ["card", "split"],
    cta: ["band", "giant"],
    footer: ["columns", "wordmark"],
    motifs: ["orbs", "waves"],
    motion: ["calm", "lively"],
    radius: ["round"],
    marquee: 0.35,
  },
  swiss: {
    key: "swiss",
    label: "Swiss grid",
    grounds: ["light"],
    hues: [
      [20, 35],
      [250, 270],
      [140, 160],
      [45, 70],
    ],
    accentChroma: [0.15, 0.22],
    accentLightness: [0.5, 0.62],
    tint: 0,
    displayFonts: ["space-grotesk", "inter-tight", "archivo", "bricolage"],
    bodyFonts: ["inter", "manrope"],
    displayCase: ["normal", "upper"],
    emphasis: ["accent", "none"],
    nav: ["split", "minimal"],
    heroes: ["wordmark", "split", "poster"],
    services: ["index", "bento", "rail"],
    about: ["split", "statement"],
    gallery: ["mosaic", "rail"],
    contact: ["board", "split"],
    cta: ["giant", "marquee"],
    footer: ["columns", "wordmark"],
    motifs: ["grid", "arcs"],
    motion: ["lively", "bold"],
    radius: ["none"],
    marquee: 0.5,
  },
  "retro-poster": {
    key: "retro-poster",
    label: "Retro poster",
    grounds: ["tint", "light"],
    hues: [
      [20, 45],
      [200, 230],
      [85, 105],
      [140, 160],
    ],
    accentChroma: [0.13, 0.19],
    accentLightness: [0.5, 0.6],
    tint: 0.45,
    displayFonts: ["anton", "bebas", "abril", "archivo"],
    bodyFonts: ["work-sans", "dm-sans"],
    displayCase: ["upper"],
    emphasis: ["accent", "outline"],
    nav: ["split", "pill"],
    heroes: ["poster", "wordmark", "stack"],
    services: ["bento", "rail", "index"],
    about: ["stamps", "statement"],
    gallery: ["mosaic", "rail"],
    contact: ["board", "card"],
    cta: ["marquee", "band"],
    footer: ["wordmark", "columns"],
    motifs: ["sunburst", "waves", "star"],
    motion: ["lively", "bold"],
    radius: ["soft", "none"],
    marquee: 0.8,
  },
  brutalist: {
    key: "brutalist",
    label: "Brutalist",
    grounds: ["light", "dark"],
    hues: [
      [120, 135],
      [260, 275],
      [25, 35],
      [95, 110],
    ],
    accentChroma: [0.2, 0.26],
    accentLightness: [0.62, 0.9],
    tint: 0,
    displayFonts: ["archivo", "space-mono", "unbounded", "anton"],
    bodyFonts: ["inter", "work-sans"],
    displayCase: ["upper"],
    emphasis: ["outline", "accent"],
    nav: ["split", "minimal"],
    heroes: ["poster", "wordmark", "stack"],
    services: ["index", "rail", "bento"],
    about: ["statement", "stamps"],
    gallery: ["rail", "mosaic"],
    contact: ["board"],
    cta: ["marquee", "giant"],
    footer: ["wordmark"],
    motifs: ["grid", "bolt"],
    motion: ["bold"],
    radius: ["none"],
    marquee: 0.9,
  },
  gallery: {
    key: "gallery",
    label: "Minimal gallery",
    grounds: ["light", "dark"],
    hues: [
      [0, 360],
    ],
    accentChroma: [0.02, 0.06],
    accentLightness: [0.4, 0.6],
    tint: 0,
    displayFonts: ["instrument-serif", "inter-tight", "space-grotesk", "gloock"],
    bodyFonts: ["inter", "manrope"],
    displayCase: ["normal"],
    emphasis: ["italic", "none"],
    nav: ["minimal", "split"],
    heroes: ["editorial", "split", "wordmark"],
    services: ["index", "rail"],
    about: ["statement", "split"],
    gallery: ["parallax", "rail", "mosaic"],
    contact: ["split", "card"],
    cta: ["giant"],
    footer: ["columns", "wordmark"],
    motifs: ["grid", "arcs"],
    motion: ["calm"],
    radius: ["none"],
    marquee: 0.1,
  },
  botanical: {
    key: "botanical",
    label: "Botanical",
    grounds: ["tint", "light", "dark"],
    hues: [
      [120, 160],
      [70, 95],
      [20, 40],
    ],
    accentChroma: [0.07, 0.13],
    accentLightness: [0.42, 0.56],
    tint: 0.6,
    displayFonts: ["fraunces", "cormorant", "young-serif", "newsreader"],
    bodyFonts: ["dm-sans", "manrope"],
    displayCase: ["normal"],
    emphasis: ["italic"],
    nav: ["split", "pill"],
    heroes: ["split", "editorial", "monogram"],
    services: ["sticky-stack", "bento", "index"],
    about: ["split", "statement"],
    gallery: ["parallax", "mosaic"],
    contact: ["card", "split"],
    cta: ["band", "giant"],
    footer: ["columns", "wordmark"],
    motifs: ["leaf", "petal", "waves"],
    motion: ["calm", "lively"],
    radius: ["round", "soft"],
    marquee: 0.3,
  },
  pop: {
    key: "pop",
    label: "Pop colour",
    grounds: ["tint"],
    hues: [
      [0, 25],
      [290, 320],
      [240, 265],
      [170, 190],
      [60, 80],
    ],
    accentChroma: [0.17, 0.24],
    accentLightness: [0.55, 0.66],
    tint: 1,
    displayFonts: ["syne", "unbounded", "outfit", "bricolage"],
    bodyFonts: ["jakarta", "dm-sans"],
    displayCase: ["normal", "upper"],
    emphasis: ["accent", "outline"],
    nav: ["pill"],
    heroes: ["stack", "poster", "split", "wordmark"],
    services: ["bento", "rail", "sticky-stack"],
    about: ["stamps", "split"],
    gallery: ["mosaic", "rail"],
    contact: ["card", "board"],
    cta: ["marquee", "band"],
    footer: ["wordmark", "columns"],
    motifs: ["orbs", "star", "sunburst"],
    motion: ["lively", "bold"],
    radius: ["round"],
    marquee: 0.75,
  },
  deco: {
    key: "deco",
    label: "Art deco",
    grounds: ["dark", "tint"],
    hues: [
      [150, 175],
      [255, 275],
      [10, 25],
      [70, 90],
    ],
    accentChroma: [0.08, 0.13],
    accentLightness: [0.66, 0.8],
    tint: 0.5,
    displayFonts: ["poiret", "limelight", "italiana", "bodoni"],
    bodyFonts: ["manrope", "inter"],
    displayCase: ["upper", "normal"],
    emphasis: ["accent", "italic"],
    nav: ["split", "minimal"],
    heroes: ["monogram", "poster", "editorial"],
    services: ["index", "sticky-stack"],
    about: ["statement", "stamps"],
    gallery: ["mosaic", "parallax"],
    contact: ["board", "split"],
    cta: ["band", "giant"],
    footer: ["wordmark", "columns"],
    motifs: ["sunburst", "arcs"],
    motion: ["calm", "lively"],
    radius: ["none", "soft"],
    marquee: 0.3,
  },
};

/**
 * Which directions suit which trade, with weights.
 *
 * Written against the categories the app actually stores. A tattoo studio is
 * never offered pastel; a nail salon is never offered brutalist. Weights make
 * the most fitting directions commoner without making any one inevitable --
 * a street of salons should not be all editorial.
 */
const BY_TRADE: Record<string, readonly (readonly [ArtDirectionKey, number])[]> = {
  "hair-salon": [
    ["editorial", 3],
    ["gallery", 2],
    ["soft-organic", 2],
    ["pop", 2],
    ["luxe-noir", 2],
    ["swiss", 1],
    ["deco", 1],
  ],
  barber: [
    ["retro-poster", 3],
    ["luxe-noir", 2],
    ["swiss", 2],
    ["brutalist", 2],
    ["deco", 2],
    ["editorial", 1],
  ],
  "beauty-salon": [
    ["editorial", 2],
    ["luxe-noir", 2],
    ["soft-organic", 3],
    ["botanical", 2],
    ["gallery", 2],
    ["deco", 1],
  ],
  "nail-salon": [
    ["soft-organic", 3],
    ["pop", 3],
    ["luxe-noir", 2],
    ["deco", 2],
    ["editorial", 1],
  ],
  tattoo: [
    ["brutalist", 3],
    ["luxe-noir", 3],
    ["retro-poster", 2],
    ["gallery", 2],
    ["swiss", 1],
  ],
  bakery: [
    ["editorial", 2],
    ["retro-poster", 2],
    ["soft-organic", 2],
    ["botanical", 1],
  ],
  cafe: [
    ["editorial", 2],
    ["retro-poster", 2],
    ["botanical", 2],
    ["pop", 1],
  ],
  restaurant: [
    ["editorial", 2],
    ["luxe-noir", 2],
    ["retro-poster", 2],
    ["deco", 1],
  ],
  florist: [
    ["botanical", 3],
    ["editorial", 2],
    ["soft-organic", 2],
    ["gallery", 1],
  ],
  dentist: [
    ["swiss", 3],
    ["soft-organic", 2],
    ["gallery", 1],
  ],
  pharmacy: [
    ["swiss", 3],
    ["soft-organic", 2],
  ],
  gym: [
    ["brutalist", 3],
    ["swiss", 2],
    ["retro-poster", 2],
    ["pop", 1],
  ],
  "car-repair": [
    ["swiss", 3],
    ["brutalist", 2],
    ["retro-poster", 2],
  ],
};

/** For a category we have no opinion about: safe, readable directions. */
const DEFAULT_DIRECTIONS: readonly (readonly [ArtDirectionKey, number])[] = [
  ["editorial", 2],
  ["swiss", 2],
  ["soft-organic", 1],
];

export function directionsForTrade(tradeKey: string | null): readonly (readonly [ArtDirectionKey, number])[] {
  return (tradeKey !== null && BY_TRADE[tradeKey]) || DEFAULT_DIRECTIONS;
}

/** The trade's own motifs: what its art is drawn from. */
const TRADE_MOTIFS: Record<string, readonly MotifKey[]> = {
  "hair-salon": ["shears", "comb", "drop"],
  barber: ["razor", "pole", "shears", "comb"],
  "beauty-salon": ["drop", "petal", "star"],
  "nail-salon": ["gem", "drop", "star"],
  tattoo: ["ink", "star", "bolt"],
  bakery: ["wheat", "sunburst"],
  cafe: ["cup", "waves"],
  restaurant: ["sunburst", "waves"],
  florist: ["bloom", "petal", "leaf"],
  dentist: ["tooth", "drop"],
  pharmacy: ["cross", "drop"],
  gym: ["bolt", "grid"],
  "car-repair": ["gear", "bolt"],
};

export function motifsForTrade(tradeKey: string | null): readonly MotifKey[] {
  return (tradeKey !== null && TRADE_MOTIFS[tradeKey]) || ["arcs", "orbs"];
}

/** Every trade key the mapping knows, for tests. */
export const MAPPED_TRADES: readonly string[] = Object.keys(BY_TRADE);
