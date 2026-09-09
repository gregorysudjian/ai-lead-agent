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

### All seven items are done. Everything is green and committed.

**1,632 tests, 62 files. Lint clean. Build clean.** Four commits:

```
e281e02  Ingest a region from Overture, and give the resolver its cities
b4773b0  Teach the system to read Overture places
091880e  Write the overnight plan
8f96c65  Stop counting a Yellow Pages entry as a website
```

### What you have that you did not last night

**Quebec, extracted and on disk** — `data/overture/CA-QC.ndjson`, 15 MB:

| | |
|---|---|
| Businesses across the twelve trades | **45,484** |
| With no website listed | **9,985** |
| With a phone number | **43,532** |
| Distinct cities | 1,768 |
| Already in your 230 leads | **4** |

That last number is the important one. The overlap is 0.01%: Overture and
OpenStreetMap cover almost entirely different businesses here, so this is
additive rather than a re-run of what you had. The dedupe did work — it matched
"Decor Floral Fleuriste" to "Décor Floral fleuriste" across sources unprompted.

**The Region Resolver can place cities now.** `resolveRegion("Laval")`,
`("Houston")`, `("Dallas")` all resolve against a generated registry of 2,166
localities. `("Austin")` correctly does not — Austin, Quebec is a real
municipality in the Eastern Townships.

### Three things that went wrong, and what they taught

**The first ingest normalised zero of three hundred rows.** DuckDB's driver
returns `DuckDBStructValue` and `DuckDBListValue` wrappers, not plain objects.
The fix belonged in the script, not the normaliser — a pure domain function must
never learn a database driver's shape — so the flattening now happens in the SQL
projection.

**Every city was ambiguous with itself.** Overture carries "Laval" and "LAVAL"
as separate values and SQL `GROUP BY` treats them as different cities, so the
resolver offered two identical choices and refused to pick. The generator now
folds on the same `normalizeTerm` the lookup uses: 2,456 raw values → 2,166 real
localities.

**I broke booking extraction** (yesterday, but worth repeating since the fix
shaped today's design). Adding booking hosts to the "not a real website" list
made the research extractor file every Fresha link as a social profile. The same
host answers two questions oppositely, so there are now two lists.

### One judgement call I made without you

A locality sharing its own parent's name is collapsed to the parent. There is a
Texas in Texas and a Quebec City in Quebec, and reporting the commonest inputs
in the system as ambiguous would be technically true and practically useless.

It is safe because the subdivision **contains** the locality — a search across
Quebec already includes every shop in Quebec City, so nothing is missed. Nevada,
Texas is the sharp edge and stays ambiguous, because it is *not* inside the
state of Nevada. The rule keys on the parent, never on the name. If you disagree
it is one function, `sharesParentName`, and deleting it restores the old
behaviour.

### What I deliberately did not do

**Nothing was written to your Supabase.** Not one row. The ingest wrote a file
you can read instead, which is the whole point: if the normaliser were wrong
you would find out from 15 MB of NDJSON rather than from 45,484 bad rows that
nothing can delete — the lead repository has no delete grant.

**No migration was applied**, and none is needed for anything committed. Loading
will need an `ingest_runs` table, but that decision belongs to a load you are
awake for.

**The Orchestrator is untouched.** Its purpose is running long jobs unattended;
building and first-running it overnight is how you wake up to a lot of something
wrong.

### In the morning

Nothing is required of you. When you want to go further:

```bash
# Look at what was extracted
head -3 data/overture/CA-QC.ndjson
cat data/overture/CA-QC.report.json

# Try the resolver
npx vitest run src/lib/region

# Extract another region
npx tsx scripts/overture-ingest.mts --region=US:TX
```

The next real step is loading Quebec into Supabase, which needs an
`ingest_runs` table, a loader that goes through the existing dedupe, and a
decision about how many of 45,484 you actually want stored. That is a
conversation, not a script — which is why it waited.

