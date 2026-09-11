/**
 * Load a catalog extract into the business catalog.
 *
 *   # Dry run -- reads the catalog and the leads, writes nothing. The default.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-load.mts
 *
 *   # For real.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-load.mts --commit
 *
 * Reads `data/catalog/<area>.ndjson` and its report, written by
 * `catalog-extract.mts`. The release and dataset come from the REPORT, never
 * from a flag: a file cannot be loaded under a release name it was not
 * extracted from.
 *
 * WRITES ONLY THE CATALOG. No lead is created, changed or removed; the only
 * lead-related write is the link from a catalog business to a lead that
 * already exists. Nothing is contacted, nothing is fetched.
 *
 * `--conditions=react-server` lets this use the application's real
 * repositories, which import `server-only`. Dedupe lives inside
 * `CatalogRepository.refresh`, and a loader that wrote to Supabase directly
 * would be precisely the caller that bypassed it.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveCatalogArea } from "../src/lib/catalog/area";
import { linkLeadsToCatalog } from "../src/lib/catalog/link-leads";
import { planCatalogUpsert } from "../src/lib/catalog/plan-upsert";
import type { CatalogRecord } from "../src/lib/catalog/types";
import { refreshCatalog, type CatalogExtract } from "../src/server/catalog-refresh";
import { getCatalogRepository, getLeadRepository } from "../src/server/repo";
import { toProviderSnapshot } from "../src/server/repo/supabase-mapping";

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const areaKey = flag("area") ?? "montreal-island";
const area = resolveCatalogArea(areaKey);
if (!area) throw new Error(`Unknown catalog area: ${areaKey}.`);

const dir = flag("dir") ?? "data/catalog";
const dataPath = join(dir, `${area.key}.ndjson`);
const reportPath = join(dir, `${area.key}.report.json`);
const commit = process.argv.includes("--commit");

/**
 * Every line, validated. A malformed line stops the load: the file was written
 * by our own extract, and if it is not the shape we wrote, the thing to do is
 * look at it rather than load the rest and hope.
 */
function readRecords(path: string): CatalogRecord[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line, index) => {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const municipality = raw.municipality;
      if (typeof municipality !== "string" || municipality.length === 0) {
        throw new Error(`${path} line ${index + 1}: missing municipality.`);
      }
      const location = raw.location as { latitude?: unknown; longitude?: unknown } | null;
      const valid =
        location === null ||
        (typeof location?.latitude === "number" && typeof location?.longitude === "number");
      if (!valid) throw new Error(`${path} line ${index + 1}: malformed location.`);

      return {
        // The same validator a stored snapshot passes through.
        business: toProviderSnapshot(raw.business),
        municipality,
        location: location as CatalogRecord["location"],
      };
    });
}

const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
  dataset: string;
  release: string;
  area: string;
};
if (report.area !== area.key) {
  throw new Error(`${reportPath} describes area "${report.area}", not "${area.key}".`);
}

const extract: CatalogExtract = {
  meta: { dataset: report.dataset, release: report.release, area: report.area },
  records: readRecords(dataPath),
  sourceFile: dataPath.replace(/\\/g, "/"),
  sha256: createHash("sha256").update(readFileSync(dataPath)).digest("hex"),
};

console.log(`file     ${extract.sourceFile}`);
console.log(`sha256   ${extract.sha256}`);
console.log(`release  ${extract.meta.dataset} ${extract.meta.release}`);
console.log(`records  ${extract.records.length}`);
console.log(`mode     ${commit ? "COMMIT -- writes the business catalog" : "dry run -- nothing is written"}\n`);

const catalog = getCatalogRepository();
const leads = getLeadRepository();

if (!commit) {
  const existing = await catalog.listAll();
  const plan = planCatalogUpsert({
    existing,
    incoming: extract.records,
    release: extract.meta.release,
    now: new Date().toISOString(),
    newId: randomUUID,
  });
  const allLeads = await leads.list();
  const after = [...existing.filter((b) => !plan.rows.some((row) => row.id === b.id)), ...plan.rows];
  const links = linkLeadsToCatalog(after, allLeads);

  console.log(`catalog now     ${existing.length} businesses`);
  console.log(`would add       ${plan.added}`);
  console.log(`would refresh   ${plan.refreshed}`);
  console.log(`would collapse  ${plan.collapsed}  (duplicates within the file)`);
  console.log(`would skip      ${plan.conflicts.length}  (would collide with a different stored business)`);
  console.log(`would link      ${links.size} of your ${allLeads.length} existing leads to their business\n`);

  const byId = new Map(after.map((b) => [b.id, b]));
  const leadById = new Map(allLeads.map((lead) => [lead.id, lead]));
  const examples = [...links].slice(0, 8);
  if (examples.length > 0) {
    console.log("link examples (lead  ->  catalog business):");
    for (const [businessId, leadId] of examples) {
      const lead = leadById.get(leadId);
      const business = byId.get(businessId);
      console.log(`  ${lead?.provider.name} @ ${lead?.provider.address}  ->  ${business?.provider.address}`);
    }
  }
  for (const conflict of plan.conflicts) {
    console.log(`  skip: ${conflict.name} (${conflict.address}) collides with ${conflict.collidesWith}`);
  }
  console.log("\nNothing was written. Re-run with --commit to load.");
} else {
  const outcome = await refreshCatalog(extract, { catalog, leads });
  console.log(`run        ${outcome.runId}`);
  console.log(`added      ${outcome.added}`);
  console.log(`refreshed  ${outcome.refreshed}`);
  console.log(`collapsed  ${outcome.collapsed}`);
  console.log(`skipped    ${outcome.conflicts.length}`);
  console.log(`unseen     ${outcome.unseen}  (in the catalog, not in this release)`);
  console.log(`linked     ${outcome.leadsLinked} existing leads`);
  for (const conflict of outcome.conflicts) {
    console.log(`  skipped: ${conflict.name} (${conflict.address}) collides with ${conflict.collidesWith}`);
  }
}
