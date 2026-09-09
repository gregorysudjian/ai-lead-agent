/**
 * How much of an ingested slice do we already have?
 *
 * READ-ONLY. Nothing is written to Supabase, by design -- this exists to
 * answer a question before a load, not to perform one.
 *
 * Uses the application's own `findExistingLead`, so the answer is the one the
 * real loader would produce rather than an approximation of it. That matters:
 * an Overture GERS id will never equal an OSM node id, so every match here is
 * the secondary normalised name+address strategy doing its job, and that is
 * exactly the path a load would exercise.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { findExistingLead } from "../src/lib/dedupe";
import type { DiscoveredBusiness, Lead } from "../src/lib/types";
import { rowToLead } from "../src/server/repo/supabase-mapping";

const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7) ?? "data/overture/CA-QC.ndjson";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db.from("leads").select("*");
if (error) throw new Error(`could not read leads: ${error.message}`);

const existing: Lead[] = (data ?? []).map((row) => rowToLead(row));
const incoming: DiscoveredBusiness[] = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as DiscoveredBusiness);

console.log(`existing leads in Supabase : ${existing.length}`);
console.log(`incoming from ${file} : ${incoming.length}\n`);

let matched = 0;
const byReason = new Map<string, number>();
const examples: string[] = [];

for (const candidate of incoming) {
  const hit = findExistingLead(existing, candidate);
  if (!hit) continue;
  matched += 1;
  byReason.set(hit.reason, (byReason.get(hit.reason) ?? 0) + 1);
  if (examples.length < 8) {
    examples.push(`  ${candidate.name}  <-  ${hit.lead.provider.name} (${hit.lead.provider.source}, ${hit.reason})`);
  }
}

console.log(`already have  : ${matched}`);
console.log(`genuinely new : ${incoming.length - matched}`);
console.log(`overlap       : ${((matched / incoming.length) * 100).toFixed(2)}%\n`);
for (const [reason, n] of byReason) console.log(`  matched by ${reason}: ${n}`);
if (examples.length) {
  console.log("\nexamples:");
  console.log(examples.join("\n"));
}
console.log("\nNothing was written. This was a read.");
