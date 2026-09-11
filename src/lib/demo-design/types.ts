/**
 * The vocabulary of a generated site's design.
 *
 * Every visual decision is one of these closed sets or a validated colour.
 * The renderer owns what each name MEANS -- the grid, the sizes, the motion
 * curves -- exactly as CLAUDE.md requires of the older theme and layout names.
 * What changed is how many names there are and who chooses them: application
 * code, from facts about the business, never a generator.
 */

export const ART_DIRECTIONS = [
  "editorial",
  "luxe-noir",
  "soft-organic",
  "swiss",
  "retro-poster",
  "brutalist",
  "gallery",
  "botanical",
  "pop",
  "deco",
] as const;
export type ArtDirectionKey = (typeof ART_DIRECTIONS)[number];

/** Display faces. Each is self-hosted through next/font in `components/demo/v2/fonts.ts`. */
export const DISPLAY_FONTS = [
  "instrument-serif",
  "playfair",
  "fraunces",
  "dm-serif",
  "newsreader",
  "young-serif",
  "gloock",
  "cormorant",
  "bodoni",
  "italiana",
  "marcellus",
  "anton",
  "bebas",
  "space-grotesk",
  "archivo",
  "inter-tight",
  "bricolage",
  "syne",
  "unbounded",
  "outfit",
  "abril",
  "poiret",
  "limelight",
  "space-mono",
] as const;
export type DisplayFontKey = (typeof DISPLAY_FONTS)[number];

/** Body faces: few, and all built for long reading. Variety belongs in display type. */
export const BODY_FONTS = ["inter", "jakarta", "dm-sans", "manrope", "work-sans"] as const;
export type BodyFontKey = (typeof BODY_FONTS)[number];

export const HERO_VARIANTS = ["wordmark", "split", "poster", "monogram", "editorial", "stack"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const SERVICES_VARIANTS = ["sticky-stack", "bento", "index", "rail"] as const;
export type ServicesVariant = (typeof SERVICES_VARIANTS)[number];

export const ABOUT_VARIANTS = ["statement", "split", "stamps"] as const;
export type AboutVariant = (typeof ABOUT_VARIANTS)[number];

export const GALLERY_VARIANTS = ["parallax", "rail", "mosaic"] as const;
export type GalleryVariant = (typeof GALLERY_VARIANTS)[number];

export const CONTACT_VARIANTS = ["board", "split", "card"] as const;
export type ContactVariant = (typeof CONTACT_VARIANTS)[number];

export const CTA_VARIANTS = ["giant", "band", "marquee"] as const;
export type CtaVariant = (typeof CTA_VARIANTS)[number];

export const NAV_VARIANTS = ["pill", "split", "minimal"] as const;
export type NavVariant = (typeof NAV_VARIANTS)[number];

export const FOOTER_VARIANTS = ["wordmark", "columns"] as const;
export type FooterVariant = (typeof FOOTER_VARIANTS)[number];

/**
 * Decorative motifs for generative art.
 *
 * The first group are drawn from each trade's own tools, so a barber's art is
 * made of razors and a florist's of petals. The second are abstract, used by
 * directions that want geometry rather than illustration. None of them is ever
 * a picture of the business, and all of them are aria-hidden.
 */
export const MOTIFS = [
  "shears",
  "comb",
  "razor",
  "pole",
  "drop",
  "gem",
  "petal",
  "ink",
  "star",
  "leaf",
  "wheat",
  "cup",
  "bloom",
  "cross",
  "tooth",
  "gear",
  "bolt",
  "arcs",
  "grid",
  "waves",
  "orbs",
  "sunburst",
] as const;
export type MotifKey = (typeof MOTIFS)[number];

/** How much the page moves. A spa floats; a barber snaps. */
export const MOTION_LEVELS = ["calm", "lively", "bold"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

export const RADII = ["none", "soft", "round"] as const;
export type Radius = (typeof RADII)[number];

/** The page's ground: a near-white, a near-black, or a pastel tint. */
export const GROUNDS = ["light", "dark", "tint"] as const;
export type Ground = (typeof GROUNDS)[number];

/** How display type is set. */
export const DISPLAY_CASES = ["normal", "upper"] as const;
export type DisplayCase = (typeof DISPLAY_CASES)[number];

/** How one word of a heading is emphasised. */
export const EMPHASES = ["italic", "accent", "outline", "none"] as const;
export type Emphasis = (typeof EMPHASES)[number];

/**
 * A resolved palette. Every value is `#rrggbb`, stored rather than recomputed,
 * so improving the palette engine later can never recolour a site that has
 * already been shown to someone.
 */
export const PALETTE_KEYS = [
  "bg",
  "bgAlt",
  "surface",
  "ink",
  "muted",
  "line",
  "accent",
  "onAccent",
  "accentText",
  "accentSoft",
  "invert",
  "onInvert",
  "invertMuted",
  "invertAccent",
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type DemoPalette = Record<PaletteKey, string>;

/** The complete design of one generated site. */
export interface DemoDesign {
  /** Genome format. A change of meaning is a new version, never a silent edit. */
  version: 1;
  /** 32-bit seed derived from the business and the variant. */
  seed: number;
  /** "Try another design" increments this; 0 is the business's first design. */
  variant: number;
  direction: ArtDirectionKey;
  ground: Ground;
  palette: DemoPalette;
  fonts: { display: DisplayFontKey; body: BodyFontKey };
  displayCase: DisplayCase;
  emphasis: Emphasis;
  nav: NavVariant;
  hero: HeroVariant;
  services: ServicesVariant;
  about: AboutVariant;
  gallery: GalleryVariant;
  contact: ContactVariant;
  cta: CtaVariant;
  footer: FooterVariant;
  motif: MotifKey;
  motion: MotionLevel;
  radius: Radius;
  /** Whether a ticker of services runs between sections. */
  marquee: boolean;
}
