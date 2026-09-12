import { mapOvertureCategory, mappedOvertureCategories } from "../overture/categories";
import { normalizeOverturePlace } from "../overture/normalize";
import { catalogExclusion, type ExclusionReason } from "./exclusion";
import { placeLocality, withinBbox, type CatalogArea } from "./area";
import { CATALOG_TRADE_KEYS } from "./trades";
import type { CatalogRecord } from "./types";

/**
 * Turn flat Overture rows into catalog records. Pure.
 *
 * The extract script owns the DuckDB query and nothing else; every judgement
 * about a row is made here, where it can be tested without a 7GB dataset:
 *
 *   - is it one of the catalog's trades?          (overture/categories.ts)
 *   - is it inside the area, by its OWN locality? (catalog/area.ts)
 *   - is it a usable business at all?            (overture/normalize.ts)
 *
 * A row that fails any of them is dropped and counted, never approximated.
 * Unplaced localities are tallied by spelling so a new variant appearing in a
 * future release -- a fresh misspelling of a borough, say -- shows up in the
 * report instead of silently shrinking the catalog.
 */

/** One row as the extract query projects it: scalars, no driver wrappers. */
export interface FlatOvertureRow {
  id: string | null;
  name: string | null;
  category: string | null;
  confidence: number | null;
  website: string | null;
  phone: string | null;
  street: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CatalogRecordsResult {
  records: CatalogRecord[];
  /** Rows in a catalog trade whose locality is not in the area, by spelling. */
  outsideArea: Map<string, number>;
  /** Rows dropped for another reason: no name, no id, or not a catalog trade. */
  unusable: number;
  /** Rows sharing a provider id with an earlier row. */
  duplicateIds: number;
  /** Rows the catalog does not offer (see `exclusion.ts`), by reason. */
  excluded: Partial<Record<ExclusionReason, number>>;
}

/**
 * The Overture categories the catalog collects, for the query's WHERE clause.
 *
 * Derived from the mapping rather than listed again, so adding a trade to
 * `CATALOG_TRADE_KEYS` or a category to the Overture mapping changes what the
 * extract reads without a second edit that could be forgotten.
 */
export function catalogOvertureCategories(): string[] {
  return mappedOvertureCategories().filter((category) => {
    const key = mapOvertureCategory(category)?.key;
    return key !== undefined && CATALOG_TRADE_KEYS.includes(key);
  });
}

function usableCoordinate(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildCatalogRecords(
  rows: readonly FlatOvertureRow[],
  area: CatalogArea,
  fetchedAt: string,
): CatalogRecordsResult {
  const collected = new Set(catalogOvertureCategories());
  const records: CatalogRecord[] = [];
  const outsideArea = new Map<string, number>();
  const seenIds = new Set<string>();
  let unusable = 0;
  let duplicateIds = 0;
  const excluded: Partial<Record<ExclusionReason, number>> = {};

  for (const row of rows) {
    if (row.category === null || !collected.has(row.category.trim().toLowerCase())) {
      unusable += 1;
      continue;
    }

    const placed = placeLocality(area, row.locality);
    if (placed === null) {
      const spelling = row.locality?.trim() || "(no locality)";
      outsideArea.set(spelling, (outsideArea.get(spelling) ?? 0) + 1);
      continue;
    }

    const business = normalizeOverturePlace(
      {
        id: row.id,
        names: { primary: row.name },
        categories: { primary: row.category },
        confidence: row.confidence,
        websites: row.website === null ? null : [row.website],
        phones: row.phone === null ? null : [row.phone],
        addresses: [{ freeform: row.street, locality: row.locality }],
      },
      { fetchedAt, cityLabel: placed.place },
    );
    if (business === null) {
      unusable += 1;
      continue;
    }

    // A chain, a pharmacy or a broken name never enters the catalog.
    const exclusion = catalogExclusion(business);
    if (exclusion !== null) {
      excluded[exclusion] = (excluded[exclusion] ?? 0) + 1;
      continue;
    }

    if (seenIds.has(business.externalId)) {
      duplicateIds += 1;
      continue;
    }
    seenIds.add(business.externalId);

    const location =
      usableCoordinate(row.latitude) &&
      usableCoordinate(row.longitude) &&
      withinBbox(area, row.latitude, row.longitude)
        ? { latitude: row.latitude, longitude: row.longitude }
        : null;

    records.push({
      // The canonical place name, not the provider's spelling of it:
      // "MONTREAL", "Montreal," and "Montréal, QC" all become "Montréal",
      // and "La Salle" becomes "LaSalle". The same place, written once.
      business: { ...business, city: placed.place },
      municipality: placed.municipality,
      location,
    });
  }

  return { records, outsideArea, unusable, duplicateIds, excluded };
}
