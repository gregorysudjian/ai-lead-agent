/**
 * Curated registry of cities we will query OpenStreetMap for.
 *
 * Pure and deterministic -- no I/O, safe on both sides of the boundary.
 *
 * User-supplied city text NEVER reaches an Overpass query. It is resolved
 * against this registry first, and an unrecognised city is rejected before any
 * network call happens. That keeps arbitrary text out of Overpass QL and stops
 * us firing speculative queries at shared community infrastructure.
 */
import { normalizeTerm } from "../normalize";

export interface SupportedCity {
  /** Canonical key used internally. */
  key: string;
  /** Canonical label stored on the lead and shown in the UI. */
  label: string;
  /** Accepted spellings. Compared after accent/case/whitespace normalization. */
  aliases: string[];
  /**
   * Wikidata identifier of the city's OSM administrative boundary.
   *
   * A Wikidata ID is used rather than a name match because it is stable and
   * unambiguous: "Montréal" alone also matches the wider administrative region
   * (admin_level=5, Q1474984), which covers far more than the city.
   */
  wikidataId: string;
  /**
   * The OSM relation this resolves to, recorded for traceability.
   * Verified against live OSM data: relation 1634158, name "Montréal",
   * boundary=administrative, admin_level=8, wikidata=Q340.
   */
  osmRelationId: number;
}

export const SUPPORTED_CITIES: readonly SupportedCity[] = [
  {
    key: "montreal",
    label: "Montreal",
    aliases: ["montreal", "montréal", "montreal qc", "montréal qc", "ville de montreal"],
    wikidataId: "Q340",
    osmRelationId: 1634158,
  },
];

/**
 * Resolve free-text city input to a supported city, or null.
 *
 * Uses the Phase 1 `normalizeTerm`, so "Montréal", " MONTREAL " and "montreal"
 * all resolve to the same entry.
 */
export function resolveSupportedCity(input: string): SupportedCity | null {
  const needle = normalizeTerm(input);
  if (needle.length === 0) return null;

  return (
    SUPPORTED_CITIES.find((city) =>
      city.aliases.some((alias) => normalizeTerm(alias) === needle),
    ) ?? null
  );
}

/** Labels of every supported city, for client-safe validation messages. */
export function supportedCityLabels(): string[] {
  return SUPPORTED_CITIES.map((city) => city.label);
}
