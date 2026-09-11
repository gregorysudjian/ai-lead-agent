import { describe, expect, it } from "vitest";

import { contrastRatio, ensureContrast, inkFor, isHexColor, relativeLuminance, toGamut, toHex } from "./color";

describe("OKLCH to hex", () => {
  it("maps the ends of the lightness axis to black and white", () => {
    expect(toHex({ l: 0, c: 0, h: 0 })).toBe("#000000");
    expect(toHex({ l: 1, c: 0, h: 0 })).toBe("#ffffff");
  });

  it("produces a neutral grey at zero chroma whatever the hue", () => {
    const a = toHex({ l: 0.6, c: 0, h: 10 });
    const b = toHex({ l: 0.6, c: 0, h: 250 });
    expect(a).toBe(b);
    expect(a.slice(1, 3)).toBe(a.slice(3, 5));
  });

  it("reproduces known OKLCH reference colours within a rounding step", () => {
    // oklch(0.628 0.2577 29.23) is sRGB red.
    expect(toHex({ l: 0.62796, c: 0.25768, h: 29.2339 })).toBe("#ff0000");
    // oklch(0.452 0.3132 264.05) is sRGB blue.
    expect(toHex({ l: 0.452014, c: 0.313214, h: 264.052 })).toBe("#0000ff");
  });

  it("pulls an impossible colour into gamut by lowering chroma, not hue", () => {
    const wild = { l: 0.7, c: 0.5, h: 150 };
    const fitted = toGamut(wild);
    expect(fitted.c).toBeLessThan(0.5);
    expect(fitted.h).toBe(150);
    expect(isHexColor(toHex(wild))).toBe(true);
  });
});

describe("contrast", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("matches a published ratio: #767676 on white is the 4.54 AA minimum grey", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("walks a colour away from its background until it passes", () => {
    const pale = { l: 0.85, c: 0.12, h: 200 };
    const onLight = ensureContrast(pale, "#fafafa", 4.5);
    expect(contrastRatio(onLight, "#fafafa")).toBeGreaterThanOrEqual(4.5);

    const deep = { l: 0.25, c: 0.12, h: 200 };
    const onDark = ensureContrast(deep, "#101014", 4.5);
    expect(contrastRatio(onDark, "#101014")).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves a colour alone when it already passes", () => {
    const ink = { l: 0.2, c: 0.02, h: 60 };
    expect(ensureContrast(ink, "#ffffff", 4.5)).toBe(toHex(ink));
  });

  it("picks the readable ink for a background", () => {
    expect(inkFor("#fef3c7")).toBe("#111111");
    expect(inkFor("#1e1b4b")).toBe("#ffffff");
  });
});
