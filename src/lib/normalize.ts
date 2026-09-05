/**
 * Text normalization shared by search matching and (later) deduplication.
 *
 * Pure functions, no dependencies -- easy to unit test and safe on both sides of
 * the server/client boundary.
 */

/**
 * Fold a term to a comparable form: strip accents, lowercase, collapse runs of
 * whitespace, trim.
 *
 *   "  MONTRÉAL "  -> "montreal"
 *   "Hair  Salons" -> "hair salons"
 *
 * Accent folding matters here specifically because "Montreal" and "Montréal"
 * must be treated as the same city.
 *
 * `̀-ͯ` is the combining diacritical marks block; after NFD
 * normalization an accented character decomposes into its base letter plus one
 * of these marks, so removing them leaves the plain letter behind. (The tidier
 * `\p{Diacritic}` escape would require a TypeScript target of ES2018+.)
 */
export function normalizeTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loose containment match, used for the free-text category field.
 *
 * Matching in both directions is what makes singular/plural work without any
 * stemming library: the query "hair salons" contains the category "hair salon",
 * and the category "hair salon" contains the query "salon".
 */
export function looselyMatches(candidate: string, query: string): boolean {
  const a = normalizeTerm(candidate);
  const b = normalizeTerm(query);
  if (a.length === 0 || b.length === 0) return false;
  return a.includes(b) || b.includes(a);
}

/** Exact match after normalization. Used for city, where containment is too loose. */
export function equalsNormalized(a: string, b: string): boolean {
  return normalizeTerm(a) === normalizeTerm(b);
}
