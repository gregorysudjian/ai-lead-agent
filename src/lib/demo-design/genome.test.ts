import { describe, expect, it } from "vitest";

import { brandName, monogram } from "./brand";
import { contrastRatio } from "./color";
import { DIRECTIONS, MAPPED_TRADES, directionsForTrade } from "./directions";
import { designFor, DemoDesignError, validateDemoDesign, visibleFingerprint, type DesignSubject } from "./genome";
import { paletteFor } from "./palette";
import {
  ABOUT_VARIANTS,
  ART_DIRECTIONS,
  BODY_FONTS,
  CONTACT_VARIANTS,
  CTA_VARIANTS,
  DISPLAY_FONTS,
  FOOTER_VARIANTS,
  GALLERY_VARIANTS,
  HERO_VARIANTS,
  MOTIFS,
  NAV_VARIANTS,
  SERVICES_VARIANTS,
} from "./types";

// ---------------------------------------------------------------------------
// Fixtures: 1,000 plausible, distinct Montreal-style businesses
// ---------------------------------------------------------------------------

const FIRST = [
  "Lumière", "Mostafa", "Nord", "Jade", "Orchidée", "Sofia", "Marco", "Élise", "Kenza", "Atlas",
  "Rosa", "Theo", "Nina", "Olive", "Zara", "Victor", "Iris", "Leo", "Maya", "Hugo",
  "Aria", "Félix", "Luna", "Omar", "Clara", "Noah", "Inès", "Samir", "Lola", "Adam",
  "Chloé", "Rami", "Eva", "Karim", "Mila", "Jules", "Yasmine", "Paolo", "Anaïs", "Tariq",
];
const TRADES: [string, string[]][] = [
  ["Hair salon", ["Salon", "Coiffure", "Studio", "Atelier"]],
  ["Barber shop", ["Barbier", "Barbershop", "Barber Co", "Chez"]],
  ["Beauty salon", ["Beauté", "Spa", "Institut", "Maison"]],
  ["Nail salon", ["Nails", "Ongles", "Nail Bar", "Studio"]],
  ["Tattoo & piercing", ["Tattoo", "Tatouage", "Ink", "Studio"]],
];
const STREETS = ["Rue Wellington", "Boulevard Saint-Laurent", "Avenue du Mont-Royal", "Rue Ontario Est", "Rue Sherbrooke O"];

function subjects(count: number): DesignSubject[] {
  const out: DesignSubject[] = [];
  for (let i = 0; out.length < count; i += 1) {
    const [category, words] = TRADES[i % TRADES.length];
    const first = FIRST[Math.floor(i / TRADES.length) % FIRST.length];
    const word = words[Math.floor(i / (TRADES.length * FIRST.length)) % words.length];
    out.push({
      name: i % 2 === 0 ? `${word} ${first}` : `${first} ${word}`,
      category,
      address: `${100 + (i % 997)} ${STREETS[i % STREETS.length]}`,
    });
  }
  return out;
}

const salon: DesignSubject = { name: "Salon Lumière", category: "Hair salon", address: "4500 Rue Wellington" };

// ---------------------------------------------------------------------------

describe("every generated palette is readable", () => {
  // Every direction, every ground it allows, many seeds. If one combination
  // can produce unreadable text, this finds it.
  const SEEDS = 300;

  for (const direction of Object.values(DIRECTIONS)) {
    for (const ground of direction.grounds) {
      it(`${direction.key} on a ${ground} ground`, () => {
        for (let seed = 1; seed <= SEEDS; seed += 1) {
          let state = seed * 2654435761;
          const rng = () => {
            state = (state * 1103515245 + 12345) >>> 0;
            return state / 4294967296;
          };
          const p = paletteFor(direction, ground, rng);
          const where = `${direction.key}/${ground}/seed ${seed}`;

          for (const surface of [p.bg, p.bgAlt, p.surface]) {
            expect(contrastRatio(p.ink, surface), `ink ${where}`).toBeGreaterThanOrEqual(7);
            expect(contrastRatio(p.muted, surface), `muted ${where}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrastRatio(p.accentText, p.bg), `accentText ${where}`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.accentText, p.bgAlt), `accentText/alt ${where}`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.onAccent, p.accent), `onAccent ${where}`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.onInvert, p.invert), `onInvert ${where}`).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(p.invertMuted, p.invert), `invertMuted ${where}`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.invertAccent, p.invert), `invertAccent ${where}`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});

describe("designs are stable", () => {
  it("gives the same business the same design every time", () => {
    expect(designFor(salon)).toEqual(designFor(salon));
    expect(designFor({ ...salon, name: "  SALON lumiere " })).toEqual(designFor(salon));
  });

  it("gives a different design for another variant", () => {
    expect(designFor(salon, 1)).not.toEqual(designFor(salon));
    expect(designFor(salon, 1).variant).toBe(1);
  });

  it("gives two branches of one chain at different addresses different designs", () => {
    const a = designFor({ ...salon, address: "1 Rue A" });
    const b = designFor({ ...salon, address: "2 Rue B" });
    expect(a.seed).not.toBe(b.seed);
  });
});

describe("designs are unique", () => {
  const designs = subjects(1000).map((subject) => designFor(subject));

  it("gives 1,000 businesses at least 99% distinct designs", () => {
    const distinct = new Set(designs.map((design) => JSON.stringify(design)));
    expect(distinct.size / designs.length).toBeGreaterThanOrEqual(0.99);
  });

  it("gives them visibly distinct designs, not only numerically distinct ones", () => {
    const distinct = new Set(designs.map(visibleFingerprint));
    expect(distinct.size / designs.length).toBeGreaterThanOrEqual(0.95);
  });

  it("uses every art direction somewhere", () => {
    const used = new Set(designs.map((design) => design.direction));
    for (const direction of ART_DIRECTIONS) expect(used, direction).toContain(direction);
  });

  it("gives ten barbers on one street ten different looks", () => {
    const street = FIRST.slice(0, 10).map((first, i) =>
      designFor({ name: `Barbier ${first}`, category: "Barber shop", address: `${200 + i} Rue Wellington` }),
    );
    expect(new Set(street.map(visibleFingerprint)).size).toBe(10);
  });
});

describe("designs respect the trade", () => {
  it("never offers a tattoo studio pastel, or a nail salon brutalism", () => {
    for (const subject of subjects(1000)) {
      const design = designFor(subject);
      if (subject.category === "Tattoo & piercing") {
        expect(["soft-organic", "pop", "botanical"]).not.toContain(design.direction);
      }
      if (subject.category === "Nail salon") expect(design.direction).not.toBe("brutalist");
    }
  });

  it("draws art from the trade's own tools most of the time", () => {
    const barbers = subjects(1000).filter((s) => s.category === "Barber shop").map((s) => designFor(s));
    const own = barbers.filter((d) => ["razor", "pole", "shears", "comb"].includes(d.motif));
    expect(own.length / barbers.length).toBeGreaterThan(0.55);
  });

  it("maps every trade to directions that exist, and falls back for unknown ones", () => {
    for (const trade of MAPPED_TRADES) {
      for (const [direction] of directionsForTrade(trade)) expect(ART_DIRECTIONS).toContain(direction);
    }
    expect(designFor({ name: "Quincaillerie Roy", category: "Hardware store", address: null }).direction).toMatch(
      /editorial|swiss|soft-organic/,
    );
  });
});

describe("long names", () => {
  it("never set a long brand in a giant wordmark or poster hero", () => {
    for (let variant = 0; variant < 200; variant += 1) {
      const design = designFor(
        { name: "Académie Internationale de Beauté et Coiffure", category: "Hair salon", address: null },
        variant,
      );
      expect(["wordmark", "poster"]).not.toContain(design.hero);
    }
  });

  it("cut a keyword-stuffed listing down to the brand the business wrote", () => {
    expect(brandName("Klyne Beauty - Salon de coiffure Africaine, Dreadlocks, Tresses, Perruques Villeray")).toBe(
      "Klyne Beauty",
    );
    expect(brandName("Académie de coiffure Tornade (Site Officiel)")).toBe("Académie de coiffure Tornade");
    // A hyphen INSIDE a name is part of the name.
    expect(brandName("Coiffure Signé-Jo")).toBe("Coiffure Signé-Jo");
    expect(brandName("Salon Barbier Chez Mostafa")).toBe("Salon Barbier Chez Mostafa");
  });

  it("make monograms from the part of the name that is theirs", () => {
    expect(monogram("Salon Barbier Chez Mostafa")).toBe("M");
    expect(monogram("Klyne Beauty - Salon de coiffure")).toBe("K");
    expect(monogram("Jade Orchidée Spa")).toBe("JO");
    expect(monogram("11:11 Tattoos")).toBe("11");
    expect(monogram("Élise")).toBe("É");
  });
});

describe("every direction chooses only from the closed sets", () => {
  for (const direction of Object.values(DIRECTIONS)) {
    it(direction.key, () => {
      direction.displayFonts.forEach((f) => expect(DISPLAY_FONTS).toContain(f));
      direction.bodyFonts.forEach((f) => expect(BODY_FONTS).toContain(f));
      direction.heroes.forEach((v) => expect(HERO_VARIANTS).toContain(v));
      direction.services.forEach((v) => expect(SERVICES_VARIANTS).toContain(v));
      direction.about.forEach((v) => expect(ABOUT_VARIANTS).toContain(v));
      direction.gallery.forEach((v) => expect(GALLERY_VARIANTS).toContain(v));
      direction.contact.forEach((v) => expect(CONTACT_VARIANTS).toContain(v));
      direction.cta.forEach((v) => expect(CTA_VARIANTS).toContain(v));
      direction.nav.forEach((v) => expect(NAV_VARIANTS).toContain(v));
      direction.footer.forEach((v) => expect(FOOTER_VARIANTS).toContain(v));
      direction.motifs.forEach((v) => expect(MOTIFS).toContain(v));
    });
  }
});

describe("a stored design is validated on read", () => {
  const design = designFor(salon);

  it("round-trips through JSON unchanged", () => {
    expect(validateDemoDesign(JSON.parse(JSON.stringify(design)))).toEqual(design);
  });

  it.each([
    ["an unknown direction", { direction: "vaporwave" }],
    ["an unknown hero", { hero: "carousel" }],
    ["a colour that is not a hex", { palette: { ...design.palette, accent: "red" } }],
    ["a CSS injection in a colour", { palette: { ...design.palette, bg: "#fff;background:url(x)" } }],
    ["a font outside the self-hosted set", { fonts: { display: "Comic Sans", body: "inter" } }],
    ["a future version", { version: 2 }],
    ["a fractional variant", { variant: 1.5 }],
  ])("refuses %s", (_label, patch) => {
    expect(() => validateDemoDesign({ ...design, ...patch })).toThrow(DemoDesignError);
  });
});
