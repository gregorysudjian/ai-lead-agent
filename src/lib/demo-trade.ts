/**
 * The trade a demo is written for, when the business's own name says it.
 *
 * A demo's sample copy is chosen by category, and the category is whatever the
 * provider filed the business under. Overture files a great many hairdressers
 * under its catch-all "beauty salon", and OpenStreetMap tags most barbershops
 * `hairdresser`. So "Coiffure Xena" was offered a page about facials and
 * lashes, and "G&G Barbershop" one about balayage -- sample content, marked as
 * such, but about the wrong business, which is the one thing an owner notices
 * before reading a word.
 *
 * The name is a fact we hold, and the business chose it. Where it NAMES a
 * trade, that outranks the provider's filing -- the same principle as a
 * provider subtype tag outranking a search label.
 *
 * ── HOW NARROW ────────────────────────────────────────────────────────────
 *
 * Only two moves, both from a vaguer filing to a more specific trade:
 *
 *   - "Beauty salon" (the catch-all) -> hair salon, barber shop, nail salon or
 *     tattoo studio, when the name contains that trade's own word;
 *   - "Hair salon" -> barber shop, when the name says barber.
 *
 * Never the other way, and never between two specific trades: "Spa ManiPedi"
 * stays a nail salon and "Coiffure pour hommes" stays wherever it was filed.
 * A name that mentions two trades ("Coiffure & Ongles") decides nothing. The
 * words are whole words, compared without accents, from a closed list -- a
 * wrong guess here writes a page about the wrong business, so anything
 * unclear keeps the provider's category.
 *
 * This changes only what a DEMO is written for. The lead, the catalog, search
 * filters and priority keep the provider's category untouched.
 */

const HAIR = "Hair salon";
const BARBER = "Barber shop";
const NAILS = "Nail salon";
const TATTOO = "Tattoo & piercing";
const BEAUTY = "Beauty salon";

const NAMED: readonly { trade: string; words: RegExp }[] = [
  { trade: BARBER, words: /\b(?:barber|barbers|barbershop|barbershops|barbier|barbiers|barberia)\b/ },
  { trade: NAILS, words: /\b(?:nail|nails|ongle|ongles|manucure|manicure)\b/ },
  { trade: TATTOO, words: /\b(?:tattoo|tattoos|tatouage|tatouages)\b/ },
  {
    trade: HAIR,
    words: /\b(?:coiffure|coiffures|coiffeur|coiffeuse|hair|hairstyle|hairstyling|cheveux|braids|braiding|tresses|dreadlocks)\b/,
  },
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function same(a: string, b: string): boolean {
  return fold(a).trim() === fold(b).trim();
}

/** The category a demo for this business should be written for. */
export function demoTradeFor(name: string, category: string): string {
  const fromBeauty = same(category, BEAUTY);
  const fromHair = same(category, HAIR);
  if (!fromBeauty && !fromHair) return category;

  // Digits separate words too: "514braids" is an area code and a trade.
  const folded = fold(name).replace(/\d+/g, " ");
  const named = NAMED.filter((entry) => entry.words.test(folded)).map((entry) => entry.trade);
  // Two trades in one name is a business that does both; it decides nothing.
  if (named.length !== 1) return category;

  if (fromBeauty) return named[0];
  return named[0] === BARBER ? BARBER : category;
}
