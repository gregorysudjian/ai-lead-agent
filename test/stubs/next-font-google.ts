/**
 * Test stub for `next/font/google`.
 *
 * The real module is not a runtime library. Next's compiler rewrites each
 * `Inter({...})` call at build time into a reference to a self-hosted font it
 * downloaded and emitted. Vitest does not run that transform, so the import
 * resolves to something that is not callable and every test touching the demo
 * renderer fails with "Inter is not a function".
 *
 * This mirrors the shape the compiler produces -- a `className`, a `variable`
 * class that defines the custom property, and a `style` object -- so component
 * code under test behaves as it does in a build. It asserts nothing about the
 * fonts themselves; which face a theme uses is a build-time concern and is not
 * something a unit test can observe.
 *
 * Same idea as `server-only.ts`: alias a build-time mechanism to a harmless
 * runtime equivalent, and leave the real one fully active in app builds.
 *
 * A font added to `demo/fonts.ts` must be added here too, or its import
 * resolves to `undefined` and the test fails loudly rather than silently.
 */

interface StubbedFont {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

interface FontOptions {
  variable?: string;
}

/** Build a stand-in for one font factory. */
function stub(name: string) {
  return (options: FontOptions = {}): StubbedFont => ({
    // The compiler emits hashed class names; the exact strings are opaque and
    // nothing should depend on them, so these are just recognisable.
    className: `__className_${name}`,
    variable: options.variable ? `__variable_${name}` : "",
    style: { fontFamily: name },
  });
}

export const Inter = stub("inter");
export const Fraunces = stub("fraunces");
export const Playfair_Display = stub("playfair_display");
export const Archivo = stub("archivo");
export const Plus_Jakarta_Sans = stub("plus_jakarta_sans");

// The new-generation renderer's families (`demo/v2/fonts.ts`).
export const Abril_Fatface = stub("abril_fatface");
export const Anton = stub("anton");
export const Bebas_Neue = stub("bebas_neue");
export const Bodoni_Moda = stub("bodoni_moda");
export const Bricolage_Grotesque = stub("bricolage_grotesque");
export const Cormorant_Garamond = stub("cormorant_garamond");
export const DM_Sans = stub("dm_sans");
export const DM_Serif_Display = stub("dm_serif_display");
export const Gloock = stub("gloock");
export const Instrument_Serif = stub("instrument_serif");
export const Inter_Tight = stub("inter_tight");
export const Italiana = stub("italiana");
export const Limelight = stub("limelight");
export const Manrope = stub("manrope");
export const Marcellus = stub("marcellus");
export const Newsreader = stub("newsreader");
export const Outfit = stub("outfit");
export const Poiret_One = stub("poiret_one");
export const Space_Grotesk = stub("space_grotesk");
export const Space_Mono = stub("space_mono");
export const Syne = stub("syne");
export const Unbounded = stub("unbounded");
export const Work_Sans = stub("work_sans");
export const Young_Serif = stub("young_serif");

// Loaded by the dashboard's root layout rather than by a demo page, but a test
// that renders the layout would need them for the same reason.
export const Geist = stub("geist");
export const Geist_Mono = stub("geist_mono");
