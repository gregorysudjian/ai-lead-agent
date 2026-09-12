/**
 * Check catalog businesses (and leads) against Google Maps.
 *
 *   # A dry run on a sample: looks up 20 businesses, prints verdicts, writes nothing.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-google-check.mts --limit=20 --verbose
 *
 *   # Check every unchecked business and store the verdicts.
 *   ... scripts/catalog-google-check.mts --commit
 *
 *   # Also check the leads that are not in the catalog, and remove failing leads.
 *   ... scripts/catalog-google-check.mts --commit --leads --remove-leads
 *
 *   # Store verdicts but not place ids (the report file keeps them), then later
 *   # copy the place ids in from report files -- no Google calls.
 *   ... scripts/catalog-google-check.mts --commit --no-place-ids
 *   ... scripts/catalog-google-check.mts --backfill=data/google-check/<report>.json
 *
 * WHY. The catalog comes from Overture's open data, and some of its places do
 * not exist any more, or never did. The operator asked for every business to
 * have a real Google Maps listing; those without one are hidden from search
 * (kept in the database), and a lead without one is removed from the list
 * (kept, with its research and demos).
 *
 * HOW A VERDICT IS REACHED: `judgeGoogleMatch` -- name and position must both
 * agree. See `src/lib/catalog/google-match.ts`.
 *
 * WHAT IS KEPT FROM GOOGLE: the matched place id, nothing else. The report
 * file holds our own records and our verdicts; Google's names appear only on
 * screen with --verbose, for a person checking the matching by eye.
 *
 * COST: every call is recorded in `google_api_calls` before it is made, and
 * the run stops at the monthly cap (`MONTHLY_CAP`), well inside Google's free
 * allowance. It never retries a call more than once.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { catalogExclusion, hiddenByGoogleCheck } from "../src/lib/catalog/exclusion";
import { distanceMetres, judgeGoogleMatch, nameSimilarity, type MatchOutcome } from "../src/lib/catalog/google-match";
import { catalogReleases } from "../src/lib/catalog/search";
import type { CatalogBusiness, GoogleCheck } from "../src/lib/catalog/types";
import type { Lead } from "../src/lib/types";
import { lookUpOnGoogle, LOOKUP_SKU, type LookupInput } from "../src/server/google-maps-check/lookup";
import { MONTHLY_CAP, reserveCall, supabaseUsageLedger } from "../src/server/google-maps-check/usage";
import { getCatalogRepository, getLeadRepository } from "../src/server/repo";
import { getSupabaseClient } from "../src/server/supabase/client";

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
const commit = process.argv.includes("--commit");
const recheck = process.argv.includes("--recheck");
const verbose = process.argv.includes("--verbose");
/** Every candidate Google returned, with our scores -- on screen only, never saved. */
const debug = process.argv.includes("--debug");
const checkLeads = process.argv.includes("--leads");
const removeLeads = process.argv.includes("--remove-leads");
const limit = flag("limit") === null ? Infinity : Number(flag("limit"));
const only = flag("only")?.split(",") ?? null;
const noPlaceIds = process.argv.includes("--no-place-ids");
const backfill = flag("backfill");
if (!Number.isFinite(limit) && limit !== Infinity) throw new Error("--limit must be a number.");
if (removeLeads && !commit) throw new Error("--remove-leads changes your lead list; it needs --commit too.");

const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set in .env.local.");
if (process.env.LEAD_REPOSITORY !== "supabase") throw new Error("Run against Supabase (LEAD_REPOSITORY=supabase).");

const ledger = supabaseUsageLedger(getSupabaseClient());
const catalog = getCatalogRepository();
const leads = getLeadRepository();

// ── Backfill: place ids from earlier reports, no Google calls ───────────
if (backfill !== null) {
  type Saved = { kind: string; id: string; verdict: string | null; placeId: string | null };
  const text = readFileSync(backfill, "utf8");
  // A finished report (JSON) or a progress file (one JSON object per line).
  const saved: { results: Saved[] } = backfill.endsWith(".ndjson")
    ? { results: text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as Saved) }
    : (JSON.parse(text) as { results: Saved[] });
  const stored = new Map((await catalog.listAll()).map((b) => [b.id, b]));
  let written = 0;
  for (const r of saved.results) {
    const business = stored.get(r.id);
    // Only onto the SAME verdict still stored: a later check wins.
    if (r.kind !== "business" || r.placeId === null || !business?.googleCheck) continue;
    if (business.googleCheck.verdict !== r.verdict || business.googleCheck.placeId !== null) continue;
    await catalog.recordGoogleCheck(r.id, { ...business.googleCheck, placeId: r.placeId });
    written += 1;
  }
  console.log(`Backfilled ${written} place ids from ${backfill}.`);
  process.exit(0);
}
const cap = MONTHLY_CAP[LOOKUP_SKU];
let used = await ledger.countThisMonth(LOOKUP_SKU);
const usedAtStart = used;

// ── What to check ────────────────────────────────────────────────────────

const all = await catalog.listAll();
const latest = catalogReleases(all).latest;
/** A stable, well-spread order, so a --limit sample is not just the "A"s. */
const spread = (id: string) => createHash("sha1").update(id).digest("hex");

const businesses = all
  .filter((b) => (only ? only.includes(b.id) : true))
  // What search shows: listed in the latest release, not excluded as junk.
  .filter((b) => b.lastSeenRelease === latest && catalogExclusion(b.provider) === null)
  .filter((b) => recheck || only !== null || b.googleCheck === null)
  .sort((a, b) => spread(a.id).localeCompare(spread(b.id)))
  .slice(0, limit);

const activeLeads = checkLeads ? await leads.list() : [];
const linkedLeadIds = new Set(all.flatMap((b) => (b.leadId ? [b.leadId] : [])));
/** Leads with no catalog row (older OpenStreetMap searches): checked directly. */
const standaloneLeads = activeLeads.filter((lead) => !linkedLeadIds.has(lead.id));

console.log(`Google calls this month: ${used} of ${cap} allowed (Google's free allowance is 5,000).`);
console.log(
  `To check: ${businesses.length} businesses${checkLeads ? ` + ${standaloneLeads.length} leads not in the catalog` : ""}.` +
    (commit ? " Verdicts WILL be stored." : " Dry run: nothing is stored."),
);
if (used + businesses.length + standaloneLeads.length > cap) {
  console.log(`Note: that is more than the cap allows; the run will stop at ${cap}.`);
}

// ── The lookups ───────────────────────────────────────────────────────────

type Subject = { kind: "business"; business: CatalogBusiness } | { kind: "lead"; lead: Lead };
interface Checked {
  subject: Subject;
  outcome: MatchOutcome | null;
  error: string | null;
}

const CONCURRENCY = 4;
/** At most ~7 calls a second: under Google's default 600 a minute. */
const MIN_GAP_MS = 140;
let lastStart = 0;
let stopReason: string | null = null;

async function paced(): Promise<void> {
  const wait = lastStart + MIN_GAP_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + MIN_GAP_MS);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

function inputFor(subject: Subject): LookupInput {
  if (subject.kind === "business") {
    const p = subject.business.provider;
    return { name: p.name, address: p.address, city: p.city, location: subject.business.location };
  }
  const p = subject.lead.provider;
  return { name: p.name, address: p.address, city: p.city, location: null };
}

/** One search, retried once on a rate limit or server error. */
async function search(
  input: LookupInput,
  record: LookupInput = input,
): Promise<{ outcome: MatchOutcome | null; error: string | null }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (stopReason) return { outcome: null, error: stopReason };
    if (!(await reserveCall(ledger, LOOKUP_SKU, used))) {
      stopReason = `monthly cap of ${cap} reached`;
      return { outcome: null, error: stopReason };
    }
    used += 1;
    await paced();
    const result = await lookUpOnGoogle(apiKey as string, input);
    if (result.ok) {
      // Judged against our FULL record, whatever the query left out.
      const outcome = judgeGoogleMatch(
        { name: record.name, address: record.address, location: record.location },
        result.candidates,
      );
      if (debug) {
        console.log(`  QUERY ${input.name} | ${input.address ?? "-"} (${outcome.verdict})`);
        for (const c of result.candidates) {
          const metres = record.location && c.location ? Math.round(distanceMetres(record.location, c.location)) : null;
          console.log(`      ${nameSimilarity(record.name, c.name).toFixed(2)}  ${String(metres ?? "?").padStart(6)} m  ${c.businessStatus ?? ""}  ${c.name} | ${c.formattedAddress ?? ""}`);
        }
      }
      if (verbose) {
        const top = result.candidates[0];
        console.log(
          `  ${outcome.verdict.padEnd(9)} ${input.name} | ${input.address ?? "-"}  ->  Google: ${top ? top.name : "(nothing)"}  [${outcome.reason}]`,
        );
      }
      return { outcome, error: null };
    }
    if (!result.retryable) {
      // A refusal (bad key, API off, billing) will refuse every call: stop.
      stopReason = `Google refused the request (${result.message})`;
      return { outcome: null, error: stopReason };
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
    else return { outcome: null, error: result.message };
  }
  return { outcome: null, error: "unreachable" };
}

/**
 * Check one subject: by name and address, then -- only when that finds
 * nothing -- by name alone near the same spot. Google sometimes answers a
 * query containing a street address with the ADDRESS rather than the shop at
 * it; a second, differently worded search is what keeps a real salon from
 * being hidden for that. A match on either search is a match.
 */
async function check(subject: Subject): Promise<Checked> {
  const input = inputFor(subject);
  const first = await search(input);
  if (first.outcome === null || first.outcome.verdict !== "not_found") return { subject, ...first };

  const second = await search({ ...input, address: null }, input);
  if (second.outcome === null) return { subject, ...first };
  // Keep whichever is more decisive in the business's favour; when both
  // found nothing, keep the first (it searched with more of our record).
  const rank = { verified: 0, closed: 1, uncertain: 2, not_found: 3 } as const;
  const better = rank[second.outcome.verdict] < rank[first.outcome.verdict] ? second.outcome : first.outcome;
  return { subject, outcome: better, error: null };
}

const subjects: Subject[] = [
  ...businesses.map((business) => ({ kind: "business" as const, business })),
  ...standaloneLeads.map((lead) => ({ kind: "lead" as const, lead })),
];
const results: Checked[] = [];
let next = 0;
let done = 0;
const startedAt = Date.now();

const describe = (s: Subject) =>
  s.kind === "business"
    ? { kind: "business", id: s.business.id, name: s.business.provider.name, address: s.business.provider.address, city: s.business.provider.city, leadId: s.business.leadId }
    : { kind: "lead", id: s.lead.id, name: s.lead.provider.name, address: s.lead.provider.address, city: s.lead.provider.city, leadId: s.lead.id };

/** One line per result as it happens, so a crash part-way loses nothing (see --backfill). */
mkdirSync("data/google-check", { recursive: true });
const progressFile = `data/google-check/progress-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.ndjson`;

async function worker(): Promise<void> {
  while (next < subjects.length && !stopReason) {
    const subject = subjects[next++];
    const checked = await check(subject);
    results.push(checked);
    appendFileSync(
      progressFile,
      JSON.stringify({
        ...describe(subject),
        verdict: checked.outcome?.verdict ?? null,
        placeId: checked.outcome?.placeId ?? null,
        reason: checked.outcome?.reason ?? checked.error,
      }) + "\n",
    );
    done += 1;

    if (commit && checked.outcome && subject.kind === "business") {
      const verdict: GoogleCheck = {
        verdict: checked.outcome.verdict,
        // Kept in the report either way; see --backfill.
        placeId: noPlaceIds ? null : checked.outcome.placeId,
        checkedAt: new Date().toISOString(),
      };
      await catalog.recordGoogleCheck(subject.business.id, verdict);
    }
    if (done % 100 === 0) {
      const perMinute = Math.round((done / (Date.now() - startedAt)) * 60_000);
      console.log(`  ... ${done} of ${subjects.length} checked (${perMinute} a minute)`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ── Leads that fail ───────────────────────────────────────────────────────

/** Each active lead's verdict: from its catalog row, or its own lookup. */
const leadVerdicts: { lead: Lead; verdict: GoogleCheck["verdict"]; reason: string }[] = [];
if (checkLeads) {
  const fromRun = new Map(
    results.flatMap((r) => (r.outcome && r.subject.kind === "business" ? [[r.subject.business.id, r.outcome]] : [])),
  );
  for (const lead of activeLeads) {
    const row = all.find((b) => b.leadId === lead.id);
    const own = results.find((r) => r.subject.kind === "lead" && r.subject.lead.id === lead.id)?.outcome;
    const outcome = row ? (fromRun.get(row.id) ?? row.googleCheck) : own;
    if (!outcome) continue;
    const reason = "reason" in outcome ? outcome.reason : "Checked in an earlier run.";
    leadVerdicts.push({ lead, verdict: outcome.verdict, reason });
  }
}
const failingLeads = leadVerdicts.filter((v) => hiddenByGoogleCheck({ verdict: v.verdict, placeId: null, checkedAt: "" }));

if (removeLeads) {
  const day = new Date().toISOString().slice(0, 10);
  for (const { lead, verdict } of failingLeads) {
    const why = verdict === "closed" ? "Permanently closed on Google Maps" : "Not found on Google Maps";
    await leads.markRemoved(lead.id, `${why} (checked ${day}).`);
    await catalog.unlinkLead(lead.id);
  }
}

// ── Report ────────────────────────────────────────────────────────────────

const tally: Record<string, number> = {};
for (const r of results) {
  const key = r.outcome?.verdict ?? "error";
  tally[key] = (tally[key] ?? 0) + 1;
}
const report = {
  ranAt: new Date().toISOString(),
  committed: commit,
  googleCallsThisRun: used - usedAtStart,
  googleCallsThisMonth: used,
  cap,
  stopped: stopReason,
  tally,
  // Our records and our verdicts only: nothing of Google's but a place id.
  results: results.map((r) => ({
    ...describe(r.subject),
    verdict: r.outcome?.verdict ?? null,
    placeId: r.outcome?.placeId ?? null,
    nameScore: r.outcome?.best?.nameScore ?? null,
    distanceMetres: r.outcome?.best?.distanceMetres ?? null,
    reason: r.outcome?.reason ?? r.error,
  })),
  leads: leadVerdicts.map((v) => ({ id: v.lead.id, name: v.lead.provider.name, verdict: v.verdict, reason: v.reason })),
  leadsRemoved: removeLeads ? failingLeads.map((v) => v.lead.id) : [],
};
mkdirSync("data/google-check", { recursive: true });
const file = `data/google-check/${report.ranAt.replace(/[:.]/g, "-")}${commit ? "" : "-dry"}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));

console.log("");
console.log(`Checked ${results.length}: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}.`);
console.log(`Google calls: ${used - usedAtStart} this run, ${used} this month (cap ${cap}).`);
if (stopReason) console.log(`STOPPED: ${stopReason}.`);
if (checkLeads) {
  for (const v of leadVerdicts) console.log(`  lead ${v.verdict.padEnd(9)} ${v.lead.provider.name}`);
  console.log(
    removeLeads
      ? `Removed ${failingLeads.length} lead(s) from the list.`
      : `${failingLeads.length} lead(s) would be removed (add --commit --remove-leads).`,
  );
}
console.log(`Report: ${file}`);
// Set inside the workers, which the compiler cannot follow.
const stopped = stopReason as string | null;
if (stopped?.startsWith("Google refused")) process.exitCode = 1;
