/**
 * Extract a region's businesses from Overture into a local file.
 *
 *   npx tsx scripts/overture-ingest.mts --region=CA:QC
 *   npx tsx scripts/overture-ingest.mts --region=US:TX --min-confidence=0.7
 *
 * ── WHY THIS WRITES A FILE AND NOT THE DATABASE ───────────────────────────
 *
 * Deliberately. If the normaliser is wrong you find out from a file you can
 * read, not from forty thousand bad rows in Supabase that nothing can DELETE
 * (the lead repository has no delete grant). Loading is a separate, deliberate
 * step someone runs while awake, against output they have looked at.
 *
 * ── WHY TYPESCRIPT AND NOT A .mjs SCRIPT ──────────────────────────────────
 *
 * So it imports the SAME `normalizeOverturePlaces` the application uses. A
 * JavaScript copy of that logic would drift the first time either side
 * changed, and the drift would be invisible -- the file would still look
 * plausible and the leads would quietly be wrong.
 *
 * ── HOW THE REGION FILTER WORKS ───────────────────────────────────────────
 *
 * Two different things, and conflating them is the classic mistake:
 *
 *   the bounding box   prunes row groups, so this reads a fraction of a ~7GB
 *                      dataset. A hint. Being slightly too large costs time.
 *   the address codes  decide membership. `region = 'QC'` is exact.
 *
 * A box alone would sweep in Ontario and Vermont; codes alone would force a
 * full scan. The box is optional and falls back to the country's.
 *
 * Reads only. Writes only to the output directory. Never touches Supabase.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

import { COUNTRIES, SUBDIVISIONS } from "../src/lib/region/registry";
import {
  MIN_CONFIDENCE,
  normalizeOverturePlaces,
  type OverturePlace,
} from "../src/lib/overture/normalize";
import { mappedOvertureCategories } from "../src/lib/overture/categories";

const RELEASE = process.env.OVERTURE_RELEASE ?? "2026-08-19.0";
const PLACES = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*.parquet`;

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

/** `CA:QC` or `US` -- the same key shape `regionKey` produces. */
function parseRegion(key: string) {
  const [countryCode, subdivisionCode] = key.split(":");
  const country = COUNTRIES.find((c) => c.code === countryCode?.toUpperCase());
  if (!country) {
    throw new Error(`Unknown country in --region: ${key}. Try CA:QC or US:TX.`);
  }
  if (!subdivisionCode) return { country, subdivision: null };

  const subdivision = SUBDIVISIONS.find(
    (s) => s.country === country.code && s.code === subdivisionCode.toUpperCase(),
  );
  if (!subdivision) {
    throw new Error(`Unknown subdivision in --region: ${key}.`);
  }
  return { country, subdivision };
}

const regionKey = flag("region") ?? "CA:QC";
const minConfidence = Number(flag("min-confidence") ?? MIN_CONFIDENCE);
const outDir = flag("out") ?? "data/overture";
const limit = Number(flag("limit") ?? 0);

const { country, subdivision } = parseRegion(regionKey);
const bbox = subdivision?.bbox ?? country.bbox;
const label = subdivision ? `${subdivision.label}, ${country.label}` : country.label;

console.log(`Overture ${RELEASE}`);
console.log(`region      ${regionKey}  (${label})`);
console.log(`confidence  >= ${minConfidence}`);
console.log(`bbox hint   W ${bbox[0]}  S ${bbox[1]}  E ${bbox[2]}  N ${bbox[3]}`);
console.log(`categories  ${mappedOvertureCategories().length} Overture categories map to our 12\n`);

const instance = await DuckDBInstance.create(":memory:");
const db = await instance.connect();
await db.run("INSTALL httpfs; LOAD httpfs;");
await db.run("SET s3_region='us-west-2';");

// Membership: the address codes. The box above only prunes row groups.
const membership = subdivision
  ? `addresses[1].country = '${country.code}' AND addresses[1].region = '${subdivision.code}'`
  : `addresses[1].country = '${country.code}'`;

/**
 * Only the trades we sell to, pushed down to the scan.
 *
 * The exact list plus the one suffix rule from `categories.ts`. Filtering here
 * rather than after the fetch is the difference between reading eleven
 * thousand rows and reading three hundred thousand.
 */
const categoryFilter = `(
  categories.primary IN (${mappedOvertureCategories().map((c) => `'${c}'`).join(", ")})
  OR categories.primary LIKE '%_restaurant'
)`;

/**
 * The projection flattens Overture's nested structs into scalars.
 *
 * The DuckDB driver returns `DuckDBStructValue` and `DuckDBListValue` wrappers
 * rather than plain objects, and `normalizeOverturePlaces` is a pure domain
 * function that must never learn a database driver's shape. So the flattening
 * happens HERE, in the module that owns the driver, and the script rebuilds
 * exactly the `OverturePlace` shape the normaliser documents.
 *
 * Lists are 1-indexed in DuckDB.
 */
const sql = `
  SELECT
    id,
    names.primary            AS name,
    categories.primary       AS category,
    confidence,
    websites[1]              AS website,
    phones[1]                AS phone,
    addresses[1].freeform    AS street,
    addresses[1].locality    AS locality
  FROM read_parquet('${PLACES}')
  WHERE bbox.xmin BETWEEN ${bbox[0]} AND ${bbox[2]}
    AND bbox.ymin BETWEEN ${bbox[1]} AND ${bbox[3]}
    AND ${membership}
    AND confidence >= ${minConfidence}
    AND ${categoryFilter}
  ${limit > 0 ? `LIMIT ${limit}` : ""}
`;

interface FlatRow {
  id: string | null;
  name: string | null;
  category: string | null;
  confidence: number | null;
  website: string | null;
  phone: string | null;
  street: string | null;
  locality: string | null;
}

console.log("querying Overture (this reads a few hundred MB, give it a minute)...");
const started = Date.now();
const reader = await db.runAndReadAll(sql);
const flat = reader.getRowObjects() as unknown as FlatRow[];
console.log(`  ${flat.length} places matched in ${Math.round((Date.now() - started) / 1000)}s
`);

/** Rebuild the documented nested shape from the flat projection. */
const raw: OverturePlace[] = flat.map((row) => ({
  id: row.id,
  names: { primary: row.name },
  categories: { primary: row.category },
  confidence: row.confidence,
  websites: row.website === null ? null : [row.website],
  phones: row.phone === null ? null : [row.phone],
  addresses:
    row.street === null && row.locality === null
      ? null
      : [{ freeform: row.street, locality: row.locality }],
}));

// The same function the application uses. Drops nameless rows, rows with no
// id, and every trade we do not sell to.
const businesses = normalizeOverturePlaces(raw, {
  fetchedAt: new Date().toISOString(),
  cityLabel: subdivision?.label ?? country.label,
});

const byCategory = new Map<string, number>();
const noOwnSite = businesses.filter((b) => b.website === null);
for (const business of businesses) {
  byCategory.set(business.category, (byCategory.get(business.category) ?? 0) + 1);
}

const slug = regionKey.replace(/:/g, "-");
const dataPath = join(outDir, `${slug}.ndjson`);
const reportPath = join(outDir, `${slug}.report.json`);
mkdirSync(dirname(dataPath), { recursive: true });

writeFileSync(dataPath, businesses.map((b) => JSON.stringify(b)).join("\n") + "\n", "utf8");

const report = {
  release: RELEASE,
  region: regionKey,
  label,
  minConfidence,
  generatedAt: new Date().toISOString(),
  matchedInDataset: raw.length,
  // The gap between these two is rows we deliberately refused: no name, no id,
  // or a trade outside the twelve. Worth watching -- a sudden jump means the
  // category mapping has drifted from the data.
  normalised: businesses.length,
  droppedByNormaliser: raw.length - businesses.length,
  withNoWebsiteListed: noOwnSite.length,
  withPhone: businesses.filter((b) => b.phone !== null).length,
  byCategory: Object.fromEntries([...byCategory].sort((a, b) => b[1] - a[1])),
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(`normalised  ${businesses.length}`);
console.log(`  dropped   ${report.droppedByNormaliser}  (no name, no id, or a trade we skip)`);
console.log(`  no site   ${report.withNoWebsiteListed}`);
console.log(`  has phone ${report.withPhone}\n`);
console.table(report.byCategory);
console.log(`\nwrote ${dataPath}`);
console.log(`wrote ${reportPath}`);
console.log("\nNothing has been written to Supabase. Loading is a separate step.");

await db.closeSync();
