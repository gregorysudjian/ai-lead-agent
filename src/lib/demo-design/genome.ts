import { resolveSupportedCategory } from "../osm/categories";
import { normalizeTerm } from "../normalize";
import { brandName } from "./brand";
import { isHexColor } from "./color";
import { DIRECTIONS, directionsForTrade, motifsForTrade } from "./directions";
import { paletteFor, type Random } from "./palette";
import {
  ABOUT_VARIANTS,
  ART_DIRECTIONS,
  BODY_FONTS,
  CONTACT_VARIANTS,
  CTA_VARIANTS,
  DISPLAY_CASES,
  DISPLAY_FONTS,
  EMPHASES,
  FOOTER_VARIANTS,
  GALLERY_VARIANTS,
  GROUNDS,
  HERO_VARIANTS,
  MOTIFS,
  MOTION_LEVELS,
  NAV_VARIANTS,
  PALETTE_KEYS,
  RADII,
  SERVICES_VARIANTS,
  type DemoDesign,
  type HeroVariant,
} from "./types";

/**
 * The design genome: one business in, one complete, coherent design out.
 *
 * ── DETERMINISTIC ─────────────────────────────────────────────────────────
 *
 * The seed is a hash of the business's normalised name, category and address,
 * plus a variant number. The same business therefore always gets the same
 * design -- regenerating never silently redesigns a site that was shown to
 * someone -- while two salons on one street, or two branches of one chain at
 * different addresses, differ. "Try another design" increments the variant.
 *
 * ── APPLICATION-OWNED ─────────────────────────────────────────────────────
 *
 * Nothing here reads prose. A generator -- mock or model -- never chooses a
 * font, a colour or a layout; it writes words, and this decides how they look
 * from facts: the trade picks the directions, the name picks inside them.
 * CLAUDE.md's "a category is a fact; prose is a bad thing to pattern match",
 * applied to every visual choice rather than two.
 *
 * Pure: no I/O, no clock, no Math.random.
 */

export interface DesignSubject {
  name: string;
  category: string;
  address: string | null;
}

/** FNV-1a, 32-bit. Stable across machines and runtimes, unlike a JS object hash. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32: a tiny seeded generator with good distribution for this use.
 *
 * Exported so generative art draws from the same seed as the rest of the
 * design: the same business always gets the same drawing.
 */
export function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Random, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function weighted<T>(rng: Random, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1][0];
}

export function designSeed(subject: DesignSubject, variant: number): number {
  return fnv1a(
    [normalizeTerm(subject.name), normalizeTerm(subject.category), normalizeTerm(subject.address ?? ""), variant].join("|"),
  );
}

/**
 * Heroes that set the brand name enormous cannot hold a long one.
 *
 * "Klyne Beauty" fills a wordmark hero beautifully; a 30-character brand in
 * 14vw type breaks across four lines and stops being a wordmark. Long brands
 * get the heroes whose type is sized for a sentence.
 */
const LONG_BRAND = 22;
const NAME_HEROES: readonly HeroVariant[] = ["wordmark", "poster"];

export function designFor(subject: DesignSubject, variant = 0): DemoDesign {
  const seed = designSeed(subject, variant);
  const rng = mulberry32(seed);

  const trade = resolveSupportedCategory(subject.category)?.key ?? null;
  const direction = DIRECTIONS[weighted(rng, directionsForTrade(trade))];

  const ground = pick(rng, direction.grounds);
  const palette = paletteFor(direction, ground, rng);

  const longBrand = brandName(subject.name).length > LONG_BRAND;
  const heroChoices = longBrand
    ? direction.heroes.filter((hero) => !NAME_HEROES.includes(hero))
    : direction.heroes;

  // The trade's own tools are the usual motif; now and then a direction's
  // abstract geometry instead, so art varies inside a trade too.
  const motif = rng() < 0.7 ? pick(rng, motifsForTrade(trade)) : pick(rng, direction.motifs);

  return {
    version: 1,
    seed,
    variant,
    direction: direction.key,
    ground,
    palette,
    fonts: { display: pick(rng, direction.displayFonts), body: pick(rng, direction.bodyFonts) },
    displayCase: pick(rng, direction.displayCase),
    emphasis: pick(rng, direction.emphasis),
    nav: pick(rng, direction.nav),
    hero: pick(rng, heroChoices.length > 0 ? heroChoices : ["split", "editorial"]),
    services: pick(rng, direction.services),
    about: pick(rng, direction.about),
    gallery: pick(rng, direction.gallery),
    contact: pick(rng, direction.contact),
    cta: pick(rng, direction.cta),
    footer: pick(rng, direction.footer),
    motif,
    motion: pick(rng, direction.motion),
    radius: pick(rng, direction.radius),
    marquee: rng() < direction.marquee,
  };
}

// ---------------------------------------------------------------------------
// Validation on read
// ---------------------------------------------------------------------------

export class DemoDesignError extends Error {
  constructor(problem: string) {
    super(`Invalid demo design: ${problem}.`);
    this.name = "DemoDesignError";
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new DemoDesignError(`${field} is not one of the known values`);
  }
  return value as T;
}

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new DemoDesignError(`${field} must be an integer from ${min} to ${max}`);
  }
  return value;
}

/**
 * A stored design, checked field by field.
 *
 * Every name must be in its closed set and every colour a `#rrggbb` hex, so a
 * design read back from the database can only ever select things the renderer
 * was built to draw. Nothing in it becomes a class name or a style string
 * without passing through here.
 */
export function validateDemoDesign(value: unknown): DemoDesign {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DemoDesignError("must be an object");
  }
  const d = value as Record<string, unknown>;
  if (d.version !== 1) throw new DemoDesignError("version is not 1");

  const paletteIn = d.palette as Record<string, unknown> | null;
  if (typeof paletteIn !== "object" || paletteIn === null) throw new DemoDesignError("palette is missing");
  const palette = {} as DemoDesign["palette"];
  for (const key of PALETTE_KEYS) {
    const colour = paletteIn[key];
    if (!isHexColor(colour)) throw new DemoDesignError(`palette.${key} is not a #rrggbb colour`);
    palette[key] = colour;
  }

  const fontsIn = d.fonts as Record<string, unknown> | null;
  if (typeof fontsIn !== "object" || fontsIn === null) throw new DemoDesignError("fonts is missing");
  if (typeof d.marquee !== "boolean") throw new DemoDesignError("marquee must be a boolean");

  return {
    version: 1,
    seed: integer(d.seed, "seed", 0, 0xffffffff),
    variant: integer(d.variant, "variant", 0, 9999),
    direction: oneOf(d.direction, ART_DIRECTIONS, "direction"),
    ground: oneOf(d.ground, GROUNDS, "ground"),
    palette,
    fonts: {
      display: oneOf(fontsIn.display, DISPLAY_FONTS, "fonts.display"),
      body: oneOf(fontsIn.body, BODY_FONTS, "fonts.body"),
    },
    displayCase: oneOf(d.displayCase, DISPLAY_CASES, "displayCase"),
    emphasis: oneOf(d.emphasis, EMPHASES, "emphasis"),
    nav: oneOf(d.nav, NAV_VARIANTS, "nav"),
    hero: oneOf(d.hero, HERO_VARIANTS, "hero"),
    services: oneOf(d.services, SERVICES_VARIANTS, "services"),
    about: oneOf(d.about, ABOUT_VARIANTS, "about"),
    gallery: oneOf(d.gallery, GALLERY_VARIANTS, "gallery"),
    contact: oneOf(d.contact, CONTACT_VARIANTS, "contact"),
    cta: oneOf(d.cta, CTA_VARIANTS, "cta"),
    footer: oneOf(d.footer, FOOTER_VARIANTS, "footer"),
    motif: oneOf(d.motif, MOTIFS, "motif"),
    motion: oneOf(d.motion, MOTION_LEVELS, "motion"),
    radius: oneOf(d.radius, RADII, "radius"),
    marquee: d.marquee,
  };
}

/**
 * What a visitor would SEE as different, for the uniqueness test.
 *
 * Not the seed -- two seeds can produce designs nobody could tell apart. The
 * direction, the hero, the display face, the section treatments, the ground
 * and the accent's hue family are what make two pages look like two sites.
 */
export function visibleFingerprint(design: DemoDesign): string {
  const hueFamily = design.palette.accent; // resolved colour, compared coarsely below
  const r = parseInt(hueFamily.slice(1, 3), 16) >> 5;
  const g = parseInt(hueFamily.slice(3, 5), 16) >> 5;
  const b = parseInt(hueFamily.slice(5, 7), 16) >> 5;
  return [
    design.direction,
    design.hero,
    design.fonts.display,
    design.services,
    design.gallery,
    design.ground,
    `${r}${g}${b}`,
  ].join("|");
}
