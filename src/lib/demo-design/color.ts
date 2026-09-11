/**
 * Colour for generated sites: OKLCH in, contrast-checked hex out.
 *
 * ── WHY OKLCH ─────────────────────────────────────────────────────────────
 *
 * Palettes are generated, not picked from a list, so the space they are
 * generated in has to behave. In HSL, "lightness 50%" is a bright yellow and a
 * murky blue; step the hue and the perceived brightness lurches. OKLCH is
 * perceptually uniform: hold L and C, turn H, and every hue reads as equally
 * light and equally vivid. That is what lets a direction say "a muted accent,
 * any hue in this range" and mean it for every seed.
 *
 * ── WHY THE CONTRAST FIXER ────────────────────────────────────────────────
 *
 * A generated palette is only acceptable if its text is readable. Rather than
 * hoping every seed lands well, `ensureContrast` walks a colour's lightness
 * away from its background until it meets the WCAG ratio it needs. The walk is
 * deterministic, so the same seed always produces the same palette.
 *
 * The maths is Björn Ottosson's OKLab, and WCAG 2.x relative luminance.
 * Pure: no I/O, never throws.
 */

export interface Oklch {
  /** Lightness, 0-1. */
  l: number;
  /** Chroma, 0-~0.37 for sRGB. */
  c: number;
  /** Hue, degrees. */
  h: number;
}

type Rgb = [number, number, number];

function oklchToLinearSrgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const EPSILON = 1e-4;

function inGamut(rgb: Rgb): boolean {
  return rgb.every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON);
}

/**
 * Pull a colour into sRGB by reducing chroma, keeping lightness and hue.
 *
 * Clipping channels instead would shift the hue -- a saturated blue clipped
 * turns purple -- so chroma is binary-searched down until the colour fits.
 */
export function toGamut(color: Oklch): Oklch {
  const clamped: Oklch = { l: Math.min(1, Math.max(0, color.l)), c: Math.max(0, color.c), h: color.h };
  if (inGamut(oklchToLinearSrgb(clamped))) return clamped;

  let low = 0;
  let high = clamped.c;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb({ ...clamped, c: mid }))) low = mid;
    else high = mid;
  }
  return { ...clamped, c: low };
}

function gammaEncode(channel: number): number {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function gammaDecode(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** `#rrggbb` for a colour, mapped into gamut first. */
export function toHex(color: Oklch): string {
  const [r, g, b] = oklchToLinearSrgb(toGamut(color)).map(gammaEncode);
  const byte = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

const HEX = /^#[0-9a-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => gammaDecode(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1-21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The colour, moved in lightness until it meets `min` contrast against `bg`.
 *
 * Walks away from the background: darker on a light ground, lighter on a
 * dark one. Hue and chroma are kept, so an accent stays recognisably itself --
 * a deep teal rather than a teal-flavoured grey. Returns the hex.
 */
export function ensureContrast(color: Oklch, bg: string, min: number): string {
  const bgIsLight = relativeLuminance(bg) > 0.18;
  const step = bgIsLight ? -0.01 : 0.01;
  let candidate = { ...color };

  for (let i = 0; i < 100; i += 1) {
    const hex = toHex(candidate);
    if (contrastRatio(hex, bg) >= min) return hex;
    const l = candidate.l + step;
    if (l <= 0 || l >= 1) break;
    candidate = { ...candidate, l };
  }
  // At the end of the walk the colour is black or white, which meets every
  // ratio we ask for against any background we generate.
  return bgIsLight ? "#000000" : "#ffffff";
}

/** Whichever of near-black and near-white reads better on `bg`. */
export function inkFor(bg: string, dark = "#111111", light = "#ffffff"): string {
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}
