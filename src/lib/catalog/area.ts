import { normalizeTerm } from "../normalize";

/**
 * The area the business catalog covers, and how a provider's free-text
 * locality is placed inside it.
 *
 * ── WHY THE ISLAND, NOT THE CITY ──────────────────────────────────────────
 *
 * The Overpass registry in `osm/cities.ts` pins "Montreal" to the City of
 * Montréal (Wikidata Q340), which is the right boundary for a live query. The
 * catalog is a different question -- "which businesses would an operator in
 * Montreal want to hear about" -- and to anyone who lives here Westmount,
 * Pointe-Claire and Dorval are Montreal. So the catalog covers the whole
 * island: the City of Montréal's boroughs plus the fifteen municipalities that
 * demerged from it in 2006. Laval and the South Shore are deliberately out.
 *
 * ── THE BOX PRUNES; THE LOCALITY DECIDES ──────────────────────────────────
 *
 * `bbox` exists so a bulk read of Overture's Parquet touches a fraction of the
 * dataset. It cannot decide membership: the rectangle around the island also
 * contains Laval, Longueuil, Brossard and Terrebonne, and in the 2026-08-19.0
 * release it also contains rows whose locality says Drummondville or
 * St-Hyacinthe -- places sixty kilometres away, misfiled onto Montreal
 * coordinates. The locality list is what decides, and it refuses both.
 *
 * Two names shared with towns elsewhere in Quebec -- Mercier and Ville-Marie --
 * are handled by the box, not the list: neither town is inside it.
 *
 * ── SPELLINGS ARE DATA ────────────────────────────────────────────────────
 *
 * Every alias below was read out of the release, not guessed. Overture carries
 * "Dollard-des Ormeaux", "Dollard-des-Ormeaux" and "Dollard Des Ormeaux";
 * "Côte-St-Luc", "Cote Saint-Luc" and "Côte Saint-Luc," with a trailing comma.
 * `localityKey` folds all of those onto one key, so the lists hold one entry
 * per real place rather than one per spelling.
 *
 * Pure and total: no I/O, never throws.
 */

/** A named place with a canonical label and the spellings that mean it. */
export interface NamedPlace {
  /** How the place is shown and stored. The official name, accents included. */
  label: string;
  /** Other names for the same place. Folded through `localityKey`. */
  aliases: readonly string[];
}

export interface Municipality extends NamedPlace {
  /**
   * Named districts inside this municipality that providers sometimes use as
   * the locality instead of the municipality itself -- "Verdun" rather than
   * "Montréal". Kept as their own names so the more specific fact survives,
   * while every one of them still files under this municipality for filtering.
   */
  districts: readonly NamedPlace[];
}

export interface CatalogArea {
  key: string;
  label: string;
  /** Region code in the shape the ingest takes: `CA:QC`. */
  region: string;
  /** `[west, south, east, north]`. A pruning hint, never a membership test. */
  bbox: readonly [number, number, number, number];
  municipalities: readonly Municipality[];
}

/** Where a locality landed inside the area. */
export interface PlacedLocality {
  /** The municipality, for filtering: "Montréal", "Westmount". */
  municipality: string;
  /**
   * The most specific name we can honestly give: a district when the provider
   * named one ("Verdun"), otherwise the municipality itself.
   */
  place: string;
}

/**
 * Fold a locality to a comparison key.
 *
 * Goes further than `normalizeTerm`, because locality spellings vary in ways
 * business names do not:
 *
 *   "Côte-St-Luc", "Cote Saint-Luc", "Côte Saint-Luc,"  -> "cotesaintluc"
 *   "LaSalle", "La Salle", "Lasalle"                     -> "lasalle"
 *   "Montréal, QC", "Montreal,", "MONTREAL"              -> "montreal"
 *
 * Steps: accents and case (via `normalizeTerm`), drop a trailing province
 * code and stray punctuation, expand the St/Ste abbreviations, then remove
 * every separator so hyphen-versus-space stops mattering.
 */
export function localityKey(value: string): string {
  const folded = normalizeTerm(value)
    // "Montréal, QC" and "Montréal QC" name the city, not a different place.
    .replace(/[,\s]+(qc|quebec|québec)\.?$/u, "")
    .replace(/[.,;]+$/u, "");

  // Hyphens, the en and em dashes official borough names use
  // ("Côte-des-Neiges–Notre-Dame-de-Grâce"), and both apostrophes.
  const tokens = folded
    .split(/[\s\-‐-―'’]+/u)
    .filter((token) => token.length > 0)
    .map((token) => (token === "st" ? "saint" : token === "ste" ? "sainte" : token));

  return tokens.join("");
}

/**
 * The island of Montreal.
 *
 * Municipality labels are the official names. The City of Montréal's districts
 * are the borough and neighbourhood names Overture actually uses as a
 * locality; the rest of each borough's businesses simply say "Montréal".
 */
export const MONTREAL_ISLAND: CatalogArea = {
  key: "montreal-island",
  label: "Island of Montreal",
  region: "CA:QC",
  // Generous on purpose. Senneville's western tip is about -73.97, Pointe-aux-
  // Trembles' eastern tip about -73.47. Mercier (Montérégie, 45.32N) and
  // Ville-Marie (Abitibi, 47.33N) both fall outside it.
  bbox: [-74.05, 45.38, -73.44, 45.74],
  municipalities: [
    {
      label: "Montréal",
      // No "Montreal": `localityKey` already folds it onto the label, and the
      // registry test refuses an alias that duplicates a key. "Montral" is a
      // typo observed in the 2026-08-19.0 release, on a Rosemont business;
      // no other place has that name, so recovering it costs nothing.
      aliases: ["Ville de Montréal", "City of Montreal", "Montral"],
      districts: [
        { label: "Ahuntsic-Cartierville", aliases: ["Ahuntsic", "Cartierville"] },
        { label: "Anjou", aliases: [] },
        {
          label: "Côte-des-Neiges–Notre-Dame-de-Grâce",
          aliases: ["Côte-des-Neiges", "Notre-Dame-de-Grâce", "NDG"],
        },
        { label: "Lachine", aliases: [] },
        { label: "LaSalle", aliases: [] },
        { label: "Le Plateau-Mont-Royal", aliases: ["Plateau-Mont-Royal", "Plateau"] },
        { label: "Le Sud-Ouest", aliases: ["Sud-Ouest"] },
        { label: "L'Île-Bizard", aliases: ["Île-Bizard"] },
        { label: "Sainte-Geneviève", aliases: [] },
        { label: "Mercier", aliases: [] },
        { label: "Hochelaga-Maisonneuve", aliases: ["Hochelaga"] },
        { label: "Montréal-Nord", aliases: [] },
        { label: "Outremont", aliases: [] },
        { label: "Pierrefonds-Roxboro", aliases: [] },
        { label: "Pierrefonds", aliases: [] },
        { label: "Roxboro", aliases: [] },
        { label: "Rivière-des-Prairies", aliases: [] },
        { label: "Pointe-aux-Trembles", aliases: [] },
        { label: "Rosemont", aliases: ["Rosemont–La Petite-Patrie"] },
        { label: "La Petite-Patrie", aliases: ["Petite-Patrie"] },
        { label: "Saint-Laurent", aliases: [] },
        { label: "Saint-Léonard", aliases: [] },
        { label: "Verdun", aliases: [] },
        { label: "Ville-Marie", aliases: [] },
        { label: "Villeray", aliases: [] },
        { label: "Saint-Michel", aliases: [] },
        { label: "Parc-Extension", aliases: ["Parc-Ex"] },
      ],
    },
    // The fifteen municipalities that demerged in 2006. Separate cities that
    // happen to share the island -- which is exactly why they belong here and
    // not in the Overpass registry's City of Montréal.
    { label: "Baie-D'Urfé", aliases: [], districts: [] },
    { label: "Beaconsfield", aliases: [], districts: [] },
    { label: "Côte-Saint-Luc", aliases: [], districts: [] },
    { label: "Dollard-Des Ormeaux", aliases: ["DDO"], districts: [] },
    { label: "Dorval", aliases: [], districts: [] },
    { label: "Hampstead", aliases: [], districts: [] },
    { label: "Kirkland", aliases: [], districts: [] },
    { label: "L'Île-Dorval", aliases: [], districts: [] },
    { label: "Montréal-Est", aliases: ["Montreal East"], districts: [] },
    { label: "Montréal-Ouest", aliases: ["Montreal West"], districts: [] },
    { label: "Mont-Royal", aliases: ["Town of Mount Royal", "Mount Royal", "TMR"], districts: [] },
    { label: "Pointe-Claire", aliases: [], districts: [] },
    { label: "Sainte-Anne-de-Bellevue", aliases: [], districts: [] },
    { label: "Senneville", aliases: [], districts: [] },
    { label: "Westmount", aliases: [], districts: [] },
  ],
};

/** Every key a place answers to: its label plus its aliases. */
function keysOf(place: NamedPlace): string[] {
  return [place.label, ...place.aliases].map(localityKey);
}

/**
 * Place a provider's locality inside the area, or return null.
 *
 * Null means "not in this area as far as the provider's own label says" --
 * including a missing locality. A row with no locality is not assumed to be
 * inside; probably is not evidence, and the same rule already governs an
 * unrecognised category.
 */
export function placeLocality(
  area: CatalogArea,
  locality: string | null | undefined,
): PlacedLocality | null {
  if (typeof locality !== "string") return null;
  const key = localityKey(locality);
  if (key.length === 0) return null;

  for (const municipality of area.municipalities) {
    if (keysOf(municipality).includes(key)) {
      return { municipality: municipality.label, place: municipality.label };
    }
    for (const district of municipality.districts) {
      if (keysOf(district).includes(key)) {
        return { municipality: municipality.label, place: district.label };
      }
    }
  }
  return null;
}

/** Is a coordinate inside the area's pruning box? */
export function withinBbox(area: CatalogArea, latitude: number, longitude: number): boolean {
  const [west, south, east, north] = area.bbox;
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

/** Municipality labels in display order, for filters. */
export function municipalityLabels(area: CatalogArea): string[] {
  return area.municipalities.map((municipality) => municipality.label);
}

/** Catalog areas by key. One today; the shape allows more without a rewrite. */
export const CATALOG_AREAS: readonly CatalogArea[] = [MONTREAL_ISLAND];

export function resolveCatalogArea(key: string): CatalogArea | null {
  return CATALOG_AREAS.find((area) => area.key === key) ?? null;
}
