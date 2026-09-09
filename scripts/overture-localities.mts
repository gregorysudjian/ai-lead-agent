/**
 * Generate the locality registry the Region Resolver needs.
 *
 *   npx tsx scripts/overture-localities.mts --regions=CA:QC,US:TX
 *
 * ── WHY LOCALITIES ARE GENERATED, NOT HAND-WRITTEN ────────────────────────
 *
 * There are tens of thousands of cities in the US and Canada. `registry.ts`
 * deliberately holds none of them: hardcoding a sample produces a resolver
 * that looks like it works and silently rejects most real input.
 *
 * ── WHY FROM THE PLACES DATA, NOT THE DIVISIONS THEME ─────────────────────
 *
 * Overture's divisions theme is the more authoritative source of what a city
 * IS. But the resolver's job is not cartography -- it is turning what a user
 * typed into a filter that matches our stored records, and those records carry
 * `addresses[].locality` verbatim. Deriving the registry from the same column
 * we filter on guarantees the two agree; using divisions would introduce a
 * second spelling of every place name and a whole class of near-miss bugs.
 *
 * The trade is honest and worth naming: a town with no business in our twelve
 * trades will not appear here. It is also a town we could never have sold to.
 *
 * READ-ONLY against Overture. Writes one generated TypeScript file.
 */
import { writeFileSync } from "node:fs";

import { DuckDBInstance } from "@duckdb/node-api";

import { normalizeTerm } from "../src/lib/normalize";
import { COUNTRIES, SUBDIVISIONS } from "../src/lib/region/registry";
import { mappedOvertureCategories } from "../src/lib/overture/categories";

const RELEASE = process.env.OVERTURE_RELEASE ?? "2026-08-19.0";
const PLACES = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*.parquet`;

const requested = (
  process.argv.find((a) => a.startsWith("--regions="))?.slice(10) ?? "CA:QC,US:TX"
).split(",");

const db = await (await DuckDBInstance.create(":memory:")).connect();
await db.run("INSTALL httpfs; LOAD httpfs;");
await db.run("SET s3_region='us-west-2';");

const categoryFilter = `(
  categories.primary IN (${mappedOvertureCategories().map((c) => `'${c}'`).join(", ")})
  OR categories.primary LIKE '%_restaurant'
)`;

interface Row {
  locality: string;
  n: number;
}
const collected: { label: string; country: string; subdivision: string; places: number }[] = [];

for (const key of requested) {
  const [countryCode, subdivisionCode] = key.split(":");
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const subdivision = SUBDIVISIONS.find(
    (s) => s.country === countryCode && s.code === subdivisionCode,
  );
  if (!country || !subdivision) throw new Error(`unknown region: ${key}`);

  const bbox = subdivision.bbox ?? country.bbox;
  console.log(`querying localities for ${key} (${subdivision.label})...`);

  const reader = await db.runAndReadAll(`
    SELECT addresses[1].locality AS locality, count(*) AS n
    FROM read_parquet('${PLACES}')
    WHERE bbox.xmin BETWEEN ${bbox[0]} AND ${bbox[2]}
      AND bbox.ymin BETWEEN ${bbox[1]} AND ${bbox[3]}
      AND addresses[1].country = '${country.code}'
      AND addresses[1].region = '${subdivision.code}'
      AND addresses[1].locality IS NOT NULL
      AND confidence >= 0.5
      AND ${categoryFilter}
    GROUP BY 1
    HAVING count(*) >= 2
    ORDER BY n DESC
  `);

  const rows = (reader.getRowObjects() as unknown as Row[]).map((r) => ({
    locality: String(r.locality).trim(),
    n: Number(r.n),
  }));

  /**
   * Fold case and accent variants of the same city together.
   *
   * Overture carries "Laval" and "LAVAL" as separate values, and SQL GROUP BY
   * treats them as different cities. Emitted raw, every such place became
   * ambiguous WITH ITSELF -- the resolver would offer a user two identical
   * choices and refuse to pick. The resolver compares after `normalizeTerm`,
   * so folding on the same function is what makes the registry agree with the
   * lookup that reads it.
   *
   * The surviving spelling is the commonest one, which is nearly always the
   * properly-cased one, and the counts are summed rather than dropped.
   */
  const folded = new Map<string, { label: string; places: number }>();
  for (const row of rows) {
    const key = normalizeTerm(row.locality);
    if (key.length === 0) continue;

    const existing = folded.get(key);
    if (!existing) {
      folded.set(key, { label: row.locality, places: row.n });
      continue;
    }
    existing.places += row.n;
    if (row.n > existing.places - row.n) existing.label = row.locality;
  }

  console.log(`  ${rows.length} raw values -> ${folded.size} localities after folding case variants`);

  for (const entry of folded.values()) {
    collected.push({
      label: entry.label,
      country: country.code,
      subdivision: subdivision.code,
      places: entry.places,
    });
  }
}

collected.sort((a, b) =>
  a.country === b.country
    ? a.subdivision === b.subdivision
      ? a.label.localeCompare(b.label)
      : a.subdivision.localeCompare(b.subdivision)
    : a.country.localeCompare(b.country),
);

const header = `/**
 * GENERATED FILE -- do not edit by hand.
 *
 *   npx tsx scripts/overture-localities.mts --regions=${requested.join(",")}
 *
 * Localities the Region Resolver can place, derived from the same
 * \`addresses[].locality\` column the ingest filters on -- so a name that
 * resolves here is guaranteed to match records we actually store. See the
 * script's header for why this is generated from places rather than from
 * Overture's divisions theme.
 *
 * Only localities with two or more businesses in our twelve trades are
 * included. A single-business hit is usually a tagging artefact, and a town we
 * have no businesses in is a town we could not have sold to anyway.
 *
 * Source: Overture Maps ${RELEASE}, CDLA-Permissive 2.0.
 * Regions: ${requested.join(", ")}
 * Generated: ${new Date().toISOString()}
 */
import type { KnownLocality } from "./types";

export const LOCALITIES: readonly KnownLocality[] = [
`;

const body = collected
  .map(
    (l) =>
      `  { label: ${JSON.stringify(l.label)}, country: ${JSON.stringify(l.country)}, subdivision: ${JSON.stringify(l.subdivision)} },`,
  )
  .join("\n");

const out = `${header}${body}\n];\n`;
writeFileSync("src/lib/region/localities.ts", out, "utf8");

console.log(`\nwrote src/lib/region/localities.ts with ${collected.length} localities`);
await db.closeSync();
