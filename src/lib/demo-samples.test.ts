import { describe, expect, it } from "vitest";

import { POOLS_EN, GENERIC_EN } from "./demo-samples-en";
import { POOLS_FR, GENERIC_FR } from "./demo-samples-fr";
import { categoryLabel, poolsFor, samplesFor, type CategoryPools } from "./demo-samples";

/**
 * The sample-copy pools themselves.
 *
 * What the generator does with them is tested in `server/demo/`; this file
 * guards the promises the pools make on their own: that the two languages are
 * one page in two languages, that picking is stable and varied, and that the
 * French is typographically and grammatically safe to fill in.
 */

const POOL_FIELDS = [
  "eyebrow",
  "headline",
  "subheading",
  "servicesHeading",
  "servicesIntro",
  "aboutHeading",
  "aboutBody",
  "galleryHeading",
  "galleryBody",
  "contactBody",
  "ctaHeading",
  "ctaBody",
  "ctaBodyVisit",
  "footerNote",
] as const;

const PAIRS: [string, CategoryPools, CategoryPools][] = [
  ...Object.keys(POOLS_EN).map((key): [string, CategoryPools, CategoryPools] => [key, POOLS_EN[key], POOLS_FR[key]]),
  ["generic", GENERIC_EN, GENERIC_FR],
];

/** Every line of copy in a set of pools, for sweeping checks. */
function allLines(pools: CategoryPools): string[] {
  return [
    ...POOL_FIELDS.flatMap((field) => pools[field]),
    ...pools.services.flatMap((s) => [s.title, s.body]),
    ...pools.aboutPoints,
    ...pools.galleryLabels,
  ];
}

describe("the two languages are one page", () => {
  it("covers the same categories in both languages", () => {
    expect(Object.keys(POOLS_FR).sort()).toEqual(Object.keys(POOLS_EN).sort());
  });

  it.each(PAIRS)("%s: every pool has the same length in both languages", (key, en, fr) => {
    for (const field of POOL_FIELDS) {
      expect(fr[field].length, `${key}.${field}`).toBe(en[field].length);
      expect(en[field].length, `${key}.${field} is empty`).toBeGreaterThan(0);
    }
    expect(fr.services.length, `${key}.services`).toBe(en.services.length);
    expect(fr.aboutPoints.length, `${key}.aboutPoints`).toBe(en.aboutPoints.length);
    expect(fr.galleryLabels.length, `${key}.galleryLabels`).toBe(en.galleryLabels.length);
  });

  it.each(PAIRS)("%s: offers enough to choose from", (key, en) => {
    expect(en.services.length, key).toBeGreaterThanOrEqual(3);
    expect(en.aboutPoints.length, key).toBeGreaterThanOrEqual(3);
    expect(en.galleryLabels.length, key).toBe(4);
  });

  it.each(PAIRS)("%s: uses the same placeholders line for line", (key, en, fr) => {
    // A French line may word things differently, but it must not drop the
    // business's name where the English one carries it, or add the city
    // where the English one does not: the two pages would stop matching.
    const placeholders = (line: string) => (line.match(/\{[a-z]+\}/g) ?? []).sort().join();
    for (const field of POOL_FIELDS) {
      en[field].forEach((line, i) => {
        expect(placeholders(fr[field][i]), `${key}.${field}[${i}]`).toBe(placeholders(line));
      });
    }
  });

  it("picks the same line in both languages for the same business", () => {
    for (const key of Object.keys(POOLS_EN)) {
      for (const seed of ["Salon Lumière", "Chez Nadia", "Barbier 88", "Studio Noir", "Maison Verte"]) {
        const en = samplesFor(key, "en", seed);
        const fr = samplesFor(key, "fr", seed);
        expect(POOLS_FR[key].headline.indexOf(fr.headline), `${key}/${seed}`).toBe(POOLS_EN[key].headline.indexOf(en.headline));
        expect(POOLS_FR[key].aboutBody.indexOf(fr.aboutBody)).toBe(POOLS_EN[key].aboutBody.indexOf(en.aboutBody));
        expect(fr.services.map((s) => POOLS_FR[key].services.findIndex((x) => x.title === s.title))).toEqual(
          en.services.map((s) => POOLS_EN[key].services.findIndex((x) => x.title === s.title)),
        );
      }
    }
  });
});

describe("picking is stable, ordered and varied", () => {
  it("gives one business the same copy every time", () => {
    expect(samplesFor("Hair salon", "fr", "Salon Lumière")).toEqual(samplesFor("Hair salon", "fr", "Salon Lumière"));
  });

  it("keeps the services in their written order, whichever are chosen", () => {
    for (let i = 0; i < 50; i += 1) {
      const chosen = samplesFor("Barber shop", "en", `Barbier ${i}`, 4).services;
      const order = chosen.map((s) => POOLS_EN.barber.services.findIndex((x) => x.title === s.title));
      expect(chosen).toHaveLength(4);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it("shows three about points, and three or four services as asked", () => {
    expect(samplesFor("Nail salon", "fr", "x").aboutPoints).toHaveLength(3);
    expect(samplesFor("Nail salon", "fr", "x", 3).services).toHaveLength(3);
    expect(samplesFor("Nail salon", "fr", "x", 4).services).toHaveLength(4);
  });

  it("gives neighbours in one trade different pages", () => {
    // Two hundred invented salon names, compared pairwise -- the question an
    // owner would ask is "does my neighbour's page say the same thing?".
    // ~1,600 combinations of headline, subheading, about, services and
    // closing make a whole-page match about a 1-in-1,600 event per pair. The
    // bound is loose; what it catches is picks moving in lockstep, which
    // once made one in four pairs of names produce the same page.
    const names = Array.from({ length: 200 }, (_, i) => `Salon ${i} ${"abcdefghij"[i % 10]}`);
    const pages = names.map((name) => {
      const s = samplesFor("Hair salon", "en", name);
      return `${s.headline}|${s.subheading}|${s.aboutBody}|${s.services.map((x) => x.title).join()}|${s.ctaHeading}`;
    });
    let same = 0;
    let pairs = 0;
    for (let a = 0; a < pages.length; a += 1) {
      for (let b = a + 1; b < pages.length; b += 1) {
        pairs += 1;
        if (pages[a] === pages[b]) same += 1;
      }
    }
    expect(same / pairs).toBeLessThan(0.003);
    expect(new Set(names.map((n) => samplesFor("Hair salon", "en", n).headline)).size).toBe(POOLS_EN["hair-salon"].headline.length);
  });
});

describe("French copy is safe to fill in", () => {
  it.each(PAIRS)("%s: never puts {city} or {name} after an elidable word", (key, _en, fr) => {
    // "de Montréal" is right and "de Anjou" is wrong; a template cannot know
    // which it will get. Same for "le", "la", "que", "ce".
    for (const line of allLines(fr)) {
      expect(line, key).not.toMatch(/\b(?:de|du|le|la|que|ce|je|ne|se)\s+\{(?:city|name)\}/i);
    }
  });

  it.each(PAIRS)("%s: sets a non-breaking space before ? ! : and ;", (key, _en, fr) => {
    for (const line of allLines(fr)) {
      expect(line, key).not.toMatch(/[^  ][?!:;]/);
    }
  });

  it.each(PAIRS)("%s: uses one apostrophe style throughout", (key, _en, fr) => {
    for (const line of allLines(fr)) expect(line, key).not.toContain("'");
  });

  it("names the trades in French, and leaves an unknown category as stored", () => {
    expect(categoryLabel("Hair salon", "fr")).toBe("Salon de coiffure");
    expect(categoryLabel("Barber shop", "fr")).toBe("Barbier");
    expect(categoryLabel("Tattoo & piercing", "fr")).toBe("Tatouage et perçage");
    expect(categoryLabel("Hair salon", "en")).toBe("Hair salon");
    expect(categoryLabel("Locksmith", "fr")).toBe("Locksmith");
    expect(poolsFor("Locksmith", "fr")).toBe(GENERIC_FR);
  });
});
