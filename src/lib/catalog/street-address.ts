import { normalizeTerm } from "../normalize";

/**
 * Compare two street addresses written by two different datasets.
 *
 * ── WHY EXACT MATCHING FAILED ─────────────────────────────────────────────
 *
 * Lead dedupe compares normalised addresses exactly, which is right within one
 * provider and useless across two. Measured against the 230 OpenStreetMap
 * leads: 73 have a same-named business in Overture, and exact matching caught
 * four of them, because the two datasets write one address two ways --
 *
 *   OpenStreetMap                        Overture
 *   743 Avenue Atwater                   743 Atwater Ave
 *   28 Avenue des Pins Est, H2W 1N3      28 Ave des Pins
 *   3918 Rue Wellington, Montréal        3918 Wellington St
 *   1294 Rue Ontario Est, Montréal       1294 Ontario St E
 *
 * This reduces an address to what both datasets agree on: the civic number,
 * the street's own name, and its direction.
 *
 * ── DIRECTION IS NOT NOISE HERE ───────────────────────────────────────────
 *
 * In Montreal, 1234 Sherbrooke Est and 1234 Sherbrooke Ouest are kilometres
 * apart, either side of boulevard Saint-Laurent. So direction is kept and
 * compared -- but a side that does not state one is compatible with either,
 * because "28 Ave des Pins" is not evidence of a different address from "28
 * Avenue des Pins Est", only a less complete one.
 *
 * ── WHAT THIS CANNOT DO ───────────────────────────────────────────────────
 *
 * A renamed street defeats it. Rue Amherst became rue Atateken in 2019, and one
 * dataset still says Amherst. Only coordinates can match that, which is why the
 * catalog stores them. And an address with no civic number is refused rather
 * than matched on the street alone -- a whole street is not an address.
 *
 * Pure and total.
 */

export interface StreetAddress {
  /** Civic number as written, lower-cased: "743", "1234a". */
  number: string;
  /** The street's own name with type words and articles removed, run together. */
  street: string;
  /** "e", "w", "n", "s", or null when the address does not say. */
  direction: "e" | "w" | "n" | "s" | null;
}

/** Street-type words, in French and English, as both datasets abbreviate them. */
const STREET_TYPES = new Set([
  "rue", "r", "avenue", "ave", "av", "boulevard", "boul", "blvd", "bd", "bl",
  "chemin", "ch", "street", "st", "road", "rd", "place", "pl", "montee", "route", "rte",
  "rang", "croissant", "cr", "terrasse", "square", "sq", "drive", "dr", "lane", "ln",
  "court", "crt", "cour", "allee", "impasse", "promenade", "prom", "parkway", "pkwy",
]);

const DIRECTIONS: Readonly<Record<string, StreetAddress["direction"]>> = {
  est: "e", e: "e", east: "e",
  ouest: "w", o: "w", w: "w", west: "w",
  nord: "n", n: "n", north: "n",
  sud: "s", s: "s", south: "s",
};

/** Articles that one dataset writes and the other drops: "Avenue DES Pins". */
const ARTICLES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "of", "the"]);

/**
 * Words that introduce a unit rather than name a street. Everything after goes.
 *
 * Deliberately NOT "ste". English abbreviates suite that way, but in Quebec
 * "Ste-" is Sainte on half the street signs, and treating it as a unit cut
 * "Rue Ste-Catherine" down to "Rue".
 */
const UNIT_MARKERS = new Set(["suite", "local", "unit", "bureau", "app", "apt", "appartement"]);

const CANADIAN_POSTCODE = /\b[a-z]\d[a-z]\s?\d[a-z]\d\b/giu;
const CIVIC_NUMBER = /^(\d+[a-z]?)(?:-\d+[a-z]?)?$/u;

/**
 * The part of an address that names the street.
 *
 * Addresses arrive as "28 Avenue des Pins Est, H2W 1N3", "1632, rue Amherst"
 * and "3918 Rue Wellington, Montréal". Take the first comma-separated segment
 * that starts with a civic number; if that segment IS only the number, the
 * street is in the next one.
 */
function streetSegment(folded: string): string | null {
  const segments = folded
    .replace(CANADIAN_POSTCODE, " ")
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (let i = 0; i < segments.length; i += 1) {
    if (!/^\d/u.test(segments[i])) continue;
    if (/^\d+[a-z]?$/u.test(segments[i]) && i + 1 < segments.length) {
      return `${segments[i]} ${segments[i + 1]}`;
    }
    return segments[i];
  }
  return null;
}

/** Parse an address into its comparable parts, or null when it has no civic number. */
export function parseStreetAddress(address: string | null | undefined): StreetAddress | null {
  if (typeof address !== "string") return null;
  const segment = streetSegment(normalizeTerm(address));
  if (segment === null) return null;

  // Units ("#200", "suite 200") are dropped along with everything after them.
  const raw = segment.split(/\s*#/u)[0];
  let tokens = raw.split(/[\s\-'’.]+/u).filter((token) => token.length > 0);

  const numberMatch = CIVIC_NUMBER.exec(tokens[0] ?? "");
  if (numberMatch === null) return null;
  const number = numberMatch[1];
  tokens = tokens.slice(1);

  const unitAt = tokens.findIndex((token, index) => index > 0 && UNIT_MARKERS.has(token));
  if (unitAt !== -1) tokens = tokens.slice(0, unitAt);

  // Direction, wherever it sits: "Ontario St E", "Rue Ontario Est".
  let direction: StreetAddress["direction"] = null;
  const takeTrailingDirection = () => {
    while (tokens.length > 1 && tokens[tokens.length - 1] in DIRECTIONS) {
      direction = direction ?? DIRECTIONS[tokens[tokens.length - 1]];
      tokens = tokens.slice(0, -1);
    }
  };

  takeTrailingDirection();
  // A trailing type word: "Atwater Ave", "Wellington St". Checked before the
  // St -> Saint expansion below, because a final "st" is always "street".
  if (tokens.length > 1 && STREET_TYPES.has(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1);
  }
  takeTrailingDirection();

  // A leading type word: "Rue Wellington", "Boulevard Newman".
  while (tokens.length > 1 && STREET_TYPES.has(tokens[0]) && tokens[0] !== "st") {
    tokens = tokens.slice(1);
  }

  const street = tokens
    // A non-final "st"/"ste" is a saint's name: "rue St-Denis".
    .map((token) => (token === "st" ? "saint" : token === "ste" ? "sainte" : token))
    .filter((token) => !ARTICLES.has(token))
    .join("");

  if (street.length === 0) return null;
  return { number, street, direction };
}

/**
 * Do two addresses name the same place?
 *
 * Same civic number, same street, and directions that do not contradict each
 * other. Two addresses that cannot be parsed never match -- an unknown is not
 * a wildcard, the same rule the lead dedupe applies to a missing address.
 */
export function sameStreetAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = parseStreetAddress(a);
  const right = parseStreetAddress(b);
  if (left === null || right === null) return false;
  if (left.number !== right.number || left.street !== right.street) return false;
  return left.direction === null || right.direction === null || left.direction === right.direction;
}
