/**
 * List the categories Overture actually uses in a region.
 *
 * The mapping in `lib/overture/categories.ts` is written against THIS output,
 * not against a guess at the taxonomy. A category we invent a mapping for and
 * that never appears is dead code; one that appears and we missed is a whole
 * trade quietly excluded from every search.
 */
import { DuckDBInstance } from "@duckdb/node-api";

const PLACES = `s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*.parquet`;
// Quebec, generously.
const BBOX = { west: -79.8, south: 44.9, east: -57.1, north: 62.6 };

const instance = await DuckDBInstance.create(":memory:");
const db = await instance.connect();
await db.run("INSTALL httpfs; LOAD httpfs;");
await db.run("SET s3_region='us-west-2';");

const reader = await db.runAndReadAll(`
  SELECT categories.primary AS category, count(*) AS n
  FROM read_parquet('${PLACES}')
  WHERE bbox.xmin BETWEEN ${BBOX.west} AND ${BBOX.east}
    AND bbox.ymin BETWEEN ${BBOX.south} AND ${BBOX.north}
    AND categories.primary IS NOT NULL
  GROUP BY 1 HAVING count(*) >= 25 ORDER BY n DESC
`);

const rows = reader.getRowObjects();
console.log(`distinct categories with >=25 places in Quebec: ${rows.length}\n`);
for (const r of rows) console.log(`${String(Number(r.n)).padStart(6)}  ${r.category}`);
await db.closeSync();
