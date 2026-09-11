import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BODY_FONTS, DISPLAY_FONTS } from "@/lib/demo-design/types";

import { bodyFontVar, displayFontVar, WIRED_BODY_FONTS, WIRED_DISPLAY_FONTS } from "./fonts";

/**
 * The genome names fonts by key; this file is where a key becomes a face.
 * If the two lists drift, a design names a font that was never loaded and the
 * page silently falls back to Georgia -- exactly the regression nobody
 * notices by looking.
 */

const source = readFileSync(fileURLToPath(new URL("./fonts.ts", import.meta.url)), "utf8");
const declaredVariables = [...source.matchAll(/variable: "--dx-f-([a-z-]+)"/g)].map((m) => m[1]);

describe("demo v2 fonts", () => {
  it("wires every display font the genome can pick, and no other", () => {
    expect([...WIRED_DISPLAY_FONTS].sort()).toEqual([...DISPLAY_FONTS].sort());
  });

  it("wires every body font the genome can pick, and no other", () => {
    expect([...WIRED_BODY_FONTS].sort()).toEqual([...BODY_FONTS].sort());
  });

  it("declares exactly the CSS variable each key is read through", () => {
    // displayFontVar("playfair") reads --dx-f-playfair; the family wired to
    // that key must be the one declaring it.
    expect([...declaredVariables].sort()).toEqual([...DISPLAY_FONTS, ...BODY_FONTS].sort());
    expect(new Set(declaredVariables).size).toBe(declaredVariables.length);
  });

  it("reads each face through its own variable", () => {
    for (const key of DISPLAY_FONTS) expect(displayFontVar(key)).toBe(`var(--dx-f-${key})`);
    for (const key of BODY_FONTS) expect(bodyFontVar(key)).toBe(`var(--dx-f-${key})`);
  });

  it("never preloads: a page uses two families, not twenty-nine", () => {
    const calls = source.match(/\b[A-Z][A-Za-z_]+\(\{[^}]*\}\)/g) ?? [];
    expect(calls).toHaveLength(DISPLAY_FONTS.length + BODY_FONTS.length);
    for (const call of calls) expect(call).toContain("preload: false");
  });
});
