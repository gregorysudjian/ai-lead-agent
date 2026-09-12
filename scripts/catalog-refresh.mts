/**
 * Keep the business catalog up to date with Overture, in one command.
 *
 *   # See whether there is anything new, and what loading it would do. Writes nothing.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-refresh.mts
 *
 *   # Load it.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-refresh.mts --commit
 *
 *   # A specific release, even one already loaded (re-applies it; never goes backwards).
 *   ... scripts/catalog-refresh.mts --release=2026-08-19.0
 *
 * What the scheduled GitHub Actions job runs every week. The steps are the
 * ones a person used to run by hand -- `catalog-extract.mts` then
 * `catalog-load.mts` -- chained, with two additions:
 *
 *   1. It finds the release itself. If Overture has published nothing newer
 *      than the catalog holds, it says so and stops. Most weeks that is all
 *      it does.
 *   2. A circuit breaker (`assessRefresh`). A release far smaller than what
 *      is listed today stops the run instead of marking hundreds of real
 *      businesses "no longer listed". The run fails loudly, so GitHub emails
 *      the repository owner.
 *
 * Every rule about WHAT enters the catalog is unchanged and lives where it
 * did: `buildCatalogRecords` (trades, area, exclusions) and
 * `CatalogRepository.refresh` (dedupe, never delete, never go backwards).
 * No lead is created or changed; nothing is contacted.
 */
import { appendFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

import { resolveCatalogArea } from "../src/lib/catalog/area";
import { isOfferedInCatalog } from "../src/lib/catalog/exclusion";
import { buildCatalogRecords } from "../src/lib/catalog/overture-records";
import { planCatalogUpsert } from "../src/lib/catalog/plan-upsert";
import { assessRefresh, nextReleaseToLoad, RELEASE_NAME } from "../src/lib/catalog/releases";
import { catalogReleases } from "../src/lib/catalog/search";
import { MIN_CONFIDENCE } from "../src/lib/overture/normalize";
import { refreshCatalog } from "../src/server/catalog-refresh";
import { getCatalogRepository, getLeadRepository } from "../src/server/repo";
import { listReleases, queryAreaPlaces } from "./lib/overture";

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const commit = process.argv.includes("--commit");
const force = process.argv.includes("--force");
const areaKey = flag("area") ?? "montreal-island";
const area = resolveCatalogArea(areaKey);
if (!area) throw new Error(`Unknown catalog area: ${areaKey}.`);
const requested = flag("release");
if (requested !== null && !RELEASE_NAME.test(requested)) {
  throw new Error(`"${requested}" is not an Overture release name (expected e.g. 2026-08-19.0).`);
}

/** Lines for the terminal, and for the job summary GitHub shows on the run. */
const summary: string[] = [];
function report(line: string) {
  console.log(line);
  summary.push(line);
}
function writeSummary(title: string) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  appendFileSync(path, `## ${title}\n\n${summary.map((line) => `- ${line}`).join("\n")}\n`);
}

const catalog = getCatalogRepository();
const all = await catalog.listAll();
const loaded = catalogReleases(all).latest;
const listedNow = all.filter((b) => b.lastSeenRelease === loaded && isOfferedInCatalog(b)).length;
const available = await listReleases();
const newest = available.at(-1) ?? null;

report(`Area: ${area.label}`);
report(`Loaded release: ${loaded ?? "none"} (${listedNow} businesses listed)`);
report(`Newest published: ${newest ?? "none found"}`);

const target = requested ?? nextReleaseToLoad(available, loaded);
if (target === null) {
  report("Up to date: nothing newer to load.");
  writeSummary("Business list: up to date");
  process.exit(0);
}
if (requested !== null && !available.includes(requested)) {
  throw new Error(`Release ${requested} is not published by Overture.`);
}

report(`Release to load: ${target} (${commit ? "loading" : "dry run, nothing written"})`);

const started = Date.now();
const rows = await queryAreaPlaces(area, target, MIN_CONFIDENCE);
const generatedAt = new Date().toISOString();
const built = buildCatalogRecords(rows, area, generatedAt);
const excluded = Object.values(built.excluded).reduce((sum, n) => sum + (n ?? 0), 0);
report(
  `Read ${rows.length} places in ${Math.round((Date.now() - started) / 1000)}s: ${built.records.length} businesses, ${excluded} excluded (chains, pharmacies, broken names), ${built.duplicateIds} duplicates.`,
);

const assessment = assessRefresh({ listedNow, incoming: built.records.length });
if (!assessment.ok && !force) {
  report(`STOPPED by the safety check: ${assessment.reason}`);
  writeSummary("Business list: refresh stopped");
  process.exit(1);
}

const ndjson = built.records.map((record) => JSON.stringify(record)).join("\n");
const extract = {
  meta: { dataset: "overture", release: target, area: area.key },
  records: built.records,
  sourceFile: `overture:${target}${process.env.GITHUB_ACTIONS ? " (scheduled)" : ""}`,
  sha256: createHash("sha256").update(ndjson).digest("hex"),
};

if (!commit) {
  const plan = planCatalogUpsert({
    existing: all,
    incoming: built.records,
    release: target,
    now: generatedAt,
    newId: randomUUID,
  });
  const touched = new Set(plan.rows.map((row) => row.id));
  const unseen = all.filter((b) => !touched.has(b.id) && b.lastSeenRelease === loaded).length;
  report(`Would add ${plan.added} new businesses and refresh ${plan.refreshed}.`);
  report(`Would mark ${unseen} as no longer listed.`);
  report(`Would skip ${plan.conflicts.length} that collide with a different stored business.`);
  report("Dry run: nothing was written. Add --commit to load.");
  writeSummary(`Business list: dry run of ${target}`);
  process.exit(0);
}

const outcome = await refreshCatalog(extract, { catalog, leads: getLeadRepository() });
report(`Added ${outcome.added} new businesses, refreshed ${outcome.refreshed}.`);
report(`Marked ${outcome.unseen} as no longer listed.`);
report(`Skipped ${outcome.conflicts.length}; linked ${outcome.leadsLinked} existing leads.`);
report(`Recorded as run ${outcome.runId}.`);
writeSummary(`Business list: loaded ${target}`);
