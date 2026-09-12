import type { Coordinates, GoogleCheckVerdict } from "./types";

/**
 * Deciding whether a Google Maps search result IS our business.
 *
 * ── WHY THIS IS THE HARD PART ─────────────────────────────────────────────
 *
 * Google's text search always answers with SOMETHING. Ask it for a salon that
 * closed years ago and it returns the salon next door, or one with a similar
 * name across town. Treating "Google returned a place" as "the business is
 * real" would verify everything; so every result is judged on two things
 * together: is the NAME the same business's name, and is the place WHERE we
 * have it?
 *
 * Names differ in harmless ways between datasets ("Salon Coiffure Lumière" /
 * "Lumière Coiffure", "2Cut BarberShop & TattooShop" / "2Cut Barbershop"), so
 * names are compared on their distinctive words: accents, case, punctuation,
 * small words and trade words ("salon", "coiffure", "barbier", "nails") are
 * set aside first, because every salon on the street shares them.
 *
 * Positions differ too -- one dataset pins the door, the other the middle of
 * the building -- so the closer the names agree, the more distance is allowed.
 *
 * ── HONEST OUTCOMES ───────────────────────────────────────────────────────
 *
 * A match is `verified` (or `closed`, when Google marks that place permanently
 * closed). A result that is suggestive but not decisive -- a matching name two
 * kilometres away, a half-matching name next door -- is `uncertain`, and an
 * uncertain business stays visible: a check that cannot decide is not a reason
 * to hide anything. Only when nothing Google returned resembles the business
 * in the place we have it is the verdict `not_found`.
 *
 * Pure: no I/O. Google's data passes through here in memory and is never
 * stored -- the result carries only Google's place id and our scores.
 */

/** One place from a Google text search, as much of it as the judgement needs. */
export interface GoogleCandidate {
  placeId: string;
  name: string;
  location: Coordinates | null;
  /** Google's businessStatus: OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY. */
  businessStatus: string | null;
  formattedAddress: string | null;
}

/** Our side: what we believe the business is and where. */
export interface MatchTarget {
  name: string;
  address: string | null;
  location: Coordinates | null;
}

export interface MatchOutcome {
  verdict: GoogleCheckVerdict;
  /** Google's place id of the matched place. Null unless verified or closed. */
  placeId: string | null;
  /** The closest candidate's scores, for the report. Null when Google returned nothing. */
  best: { nameScore: number; distanceMetres: number | null } | null;
  /** One line a person can read: why this verdict. */
  reason: string;
}

// ── Names ────────────────────────────────────────────────────────────────

/** Words that carry no identity: articles, joiners, company suffixes. */
const SMALL_WORDS = new Set([
  "le", "la", "les", "l", "de", "du", "des", "d", "et", "and", "the", "a", "au", "aux", "en",
  "chez", "par", "by", "of", "inc", "enr", "ltd", "ltee", "sa", "co", "cie", "pour", "for",
]);

/**
 * The city's own name. Usually a suffix ("Studio Gus Tattoo Montréal") that
 * says nothing about which shop it is -- but sometimes it IS the name
 * ("MTL Tattoo"), so it counts only when nothing else distinctive is left.
 */
const PLACE_WORDS = new Set(["mtl", "montreal"]);

/** Words every business in a trade shares. Set aside so they cannot make a match. */
const TRADE_WORDS = new Set([
  "salon", "salons", "coiffure", "coiffures", "coiffeur", "coiffeuse", "coiffeurs", "barbier",
  "barbiers", "barber", "barbers", "barbershop", "barbershops", "barbering", "shop", "studio",
  "spa", "beaute", "beauty", "esthetique", "esthetiques", "esthetics", "institut", "nail", "nails",
  "ongle", "ongles", "onglerie", "hair", "cheveux", "haircut", "tattoo", "tattoos", "tatouage",
  "tatouages", "piercing", "piercings", "lounge", "unisex", "unisexe", "hommes", "homme", "femmes",
  "coupe", "coupes", "cut", "cuts", "dames", "dame", "ladies",
]);

/** Lower-case, accents and punctuation removed, split into words. */
export function nameWords(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0 && !SMALL_WORDS.has(word));
}

/** The words that tell this business apart from its neighbours. */
function distinctive(words: string[]): string[] {
  const telling = words.filter((word) => !TRADE_WORDS.has(word));
  const withoutPlace = telling.filter((word) => !PLACE_WORDS.has(word));
  return withoutPlace.length > 0 ? withoutPlace : telling;
}

/** Sørensen–Dice similarity of two strings' letter pairs, 0..1. */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const pair = a.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const pair = b.slice(i, i + 2);
    const left = pairs.get(pair) ?? 0;
    if (left > 0) {
      shared += 1;
      pairs.set(pair, left - 1);
    }
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/** Two words count as the same word when equal, or near-equal and not tiny. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && dice(a, b) >= 0.8;
}

/**
 * How alike two business names are, 0..1.
 *
 * The best of three views of the distinctive words: the share of the shorter
 * name's words found in the longer one, letter-pair similarity of the words
 * run together (so "A.kuts" meets "Akuts"), and containment of one run-together
 * name in the other. A name made only of trade words ("Salon de coiffure") is
 * compared on all its words but capped at 0.7: a generic name alone should
 * never be enough to match at a distance.
 */
export function nameSimilarity(ours: string, theirs: string): number {
  const oursAll = nameWords(ours);
  const theirsAll = nameWords(theirs);
  if (oursAll.length === 0 || theirsAll.length === 0) return 0;

  let a = distinctive(oursAll);
  let b = distinctive(theirsAll);
  const generic = a.length === 0 || b.length === 0;
  if (generic) {
    a = oursAll;
    b = theirsAll;
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const found = shorter.filter((word) => longer.some((other) => sameWord(word, other))).length;
  const overlap = found / shorter.length;

  const joinedA = a.join("");
  const joinedB = b.join("");
  const letters = dice(joinedA, joinedB);
  const [small, big] = joinedA.length <= joinedB.length ? [joinedA, joinedB] : [joinedB, joinedA];
  const contained = small.length >= 4 && big.includes(small) ? 0.9 : 0;

  const score = Math.max(overlap, letters, contained);
  return generic ? Math.min(score, 0.7) : score;
}

/**
 * Whether two names are the same name outright -- every word, trade words
 * included -- and distinctive enough that sharing it is not a coincidence.
 *
 * Used for one question only: is the business on Google Maps at a DIFFERENT
 * address? "Cheveux Depot" / "CHEVEUX DEPOT INC" 13 km away qualifies;
 * "La Mousse" / "La Mousse Coiffure" and "M Salon" / "M Salon" do not.
 */
export function sameNameOutright(ours: string, theirs: string): boolean {
  // The city is set aside on both sides: "Yumi Lashes Montréal" and "YUMI
  // Lashes MTL" are the same name written for two audiences.
  const a = nameWords(ours).filter((word) => !PLACE_WORDS.has(word));
  const b = nameWords(theirs).filter((word) => !PLACE_WORDS.has(word));
  if (distinctive(a).join("").length < 4) return false;
  return dice(a.join(""), b.join("")) >= 0.9;
}

// ── Places ───────────────────────────────────────────────────────────────

/** Great-circle distance in metres. */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** The civic number an address starts with ("4500 Rue Wellington" -> "4500"). */
function civicNumber(address: string | null): string | null {
  const match = address?.trim().match(/^(\d+)[a-z]?\b/i);
  return match ? match[1] : null;
}

/**
 * How far apart two records of the SAME business can plausibly be, given how
 * well their names agree. Datasets pin a door, a roof or a parcel centre, so
 * an exact name earns more slack than a near one.
 */
export const MATCH_RULES = [
  { minName: 0.85, maxMetres: 600 },
  { minName: 0.75, maxMetres: 250 },
  { minName: 0.6, maxMetres: 120 },
] as const;

/** Suggestive but not decisive: keep the business, flag it for a person. */
const UNCERTAIN_RULES = [
  { minName: 0.85, maxMetres: 3000 },
  { minName: 0.5, maxMetres: 400 },
] as const;

/** "Same name, other address" counts anywhere on or around the island. */
const SAME_NAME_ELSEWHERE_METRES = 30_000;

function passes(rules: readonly { minName: number; maxMetres: number }[], name: number, metres: number) {
  return rules.some((rule) => name >= rule.minName && metres <= rule.maxMetres);
}

/** Judge Google's answer for one business. */
export function judgeGoogleMatch(target: MatchTarget, candidates: readonly GoogleCandidate[]): MatchOutcome {
  if (candidates.length === 0) {
    return { verdict: "not_found", placeId: null, best: null, reason: "Google returned no place for this search." };
  }

  const scored = candidates.map((candidate) => {
    const nameScore = nameSimilarity(target.name, candidate.name);
    const metres =
      target.location !== null && candidate.location !== null
        ? distanceMetres(target.location, candidate.location)
        : null;
    // Without our own coordinates (a lead from an older search), the civic
    // number stands in for position: same name, same door number.
    const ourDoor = civicNumber(target.address);
    const theirDoor = civicNumber(candidate.formattedAddress);
    // Within ten: one listing gives 3339 and the other 3337 for the same shop
    // front. Beyond that it is another building.
    const sameDoor =
      metres === null && ourDoor !== null && theirDoor !== null && Math.abs(Number(ourDoor) - Number(theirDoor)) <= 10;
    const matched = metres !== null ? passes(MATCH_RULES, nameScore, metres) : sameDoor && nameScore >= 0.75;
    const suggestive = metres !== null ? passes(UNCERTAIN_RULES, nameScore, metres) : nameScore >= 0.85;
    return { candidate, nameScore, metres, matched, suggestive };
  });

  // The best candidate: a match beats a non-match, then the better name, then the nearer.
  scored.sort(
    (x, y) =>
      Number(y.matched) - Number(x.matched) ||
      y.nameScore - x.nameScore ||
      (x.metres ?? Infinity) - (y.metres ?? Infinity),
  );
  const top = scored[0];
  const best = {
    nameScore: Math.round(top.nameScore * 100) / 100,
    distanceMetres: top.metres === null ? null : Math.round(top.metres),
  };
  const where = top.metres === null ? "" : `, ${best.distanceMetres} m away`;

  if (top.matched) {
    if (top.candidate.businessStatus === "CLOSED_PERMANENTLY") {
      return {
        verdict: "closed",
        placeId: top.candidate.placeId,
        best,
        reason: `Google lists it as permanently closed (name ${Math.round(best.nameScore * 100)}% alike${where}).`,
      };
    }
    return {
      verdict: "verified",
      placeId: top.candidate.placeId,
      best,
      reason: `Matched on Google Maps (name ${Math.round(best.nameScore * 100)}% alike${where}).`,
    };
  }

  const suggestive = scored.find((entry) => entry.suggestive);
  if (suggestive) {
    const metres = suggestive.metres === null ? "" : `, ${Math.round(suggestive.metres)} m away`;
    return {
      verdict: "uncertain",
      // Not kept: it may be a different business, and a stored id would make
      // the Maps link open that one as if it were ours.
      placeId: null,
      best: {
        nameScore: Math.round(suggestive.nameScore * 100) / 100,
        distanceMetres: suggestive.metres === null ? null : Math.round(suggestive.metres),
      },
      reason: `A similar place came back but not close enough to be sure (name ${Math.round(suggestive.nameScore * 100)}% alike${metres}).`,
    };
  }

  // The same name, in full, somewhere else on the island: the business is
  // probably real and our address out of date (or it moved). Not a reason to
  // hide it -- a person should look.
  const elsewhere = scored.find(
    (entry) =>
      sameNameOutright(target.name, entry.candidate.name) &&
      (entry.metres === null || entry.metres <= SAME_NAME_ELSEWHERE_METRES),
  );
  if (elsewhere) {
    const km = elsewhere.metres === null ? "" : ` ${(elsewhere.metres / 1000).toFixed(1)} km away`;
    return {
      verdict: "uncertain",
      placeId: null,
      best: {
        nameScore: Math.round(elsewhere.nameScore * 100) / 100,
        distanceMetres: elsewhere.metres === null ? null : Math.round(elsewhere.metres),
      },
      reason: `On Google Maps under the same name${km}: our address may be out of date.`,
    };
  }

  return {
    verdict: "not_found",
    placeId: null,
    best,
    reason: `Nothing Google returned matches it (closest name ${Math.round(best.nameScore * 100)}% alike${where}).`,
  };
}
