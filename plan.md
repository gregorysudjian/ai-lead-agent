# Overnight plan — 2026-09-09

Written before you went to sleep. Everything here is decided in advance so I
never stop to ask a question. Where a choice came up, I made it, wrote down
why, and made it cheap to reverse.

**Results are appended at the bottom as I go.** Read that section first when
you wake up.

---

## Standing rules I am holding myself to

1. **No questions, no permission requests.** Every decision below is already
   made. If something new comes up, I take the conservative option, log it
   under *Decisions I made for you*, and keep moving.
2. **I do not write to your Supabase.** Not one row, not one table. Reads only,
   and only to check dedupe overlap. Loading tens of thousands of rows into a
   500 MB free tier unsupervised is exactly the kind of thing that should have
   a human awake for it.
3. **I do not apply migrations.** I write them; you run them. I cannot anyway —
   we hold the service key, not the database password.
4. **Nothing costs money.** Overture is free and public. No Google, no
   Anthropic calls, no paid tier.
5. **Nothing is contacted.** Hard rule 1 is untouched. No send path exists and
   I will not add one.
6. **I never commit red.** Every commit passes `npm test`, `npm run lint` and
   `npm run build`. If I cannot get something green, I revert it rather than
   leave it broken.
7. **I stay inside the project.** No files written elsewhere on your Desktop.
   Scratch work goes in the session temp directory.
8. **No pushing.** Commits land on `main` locally. Nothing leaves the machine.

---

## Decisions I made in advance, so I do not stall

**Confidence is filtered at ingest, not stored.** Overture gives every place a
0–1 confidence, and 302 of Montreal's no-website places score under 0.3.
Adding a `confidence` field to `ProviderSnapshot` would touch the domain type,
every provider, the leads table and a migration. Instead the ingest script
drops anything under **0.5** and reports how many it dropped. Same quality
benefit, no schema change, and the threshold is a flag if you disagree.

**The ingest writes a local file, not the database.** `data/overture/*.ndjson`
plus a report. You load it in the morning with one command. This is the single
biggest risk reduction available: if the normaliser is wrong, you find out from
a file you can read, not from 40,000 bad rows in Supabase.

**Overture places get `source: "overture"`.** A new `BusinessSource`, not
reusing `"osm"`. The two datasets disagree, carry different licences and need
different attribution — CLAUDE.md is explicit that OSM data must never be
presented as coming from another provider, and the reverse is just as true.

**Overture attribution appears wherever OSM attribution does.** Places is
CDLA-Permissive 2.0, which requires preserving attribution. Same treatment as
ODbL: credited in the UI wherever the data is shown.

**Category mapping is many-to-one and rejects the unknown.** Overture's
taxonomy has hundreds of values; ours has twelve. Anything I cannot map
confidently maps to `null` and is skipped, rather than being forced into the
nearest category. A bakery filed under "restaurant" produces a demo about the
wrong business.

**If a step is blocked, I skip it and continue.** Every item below has a
fallback. Nothing waits on anything it does not strictly need.

---

## Work items, in order

Each is independently committable. If I run out of time, everything before the
stopping point is finished and green, not half-done.

### 1. Overture category mapping
`src/lib/overture/categories.ts` + tests

Map Overture `categories.primary` onto the twelve categories in
`osm/categories.ts`. Many-to-one where it is genuinely the same trade
(`coffee_shop` → cafe). `null` for anything else.

*Done when:* every category the probe found in Montreal either maps or is
explicitly rejected, with a test naming both lists.
*Fallback:* if I cannot enumerate the taxonomy offline, I read the distinct
values straight out of the Quebec slice — one cheap query.

### 2. Overture → `DiscoveredBusiness` normaliser
`src/lib/overture/normalize.ts` + tests

Same shape and same discipline as `osm/normalize.ts`: pure, total, no
invention. Drops anything with no usable name. Preserves `websites[0]` exactly
as given — the "is that actually their own site" judgement already lives in
`social-hosts.ts` and stays there.

*Done when:* round-trip tests on real rows captured from the probe, including
missing address, missing phone, empty names, and a hostile name.
*Fallback:* none needed; this is offline and pure.

### 3. `overture` as a `BusinessSource`
`types.ts`, row mapping, `attribution.tsx`, UI labels

*Done when:* the union, the mappers and the UI all know the new source, the
existing architecture tests still pass, and attribution renders.
*Fallback:* none needed.

### 4. The ingest script
`scripts/overture-ingest.mjs`

Reads a region slice, maps categories, normalises, filters confidence, dedupes
**within the slice**, writes NDJSON plus a report. Region comes from the Region
Resolver's codes — `--region=CA:QC` — so Stage 1 is actually wired to Stage 2
rather than being a module nobody calls.

*Done when:* a Quebec slice is on disk, the report reads sensibly, and I have
spot-checked twenty rows by hand against the source data.
*Fallback:* if the Quebec query is too slow or too large, I fall back to the
Montreal bounding box and say so in the report.

### 5. Dedupe check against what you already have
Read-only against Supabase

How many of the ~2,900 addressable Montreal businesses are already in your 230
leads? Answers whether the loader needs to be careful or whether the overlap is
negligible. Read-only — no writes, per rule 2.

*Done when:* the report states the overlap count and how it was matched.
*Fallback:* if Supabase is unreachable, I compare against a read-only export
and note it.

### 6. Locality data for the Region Resolver
`src/lib/region/localities.ts` (generated) + tests

The resolver currently cannot place a city, by design — it takes localities as
an argument and has none. Overture's divisions theme has them. I extract
Quebec and a first US state, and generate a static registry, which finishes
Stage 1 properly.

*Done when:* `resolveRegion("Austin")` and `resolveRegion("Laval")` resolve,
and the "CA" collision still reports as ambiguous.
*Fallback:* if divisions are unwieldy, I generate localities from the distinct
`addresses[].locality` values already in the places slice. Less authoritative,
same practical effect, and I say so in the file header.

### 7. Documentation and tidy-up
`ROADMAP.md`, `README.md`, `CLAUDE.md`

Record the Overture decision, the source split, and the confidence threshold.
One new CLAUDE.md principle covering the two-dataset situation.

---

## Explicitly not doing tonight

- **Loading anything into Supabase.** Rule 2.
- **The Orchestrator / batch jobs.** It is the biggest piece and its whole
  purpose is running long jobs unattended — building *and* first-running it
  while you are asleep is how you wake up to 40,000 rows of something wrong.
- **Auto-generating demo sites in bulk.** You chose top-N-by-score, which
  needs the batch runner, which is above.
- **Touching the outreach path.** Nothing near sending, ever.
- **Refactoring anything that currently works** unless a task above forces it.

---

## What you do in the morning

Two things, both small:

1. **Apply one migration** if item 3 or 4 needed a schema change — I will name
   the exact file in the results below, or say plainly that none is needed.
2. **Run one load command**, which I will give you verbatim, after you have
   looked at the report and the sample rows.

Everything else will be committed, green, and reviewable with `git log`.

---

## Results

*Appended as I work. Newest entry last.*
