/**
 * A business's name, set as a brand.
 *
 * ── THE PROBLEM ───────────────────────────────────────────────────────────
 *
 * A logo-sized name has to be the brand, not the listing. Overture carries
 * names written for search engines: "Klyne Beauty - Salon de coiffure
 * Africaine, Dreadlocks, Tresses, microlocs, Perruques Villeray". Set in 14vw
 * type, that is not a wordmark; it is a paragraph.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * The brand is always a PREFIX of the real name, cut at a separator the
 * business itself wrote: " - ", " | ", " · ", or a parenthetical like "(Site
 * Officiel)". Nothing is rewritten, translated, abbreviated or invented, so
 * the wordmark can never say something the listing does not. The full name
 * still appears on the page -- in the footer and the contact details -- where
 * accuracy matters more than size.
 *
 * Pure and total.
 */

const SEPARATORS = [" - ", " – ", " — ", " | ", " · ", " • ", " :: "];

/** A trailing parenthetical: "(Site Officiel)", "(Pharmacie affiliée)". */
const PARENTHETICAL = /\s*\([^)]*\)\s*$/u;

export function brandName(fullName: string): string {
  let name = fullName.trim();
  const unwrapped = name.replace(PARENTHETICAL, "").trim();
  if (unwrapped.length >= 2) name = unwrapped;

  for (const separator of SEPARATORS) {
    const at = name.indexOf(separator);
    if (at >= 2) {
      name = name.slice(0, at).trim();
      break;
    }
  }
  return name.length > 0 ? name : fullName.trim();
}

/**
 * Words that describe the trade rather than name the business.
 *
 * Skipped when making a monogram, so "Salon Barbier Chez Mostafa" becomes
 * "M" rather than "SB" -- the part of the name that is actually theirs.
 */
const GENERIC = new Set([
  "salon", "salons", "coiffure", "coiffeur", "coiffeuse", "barbier", "barber", "barbershop",
  "barbers", "shop", "studio", "atelier", "beauty", "beaute", "beauté", "nails", "nail", "ongles",
  "spa", "tattoo", "tattoos", "tatouage", "hair", "the", "le", "la", "les", "l", "de", "du", "des",
  "d", "chez", "and", "et", "inc", "ltd", "enr", "institut", "esthetique", "esthétique", "clinique",
  "maison", "house", "co",
]);

/** One or two letters for a monogram mark. */
export function monogram(fullName: string): string {
  const words = brandName(fullName)
    .split(/[\s\-&'’.,/]+/u)
    .filter((word) => word.length > 0);
  const own = words.filter((word) => !GENERIC.has(word.toLowerCase()));
  const source = own.length > 0 ? own : words;

  const initial = (word: string) => {
    const digits = /^\d+/u.exec(word);
    return digits ? digits[0].slice(0, 2) : word.charAt(0).toLocaleUpperCase("fr-CA");
  };

  const letters = source.slice(0, 2).map(initial).join("");
  return letters.slice(0, 2) || "·";
}
