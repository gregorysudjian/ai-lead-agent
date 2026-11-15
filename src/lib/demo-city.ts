/**
 * How a demo page writes the business's city.
 *
 * The city is a fact we hold, but its SPELLING depends on who supplied it:
 * the OpenStreetMap registry stores "Montreal", Overture stores "Montréal".
 * A French page that says "Barbier à Montreal" reads as a page nobody in
 * Quebec proofread, so the French version uses the official French name.
 * English keeps what the provider stored -- both spellings are in use there.
 *
 * A closed map, not a transliteration: a city we have not listed is shown
 * exactly as stored rather than guessed at.
 */
const FRENCH_CITY_NAMES: Readonly<Record<string, string>> = {
  montreal: "Montréal",
  "montreal-est": "Montréal-Est",
  "montreal-ouest": "Montréal-Ouest",
  "montreal-nord": "Montréal-Nord",
  quebec: "Québec",
  "quebec city": "Québec",
  "trois-rivieres": "Trois-Rivières",
  levis: "Lévis",
  "cote-saint-luc": "Côte-Saint-Luc",
  "baie-d'urfe": "Baie-D'Urfé",
  "l'ile-dorval": "L'Île-Dorval",
};

/** Lower-case and strip accents, so "Montréal" and "Montreal" compare equal. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** The city as a page in `locale` should write it. */
export function localizedCity(city: string, locale: "en" | "fr"): string {
  if (locale !== "fr") return city;
  return FRENCH_CITY_NAMES[fold(city)] ?? city;
}

/**
 * True when the address line already names the city.
 *
 * Providers disagree about whether an address ends with its city, so a page
 * that always prints the city under the address shows "1188 Rue Ontario Est,
 * Montréal" followed by "Montreal". Compared accent-insensitively and on a
 * word boundary, so "Montréal-Est" does not count as naming "Montréal".
 */
export function addressNamesCity(address: string | null, city: string): boolean {
  if (address === null) return false;
  const needle = fold(city);
  if (needle.length === 0) return false;
  const haystack = fold(address);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + needle.length] ?? "";
    if (!/[a-z0-9-]/.test(before) && !/[a-z0-9-]/.test(after)) return true;
    from = at + 1;
  }
}
