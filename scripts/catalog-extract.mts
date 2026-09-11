/**
 * Extract a catalog area from Overture into a local file.
 *
 *   npx tsx scripts/catalog-extract.mts --area=montreal-island
 *   npx tsx scripts/catalog-extract.mts --area=montreal-island --release=2026-09-16.0
 *
 * Writes `data/catalog/<area>.ndjson` (one catalog record per line) and
 * `data/catalog/<area>.report.json`. Reads a public bucket; never touches
 * Supabase. Loading is `catalog-load.mts`, a separate and deliberate step --
 * if a judgement here is wrong, you find out from a file you can read.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveCatalogArea } from "../src/lib/catalog/area";
import { buildCatalogRecords } from "../src/lib/catalog/overture-records";
import { MIN_CONFIDENCE } from "../src/lib/overture/normalize";
import { assertRelease, DEFAULT_RELEASE, queryAreaPlaces } from "./lib/overture";

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const areaKey = flag("area") ?? "montreal-island";
const area = resolveCatalogArea(areaKey);
if (!area) throw new Error(`Unknown catalog area: ${areaKey}. Try --area=montreal-island.`);

const release = assertRelease(flag("release") ?? process.env.OVERTURE_RELEASE ?? DEFAULT_RELEASE);
const minConfidence = Number(flag("min-confidence") ?? MIN_CONFIDENCE);
const outDir = flag("out") ?? "data/catalog";

console.log(`Overture   ${release}`);
console.log(`area       ${area.label} (${area.key})`);
console.log(`confidence >= ${minConfidence}\n`);

const started = Date.now();
const rows = await queryAreaPlaces(area, release, minConfidence);
console.log(`  ${rows.length} places in the box, in a catalog trade  (${Math.round((Date.now() - started) / 1000)}s)`);

const generatedAt = new Date().toISOString();
const { records, outsideArea, unusable, duplicateIds } = buildCatalogRecords(rows, area, generatedAt);

const tally = (key: (r: (typeof records)[number]) => string) => {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(key(record), (counts.get(key(record)) ?? 0) + 1);
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]));
};

const report = {
  dataset: "overture",
  release,
  area: area.key,
  minConfidence,
  generatedAt,
  placesInQuery: rows.length,
  records: records.length,
  outsideArea: [...outsideArea.values()].reduce((sum, n) => sum + n, 0),
  unusable,
  duplicateIds,
  noWebsiteListed: records.filter((r) => r.business.website === null).length,
  withPhone: records.filter((r) => r.business.phone !== null).length,
  withLocation: records.filter((r) => r.location !== null).length,
  byTrade: tally((r) => r.business.category),
  byMunicipality: tally((r) => r.municipality),
  // Largest first. A new spelling of a real island place appearing here means
  // the area registry needs an alias; everything else here is correctly out.
  outsideAreaBySpelling: Object.fromEntries(
    [...outsideArea].sort((a, b) => b[1] - a[1]).slice(0, 40),
  ),
};

mkdirSync(outDir, { recursive: true });
const dataPath = join(outDir, `${area.key}.ndjson`);
const reportPath = join(outDir, `${area.key}.report.json`);
writeFileSync(dataPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(`  ${records.length} businesses on ${area.label}`);
console.log(`    ${report.outsideArea} elsewhere in the box (Laval, Longueuil, ...), ${unusable} unusable, ${duplicateIds} duplicate ids`);
console.log(`    ${report.noWebsiteListed} with no website listed, ${report.withPhone} with a phone, ${report.withLocation} with coordinates\n`);
console.table(report.byTrade);
console.log(`\nwrote ${dataPath}\nwrote ${reportPath}`);
console.log("\nNothing has been written to Supabase. Loading is catalog-load.mts.");
