/**
 * Reading Overture's public Parquet for a catalog area.
 *
 * The only module that speaks DuckDB. It projects Overture's nested structs
 * into plain scalars in SQL -- the driver returns wrapper objects for structs,
 * and no domain function should ever learn a database driver's shape -- and
 * hands the rows to `buildCatalogRecords`, which makes every judgement.
 *
 * Reads only, from a public bucket, with no credentials. Free.
 */
import { DuckDBInstance } from "@duckdb/node-api";

import type { CatalogArea } from "../../src/lib/catalog/area";
import { catalogOvertureCategories, type FlatOvertureRow } from "../../src/lib/catalog/overture-records";
import { parseReleaseListing } from "../../src/lib/catalog/releases";

/** The release the catalog was first built from, and the fallback. */
export const DEFAULT_RELEASE = "2026-08-19.0";

/**
 * Overture release names: an ISO date and a revision, "2026-08-19.0".
 *
 * Checked before the name goes anywhere near the query. It is interpolated
 * into an S3 path, and a value from an environment variable or a command line
 * is not something to paste into SQL on trust.
 */
export const RELEASE_PATTERN = /^\d{4}-\d{2}-\d{2}\.\d+$/;

export function assertRelease(release: string): string {
  if (!RELEASE_PATTERN.test(release)) {
    throw new Error(`"${release}" is not an Overture release name (expected e.g. 2026-08-19.0).`);
  }
  return release;
}

/**
 * Every release name Overture has published, oldest first, from the public
 * bucket's listing. No credentials; one small request.
 */
export async function listReleases(): Promise<string[]> {
  const response = await fetch(
    "https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/",
  );
  if (!response.ok) throw new Error(`Could not list Overture releases (HTTP ${response.status}).`);
  return parseReleaseListing(await response.text());
}

export function placesPath(release: string): string {
  return `s3://overturemaps-us-west-2/release/${assertRelease(release)}/theme=places/type=place/*.parquet`;
}

async function connect() {
  const instance = await DuckDBInstance.create(":memory:");
  const db = await instance.connect();
  await db.run("INSTALL httpfs; LOAD httpfs;");
  await db.run("SET s3_region='us-west-2';");
  return db;
}

/**
 * Every place in the area's box, in the area's province, in a catalog trade,
 * at or above the confidence threshold.
 *
 * The box prunes the scan and the province code narrows it; neither decides
 * membership. That is `placeLocality`'s job, downstream.
 */
export async function queryAreaPlaces(
  area: CatalogArea,
  release: string,
  minConfidence: number,
): Promise<FlatOvertureRow[]> {
  const [country, region] = area.region.split(":");
  if (!/^[A-Z]{2}$/.test(country ?? "") || !/^[A-Z]{2}$/.test(region ?? "")) {
    throw new Error(`Area ${area.key} has an unusable region code: ${area.region}.`);
  }
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error(`Confidence must be between 0 and 1, got ${minConfidence}.`);
  }

  const [west, south, east, north] = area.bbox;
  // Registry values, never user input: safe to inline.
  const categories = catalogOvertureCategories()
    .map((category) => `'${category.replace(/'/g, "''")}'`)
    .join(", ");

  const db = await connect();
  try {
    const reader = await db.runAndReadAll(`
      SELECT
        id,
        names.primary                     AS name,
        categories.primary                AS category,
        confidence,
        websites[1]                       AS website,
        phones[1]                         AS phone,
        addresses[1].freeform             AS street,
        addresses[1].locality             AS locality,
        (bbox.ymin + bbox.ymax) / 2       AS latitude,
        (bbox.xmin + bbox.xmax) / 2       AS longitude
      FROM read_parquet('${placesPath(release)}')
      WHERE bbox.xmin BETWEEN ${west} AND ${east}
        AND bbox.ymin BETWEEN ${south} AND ${north}
        AND addresses[1].country = '${country}'
        AND addresses[1].region = '${region}'
        AND confidence >= ${minConfidence}
        AND categories.primary IN (${categories})
    `);
    return reader.getRowObjects().map((row) => ({
      id: typeof row.id === "string" ? row.id : null,
      name: typeof row.name === "string" ? row.name : null,
      category: typeof row.category === "string" ? row.category : null,
      confidence: row.confidence === null ? null : Number(row.confidence),
      website: typeof row.website === "string" ? row.website : null,
      phone: typeof row.phone === "string" ? row.phone : null,
      street: typeof row.street === "string" ? row.street : null,
      locality: typeof row.locality === "string" ? row.locality : null,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    }));
  } finally {
    db.closeSync();
  }
}
