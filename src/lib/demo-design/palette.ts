import { contrastRatio, ensureContrast, inkFor, toHex, type Oklch } from "./color";
import type { ArtDirection } from "./directions";
import type { DemoPalette, Ground } from "./types";

/**
 * A complete, readable palette from one direction, one ground and a seed.
 *
 * The seed picks an accent inside the direction's window; every other colour
 * is derived from that accent and the ground, then walked by `ensureContrast`
 * until it meets the ratio its job needs:
 *
 *   ink on every ground          7:1   (WCAG AAA body text)
 *   muted text on every ground   4.5:1 (AA)
 *   accent used as text          4.5:1
 *   text on the accent           4.5:1
 *   text on the inverted band    4.5:1, and 3:1 for the band's accent
 *
 * `palette.test.ts` runs this across thousands of seeds for every direction
 * and ground, so "every palette is readable" is a tested fact, not a hope.
 */

export type Random = () => number;

function between(rng: Random, [min, max]: readonly [number, number]): number {
  return min + rng() * (max - min);
}

function pick<T>(rng: Random, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** The better of two candidates for `fg` on a background, as hex. */
function readable(candidate: Oklch, bg: string, min: number): string {
  return ensureContrast(candidate, bg, min);
}

/** A colour that must read on SEVERAL backgrounds: fix against each in turn. */
function readableOnAll(candidate: Oklch, grounds: string[], min: number): string {
  let hex = readable(candidate, grounds[0], min);
  for (let pass = 0; pass < 3; pass += 1) {
    const failing = grounds.find((ground) => contrastRatio(hex, ground) < min);
    if (!failing) return hex;
    hex = readable(hexToOklchApprox(hex, candidate), failing, min);
  }
  return hex;
}

/**
 * Re-enter the fixer from an already-fixed hex.
 *
 * `ensureContrast` works in OKLCH; after a first pass we only need to keep
 * walking in the same direction, so the original hue and chroma are reused and
 * the lightness is estimated from the hex's luminance. Precise inversion is not
 * needed -- the fixer verifies every step it takes against the real ratio.
 */
function hexToOklchApprox(hex: string, original: Oklch): Oklch {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lightness = Math.cbrt(0.2126 * r ** 2.2 + 0.7152 * g ** 2.2 + 0.0722 * b ** 2.2);
  return { ...original, l: Math.min(1, Math.max(0, lightness)) };
}

export function paletteFor(direction: ArtDirection, ground: Ground, rng: Random): DemoPalette {
  const window = pick(rng, direction.hues);
  const hue = between(rng, window) % 360;
  const accentC = between(rng, direction.accentChroma);
  const accentL = between(rng, direction.accentLightness);
  const tint = direction.tint;

  // ---- Grounds ----------------------------------------------------------
  let bg: string;
  let bgAlt: string;
  let surface: string;
  let line: string;
  if (ground === "dark") {
    const l = between(rng, [0.14, 0.19]);
    const c = 0.008 + 0.022 * tint;
    bg = toHex({ l, c, h: hue });
    bgAlt = toHex({ l: l + 0.04, c, h: hue });
    surface = toHex({ l: l + 0.065, c, h: hue });
    line = toHex({ l: l + 0.12, c: c * 0.8, h: hue });
  } else if (ground === "tint") {
    // A pastel ground, hue-shifted from the accent so the two do not merge.
    const groundHue = (hue + pick(rng, [-35, -20, 20, 35]) + 360) % 360;
    const l = between(rng, [0.935, 0.965]);
    const c = 0.018 + 0.035 * tint;
    bg = toHex({ l, c, h: groundHue });
    bgAlt = toHex({ l: l - 0.035, c: c * 1.15, h: groundHue });
    surface = toHex({ l: Math.min(0.99, l + 0.03), c: c * 0.45, h: groundHue });
    line = toHex({ l: l - 0.1, c: c * 0.9, h: groundHue });
  } else {
    const l = between(rng, [0.972, 0.99]);
    const c = 0.004 + 0.012 * tint;
    bg = toHex({ l, c, h: hue });
    bgAlt = toHex({ l: l - 0.03, c: c * 1.4, h: hue });
    surface = toHex({ l: Math.min(1, l + 0.01), c: c * 0.5, h: hue });
    line = toHex({ l: l - 0.12, c: c * 1.2, h: hue });
  }
  const grounds = [bg, bgAlt, surface];

  // ---- Text -------------------------------------------------------------
  const dark = ground === "dark";
  const inkBase: Oklch = dark ? { l: 0.96, c: 0.008 + 0.01 * tint, h: hue } : { l: 0.2, c: 0.012 + 0.03 * tint, h: hue };
  const mutedBase: Oklch = dark ? { l: 0.76, c: 0.012 + 0.012 * tint, h: hue } : { l: 0.46, c: 0.012 + 0.025 * tint, h: hue };
  const ink = readableOnAll(inkBase, grounds, 7);
  const muted = readableOnAll(mutedBase, grounds, 4.5);

  // ---- Accent -----------------------------------------------------------
  const accentColor: Oklch = { l: accentL, c: accentC, h: hue };
  let accent = toHex(accentColor);
  let onAccent = inkFor(accent);
  if (contrastRatio(onAccent, accent) < 4.5) {
    // Neither white nor near-black reads on this accent: move the accent
    // itself, away from whichever ink is closer.
    const towardDark = contrastRatio("#ffffff", accent) >= contrastRatio("#111111", accent);
    accent = ensureContrast(accentColor, towardDark ? "#ffffff" : "#111111", 4.5);
    onAccent = inkFor(accent);
  }
  const accentText = readableOnAll(accentColor, grounds, 4.5);
  const accentSoft = dark
    ? toHex({ l: 0.27, c: accentC * 0.45, h: hue })
    : toHex({ l: 0.93, c: accentC * 0.28, h: hue });

  // ---- The inverted band (CTA, footer, contrast sections) ----------------
  const invert = dark
    ? toHex({ l: 0.93, c: 0.02 + 0.02 * tint, h: hue })
    : toHex({ l: between(rng, [0.18, 0.24]), c: 0.02 + 0.04 * tint, h: hue });
  const onInvert = readable(dark ? { l: 0.18, c: 0.02, h: hue } : { l: 0.97, c: 0.01, h: hue }, invert, 7);
  const invertMuted = readable(dark ? { l: 0.4, c: 0.02, h: hue } : { l: 0.78, c: 0.015, h: hue }, invert, 4.5);
  const invertAccent = readable(accentColor, invert, 3);

  return {
    bg,
    bgAlt,
    surface,
    ink,
    muted,
    line,
    accent,
    onAccent,
    accentText,
    accentSoft,
    invert,
    onInvert,
    invertMuted,
    invertAccent,
  };
}
