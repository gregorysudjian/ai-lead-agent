/**
 * Remove the leads that searches added and nobody worked on.
 *
 *   # Dry run -- shows both definitions of "worked on" and what each would keep.
 *   npx tsx --env-file=.env.local scripts/leads-prune.mts
 *
 *   # For real, with the definition named explicitly. There is no default.
 *   npx tsx --env-file=.env.local scripts/leads-prune.mts --keep=strict --commit
 *   npx tsx --env-file=.env.local scripts/leads-prune.mts --keep=inclusive --commit
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Before the business catalog, every search wrote its results straight into
 * leads. So most of the stored leads are "what the searches returned", not
 * "what the operator chose". The catalog now holds those businesses; this
 * clears the ones that were never worked on out of the lead list.
 *
 * ── WHAT "WORKED ON" MEANS -- AND WHY IT IS YOUR CHOICE ───────────────────
 *
 *   strict     reviewed, OR has an analysis, a demo site or an outreach record
 *   inclusive  all of the above, OR has a research profile
 *
 * They differ enormously in practice: most research profiles came from the
 * bounded batch-research run rather than from anyone choosing a lead. Deleting
 * a lead cascades to its profiles, so `strict` also removes that research.
 * The script will not guess which you meant.
 *
 * ── SAFETY ────────────────────────────────────────────────────────────────
 *
 *   - Dry run unless --commit, and --commit refuses without --keep.
 *   - Refuses while the business catalog is empty: a removed hair or beauty
 *     lead must still be findable, and addable again, from search.
 *   - A catalog business linked to a removed lead is NOT removed; its link is
 *     cleared by the foreign key (ON DELETE SET NULL) and it returns to being
 *     something you can add.
 *   - A lead created after the catalog's first load was added deliberately
 *     from search, and is always kept.
 *   - Everything removed is written to data/backups/ first.
 *   - Nothing is contacted. This touches the lead table and what cascades
 *     from it, nothing else.
 *
 * The LeadRepository deliberately has no delete method, which is why this
 * one-off maintenance script uses the service-role client directly.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file=.env.local).");

const db = createClient(url, key, { auth: { persistSession: false } });

const commit = process.argv.includes("--commit");
const keepFlag = process.argv.find((a) => a.startsWith("--keep="))?.slice("--keep=".length) ?? null;
if (keepFlag !== null && keepFlag !== "strict" && keepFlag !== "inclusive") {
  throw new Error(`--keep must be "strict" or "inclusive", not "${keepFlag}".`);
}
if (commit && keepFlag === null) {
  throw new Error('Refusing to delete without --keep=strict or --keep=inclusive. Run without --commit to compare them.');
}

/** Every row of a table, paged -- PostgREST silently caps a single response. */
async function all<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) return rows;
  }
}

const idsIn = async (table: string) =>
  new Set((await all<{ lead_id: string }>(table, "lead_id")).map((row) => row.lead_id));

// A GET for one row plus the exact count, NOT a head-only request: a HEAD has
// no body to carry an error, so against a missing table it reported zero rows
// and this guard blamed an "empty" catalog instead of an unapplied migration.
const { count: catalogCount, error: catalogError } = await db
  .from("businesses")
  .select("id", { count: "exact" })
  .range(0, 0);
if (catalogError) {
  throw new Error(
    `Could not read the business catalog (${catalogError.code ?? "error"}: ${catalogError.message}). ` +
      "If the table is missing, apply the catalog migrations first.",
  );
}
if (!catalogCount) {
  throw new Error("The business catalog is empty. Load it first, so removed leads stay findable.");
}

/**
 * When the catalog first existed. A lead created at or after this moment was
 * made with Add to leads -- a deliberate choice -- and is never pruned, however
 * little work it has on it yet. This script is for the leads the OLD search
 * wrote automatically, and only those.
 */
const { data: firstRun, error: runError } = await db
  .from("ingest_runs")
  .select("started_at")
  .order("started_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (runError || !firstRun) {
  throw new Error("Could not read when the catalog was first loaded; refusing to prune without it.");
}
const catalogBorn = Date.parse(firstRun.started_at as string);

type LeadRow = {
  id: string;
  status: string;
  created_at: string;
  provider: { name: string; category: string };
};
const leads = await all<LeadRow>("leads", "id,status,created_at,provider");
const chosenFromCatalog = (lead: LeadRow) => Date.parse(lead.created_at) >= catalogBorn;
const [analyses, demos, outreach, profiles] = await Promise.all([
  idsIn("lead_analyses"),
  idsIn("demo_sites"),
  idsIn("outreach_records"),
  idsIn("business_profiles"),
]);

const strictWork = (lead: LeadRow) =>
  chosenFromCatalog(lead) ||
  lead.status === "reviewed" ||
  analyses.has(lead.id) ||
  demos.has(lead.id) ||
  outreach.has(lead.id);
const inclusiveWork = (lead: LeadRow) => strictWork(lead) || profiles.has(lead.id);

const keptStrict = leads.filter(strictWork);
const keptInclusive = leads.filter(inclusiveWork);

console.log(`leads stored          ${leads.length}`);
console.log(`catalog businesses    ${catalogCount}\n`);
console.log(`--keep=strict         keeps ${keptStrict.length}, removes ${leads.length - keptStrict.length}`);
console.log(`                      (removing a lead also removes its research profiles)`);
console.log(`--keep=inclusive      keeps ${keptInclusive.length}, removes ${leads.length - keptInclusive.length}\n`);

const mode = keepFlag ?? "strict";
const keep = mode === "strict" ? strictWork : inclusiveWork;
const kept = leads.filter(keep);
const removed = leads.filter((lead) => !keep(lead));

console.log(`kept under --keep=${mode}:`);
for (const lead of kept) {
  const why = [
    chosenFromCatalog(lead) ? "added from the catalog" : null,
    lead.status === "reviewed" ? "reviewed" : null,
    analyses.has(lead.id) ? "analysis" : null,
    demos.has(lead.id) ? "demo" : null,
    outreach.has(lead.id) ? "outreach" : null,
    mode === "inclusive" && profiles.has(lead.id) ? "research" : null,
  ].filter(Boolean);
  console.log(`  keep    ${lead.provider.name}  (${lead.provider.category}; ${why.join(", ")})`);
}

if (!commit) {
  console.log(`\nNothing was deleted. To remove ${removed.length} leads, re-run with --keep=${mode} --commit.`);
} else {
  // A copy of everything about to go, written BEFORE anything is deleted.
  // Deletion cascades to research profiles, and neither the database nor the
  // application keeps a history of removed rows -- this file is the only way
  // back. It lands in data/, which is gitignored: it holds business contact
  // details and has no business in version control.
  const removedIds = removed.map((lead) => lead.id);
  const fullLeads: unknown[] = [];
  const fullProfiles: unknown[] = [];
  for (let i = 0; i < removedIds.length; i += 100) {
    const batch = removedIds.slice(i, i + 100);
    const leadRows = await db.from("leads").select("*").in("id", batch);
    const profileRows = await db.from("business_profiles").select("*").in("lead_id", batch);
    if (leadRows.error || profileRows.error) {
      throw new Error("Could not read the rows to back up; nothing was deleted.");
    }
    fullLeads.push(...(leadRows.data ?? []));
    fullProfiles.push(...(profileRows.data ?? []));
  }
  if (fullLeads.length !== removed.length) {
    throw new Error(`Backed up ${fullLeads.length} of ${removed.length} leads; nothing was deleted.`);
  }

  mkdirSync("data/backups", { recursive: true });
  const backupPath = `data/backups/leads-pruned-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    backupPath,
    JSON.stringify({ keep: mode, prunedAt: new Date().toISOString(), leads: fullLeads, businessProfiles: fullProfiles }, null, 2),
    "utf8",
  );
  console.log(`\nbacked up ${fullLeads.length} leads and ${fullProfiles.length} research profiles to ${backupPath}`);

  let deleted = 0;
  for (let i = 0; i < removed.length; i += 100) {
    const batch = removed.slice(i, i + 100).map((lead) => lead.id);
    const { error } = await db.from("leads").delete().in("id", batch);
    if (error) throw new Error(`Deletion stopped after ${deleted}: ${error.message}`);
    deleted += batch.length;
  }
  console.log(`\nRemoved ${deleted} leads. Kept ${kept.length}.`);
  console.log("Their businesses are still in the catalog, and can be added again from search.");
}
