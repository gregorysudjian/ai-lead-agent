/**
 * Category-typical SAMPLE content for demo sites, in French and English.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The businesses worth approaching are the ones with no website, so the only
 * facts we hold about them are a name, a category, a city, and maybe a phone
 * number and an address. A demo built strictly from that is a page of empty
 * slots reading "To be added." It is honest and it is useless: an owner shown
 * a blank template cannot picture their site, and the proposal dies there.
 *
 * So a demo may show realistic, category-typical placeholder copy -- the kind
 * of thing that WOULD go in each section -- on one condition.
 *
 * ── THE CONDITION ─────────────────────────────────────────────────────────
 *
 * Every block filled from this file is marked `sample: true` on its section,
 * rendered with a visible "Sample content" tag, and summarised in the preview's
 * own chrome. Nothing here is ever presented as a fact about the business.
 *
 * That marking is NOT the generator's choice. `enforceSampleFlags` in
 * `demo-sample-policy.ts` recomputes it from the facts we actually hold and
 * can only ever turn the flag ON. A generator -- deterministic today, possibly
 * a model tomorrow -- cannot mark invented copy as confirmed.
 *
 * ── WHAT SAMPLE COPY MAY AND MAY NOT SAY ──────────────────────────────────
 *
 * It reads as ordinary marketing copy a shop owner would recognise and edit.
 * It must stay editable-generic, never specific-and-checkable:
 *
 *   ALLOWED   "Cuts, colour and care for every kind of hair."
 *             "Walk-ins and appointments welcome."
 *   FORBIDDEN a price, a named member of staff, a year founded, an award, a
 *             certification, a testimonial, a review score, a phone number,
 *             an address, a URL, a payment method, or a named neighbourhood.
 *
 * The forbidden list is not stylistic. A price or an award is a claim an owner
 * can immediately check and find wrong, and one wrong specific makes the whole
 * proposal look like it was written without looking. Generic copy reads as a
 * placeholder; a specific invention reads as a lie. The same holds in both
 * languages, and the policy tests check both.
 *
 * ── VARIETY ───────────────────────────────────────────────────────────────
 *
 * For the trades the catalog collects, most fields are POOLS of several
 * lines, and a business's own name picks one from each. Two barbers on one
 * street get different headlines, different about paragraphs and a different
 * choice of services, while one barber always gets the same page: the pick is
 * a hash, not a random draw.
 *
 * The English and French pools are PARALLEL (`demo-samples-en.ts`,
 * `demo-samples-fr.ts`): the same index in each says the same thing, and both
 * languages pick the same index. A business's French page and English page are
 * one page in two languages, never two different pitches.
 *
 * ── TEMPLATES ─────────────────────────────────────────────────────────────
 *
 * `{name}` and `{city}` are filled by `fillSample` from application-owned
 * facts. They are the only substitutions, and no template may introduce
 * another -- so sample copy can carry the business's real name without any
 * generator ever handling it.
 */
import { POOLS_EN, GENERIC_EN } from "./demo-samples-en";
import { POOLS_FR, GENERIC_FR } from "./demo-samples-fr";
import type { Locale } from "./locale";

/** One item in a services list. */
export interface SampleService {
  title: string;
  body: string;
}

/** A non-empty list of interchangeable lines; one entry means "always this". */
export type Pool = readonly string[];

/** One category's sample copy in one language, before a business picks from it. */
export interface CategoryPools {
  /**
   * The category's name in this language, or null to show the category as it
   * was stored. English is always null (the stored label IS English).
   */
  label: string | null;
  eyebrow: Pool;
  headline: Pool;
  subheading: Pool;
  servicesHeading: Pool;
  servicesIntro: Pool;
  /** A business shows three or four of these, chosen by its name, in this order. */
  services: readonly SampleService[];
  aboutHeading: Pool;
  aboutBody: Pool;
  /** A business shows three of these, chosen by its name, in this order. */
  aboutPoints: readonly string[];
  galleryHeading: Pool;
  galleryBody: Pool;
  galleryLabels: readonly string[];
  /** Used only when BOTH a phone and an address are held. */
  contactBody: Pool;
  /**
   * The closing prompt's heading.
   *
   * Rendered whatever we hold, so unlike the bodies below it has no variant
   * and must therefore name NO contact channel. "Drop in for a cut" above a
   * page with no address is the same broken invitation as "give us a call"
   * above a missing phone number.
   */
  ctaHeading: Pool;
  /**
   * The closing prompt when a phone number is listed.
   *
   * May mention calling, and must mention NOTHING ELSE -- no visiting, no
   * dropping in. It is chosen on the phone alone, so it is rendered on pages
   * that have no address to visit.
   */
  ctaBody: Pool;
  /**
   * The closing prompt when an address is listed but NO phone number is.
   *
   * A separate field rather than a clever rewrite of `ctaBody`, because the
   * failure it prevents is specific and embarrassing: a page that says "give
   * us a call" above a contact card reading "Phone: to be added". An owner
   * reads that as proof nobody looked. Every line here invites a VISIT and
   * never a call.
   */
  ctaBodyVisit: Pool;
  footerNote: Pool;
}

/** The sample content one business gets, in one language: every pool resolved. */
export interface CategorySamples {
  /** Small label above the hero heading. */
  eyebrow: string;
  headline: string;
  subheading: string;

  servicesHeading: string;
  servicesIntro: string;
  services: SampleService[];

  aboutHeading: string;
  aboutBody: string;
  aboutPoints: string[];

  galleryHeading: string;
  galleryBody: string;
  galleryLabels: string[];

  /** A plausible weekly schedule, shown only when we hold no real hours. */
  hours: string[];

  contactBody: string;
  ctaHeading: string;
  ctaBody: string;
  ctaBodyVisit: string;
  footerNote: string;
}

/**
 * Fill `{name}` and `{city}` from application-owned facts.
 *
 * Deliberately not a general template engine: exactly two keys, replaced
 * literally. An unknown `{placeholder}` is left untouched rather than being
 * silently blanked, so the policy tests can catch a typo in a template instead
 * of it shipping as a visible hole in a customer-facing page.
 */
export function fillSample(
  template: string,
  values: { name: string; city: string },
): string {
  return template.split("{name}").join(values.name).split("{city}").join(values.city);
}

/**
 * Sample weekly schedules, written once in one simple English shape
 * ("Monday to Friday   9:00 - 18:30"). The renderer rewrites them for French
 * ("Lundi au vendredi   9 h – 18 h 30") rather than keeping a second copy
 * that could drift. Never generated copy: the renderer reads these directly,
 * and only when the business's real hours are unknown.
 */
const HOURS: Readonly<Record<string, readonly string[]>> = {
  "hair-salon": ["Tuesday to Friday   9:00 - 19:00", "Saturday   9:00 - 17:00", "Sunday and Monday   Closed"],
  barber: ["Monday to Friday   9:00 - 18:30", "Saturday   8:30 - 17:00", "Sunday   Closed"],
  "beauty-salon": ["Monday to Friday   9:30 - 19:00", "Saturday   9:00 - 17:00", "Sunday   Closed"],
  "nail-salon": ["Monday to Saturday   10:00 - 19:00", "Sunday   11:00 - 17:00"],
  tattoo: ["Tuesday to Saturday   12:00 - 20:00", "Sunday and Monday   Closed"],
  restaurant: ["Tuesday to Thursday   17:00 - 22:00", "Friday and Saturday   12:00 - 23:00", "Sunday   12:00 - 20:00", "Monday   Closed"],
  cafe: ["Monday to Friday   7:30 - 17:00", "Saturday and Sunday   8:30 - 17:00"],
  dentist: ["Monday to Thursday   8:30 - 17:30", "Friday   8:30 - 16:00", "Weekends   Closed"],
  pharmacy: ["Monday to Friday   9:00 - 18:30", "Saturday   9:00 - 17:00", "Sunday   Closed"],
  bakery: ["Tuesday to Saturday   7:00 - 17:00", "Sunday   7:30 - 14:00", "Monday   Closed"],
  gym: ["Monday to Friday   6:00 - 22:00", "Saturday and Sunday   8:00 - 20:00"],
  florist: ["Monday to Friday   9:00 - 18:00", "Saturday   9:00 - 16:00", "Sunday   Closed"],
  "car-repair": ["Monday to Friday   8:00 - 18:00", "Saturday   8:00 - 13:00", "Sunday   Closed"],
};
const GENERIC_HOURS: readonly string[] = ["Monday to Friday   9:00 - 17:00", "Saturday and Sunday   Closed"];

const POOLS: Record<Locale, Readonly<Record<string, CategoryPools>>> = { en: POOLS_EN, fr: POOLS_FR };
const GENERIC: Record<Locale, CategoryPools> = { en: GENERIC_EN, fr: GENERIC_FR };

/** Every category key with bespoke content. Exported for tests. */
export const SAMPLED_CATEGORY_KEYS: readonly string[] = Object.keys(POOLS_EN);

/** Normalise a stored category label to a lookup key. */
function toKey(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * The bespoke key a category resolves to, or null for the generic set.
 *
 * Matches the key itself and the human label, because a stored lead carries
 * the label ("Hair salon") rather than the key ("hair-salon"). "Barber shop"
 * -> "barber", "Tattoo & piercing" -> "tattoo" and similar label-to-key drift
 * are matched on the START of the key, so "cafe" does not match "car-repair".
 */
function categoryKey(category: string): string | null {
  const key = toKey(category);
  if (key in POOLS_EN) return key;
  for (const candidate of SAMPLED_CATEGORY_KEYS) {
    if (key.startsWith(`${candidate}-`) || `${candidate}-shop` === key) return candidate;
  }
  return null;
}

/** The raw pools for a category and language. Exported for tests. */
export function poolsFor(category: string, locale: Locale): CategoryPools {
  const key = categoryKey(category);
  return key === null ? GENERIC[locale] : POOLS[locale][key];
}

/**
 * FNV-1a, then murmur3's finaliser.
 *
 * The finaliser is not decoration. FNV's XOR-and-multiply never carries a high
 * bit down, so the LOW bits of the hash depend only on the low bits of what
 * came before -- and a pool of four is picked by the low two bits. Without it
 * every field of one business was chosen from the same two bits of state, the
 * picks moved in lockstep, and 200 salons produced only 72% distinct pages.
 */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** One line from a pool, chosen by the seed and the field's own name. */
function pickOne(pool: Pool, seed: string, field: string): string {
  return pool[stableHash(`${seed}|${field}`) % pool.length];
}

/**
 * `count` entries of a list, chosen by the seed, kept in the list's order --
 * so "Cuts" still comes before "Colour" whichever four a salon shows.
 */
function pickSome<T>(list: readonly T[], count: number, seed: string, field: string): T[] {
  if (list.length <= count) return [...list];
  return list
    .map((item, index) => ({ item, index, rank: stableHash(`${seed}|${field}|${index}`) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * The sample content one business gets.
 *
 * `seed` is what makes the page this business's own -- the generator passes
 * the business's name, so the same business always gets the same words, and a
 * neighbour in the same trade almost always gets different ones. The index of
 * every pick depends only on the seed and the field, never on the language,
 * which is what keeps the two language versions saying the same thing.
 */
export function samplesFor(
  category: string,
  locale: Locale,
  seed: string,
  serviceCount = 4,
): CategorySamples {
  const pools = poolsFor(category, locale);
  const key = categoryKey(category);
  return {
    eyebrow: pickOne(pools.eyebrow, seed, "eyebrow"),
    headline: pickOne(pools.headline, seed, "headline"),
    subheading: pickOne(pools.subheading, seed, "subheading"),
    servicesHeading: pickOne(pools.servicesHeading, seed, "servicesHeading"),
    servicesIntro: pickOne(pools.servicesIntro, seed, "servicesIntro"),
    services: pickSome(pools.services, serviceCount, seed, "services").map((s) => ({ ...s })),
    aboutHeading: pickOne(pools.aboutHeading, seed, "aboutHeading"),
    aboutBody: pickOne(pools.aboutBody, seed, "aboutBody"),
    aboutPoints: pickSome(pools.aboutPoints, 3, seed, "aboutPoints"),
    galleryHeading: pickOne(pools.galleryHeading, seed, "galleryHeading"),
    galleryBody: pickOne(pools.galleryBody, seed, "galleryBody"),
    galleryLabels: [...pools.galleryLabels],
    hours: [...(key === null ? GENERIC_HOURS : HOURS[key])],
    contactBody: pickOne(pools.contactBody, seed, "contactBody"),
    ctaHeading: pickOne(pools.ctaHeading, seed, "ctaHeading"),
    ctaBody: pickOne(pools.ctaBody, seed, "ctaBody"),
    ctaBodyVisit: pickOne(pools.ctaBodyVisit, seed, "ctaBodyVisit"),
    footerNote: pickOne(pools.footerNote, seed, "footerNote"),
  };
}

/**
 * English sample content for a category, as the first pick of every pool.
 *
 * Total: every category resolves to something, so a business in a category we
 * have not written for still gets a complete page rather than a broken one.
 * The renderers use it for the sample schedule; generation uses `samplesFor`.
 */
export function samplesForCategory(category: string): CategorySamples {
  return samplesFor(category, "en", "");
}

/** The sample weekly schedule for a category (English shape; see HOURS). */
export function sampleHoursFor(category: string): string[] {
  const key = categoryKey(category);
  return [...(key === null ? GENERIC_HOURS : HOURS[key])];
}

/**
 * The category's name in a language: "Hair salon" -> "Salon de coiffure".
 * A category we have not written for is shown as stored, in either language.
 */
export function categoryLabel(category: string, locale: Locale): string {
  return poolsFor(category, locale).label ?? category;
}

/** The generic set, exported so tests can assert the fallback is reached. */
export const GENERIC_SAMPLES = samplesFor("", "en", "");
