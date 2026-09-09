# Lead Finder

An AI-assisted lead generation tool for a web design business. It discovers
local businesses through legitimate APIs, stores them as leads, flags the ones
with no website listed, ranks them, and helps draft personalised outreach and
demo sites.

A human reviews and approves everything. **There is no send implementation and
there never will be one** -- see [Hard rules](#hard-rules).

---

## What it does

The pipeline is four stages, and each one is a separate object:

```
Lead  ->  BusinessProfile  ->  Analysis  ->  DemoSite
```

| Stage | What it is |
|---|---|
| **Lead** | A business found by a discovery provider. Application-owned fields (`id`, `status`, notes) are kept structurally apart from the provider snapshot under `lead.provider`. |
| **BusinessProfile** | Sourced facts gathered by fetching the business's own public homepage. Every fact carries a `sourceId`, so "where did we learn this?" always has an answer. Append-only. |
| **Analysis** | Proposals about what the business needs. Never confused with evidence. |
| **DemoSite** | A generated sample website, previewed internally. Every displayed *fact* comes from application code, never from the generator. Sections we cannot evidence carry realistic placeholder copy, marked as sample. |

Ranking is a **pure, deterministic, unit-tested function** of known fields. AI
is used for qualitative analysis and copy generation only, never for ranking
maths.

---

## Getting started

Requires Node 24 and npm.

```bash
npm install
cp .env.example .env.local
```

Then set the two required variables in `.env.local`:

```bash
# At least 32 characters. Generate one:  openssl rand -base64 32
SESSION_SECRET=...
# At least 12 characters.
AUTH_PASSWORD=...
```

These two have **no default and no development fallback**. Every other setting
in this app defaults to the safe option; for a signing secret the safe option
is to refuse to run, because a built-in default is a published default.

```bash
npm run dev
```

Open http://localhost:3000 and sign in with `AUTH_PASSWORD`.

Out of the box every provider is a **mock**: no network calls, no API keys, no
spend. The whole pipeline works offline.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the test suite (vitest) |
| `npm run lint` | Lint |

---

## Hard rules

These are enforced by tests, not by convention. `CLAUDE.md` has the full set
and the reasoning; the ones that most shape the code:

1. **Nothing is ever contacted automatically.** No email, SMS, form-fill or
   outbound message is sent by code. Outreach drafts are generated and stored
   for a human to review and send by hand. There is no send path.
2. **No scraping that violates terms of service.** Official APIs only. Fetching
   a business's own public homepage is acceptable; robots.txt is honoured, a
   User-Agent identifies us, and requests are rate-limited.
3. **API keys never reach the browser.** Every third-party call is server-side.
   Modules that read secrets import `server-only`, so an accidental import from
   a Client Component is a build error rather than a leak.
4. **A missing website means "none found by that provider"** -- not "confirmed
   to have none." The UI, the scoring and the generated copy all preserve that
   distinction. The same caution applies to every other absent field.
5. **Provider data is a refreshable cache, kept apart from what we own.**
   Rediscovery replaces `lead.provider` wholesale, so our own fields survive by
   construction rather than by remembering to preserve them.
6. **OpenStreetMap data carries its attribution.** ODbL, credited in the UI
   wherever it is displayed.
7. **Nothing fetches a URL without `assertResearchableUrl`.** A website URL
   comes from a publicly editable database, so pointing our server at it is an
   SSRF primitive unless constrained: http(s) only, no credentials, no private
   or link-local addresses, DNS re-resolved and every redirect hop revalidated.

---

## Authentication

Single-operator: one password, one session cookie, no user database.

- **`AUTH_PASSWORD`** is the operator's password, compared in constant time.
- The session cookie is **stateless** -- an HMAC-SHA256 token signed with
  `SESSION_SECRET`, using `node:crypto` and no external dependency. It is
  `httpOnly`, `sameSite=lax`, `secure` in production, and lasts 7 days.
- Because sessions are stateless, **there is nothing server-side to revoke.**
  Rotating `SESSION_SECRET` invalidates every outstanding session at once, and
  that is the only way to do it.

### Where the boundary actually is

`src/proxy.ts` (what Next called Middleware before 16) redirects visitors with
no session cookie to `/login`. **It is not the security boundary.** It checks
only that a cookie *exists*, because Next's own guidance is that Proxy runs on
every request including prefetches and must stay cheap.

The real check is next to the data:

- **Pages** call `requireSession()` from `src/server/auth/dal.ts`.
- **Route handlers** call `requireApiSession()` and return 401.

`src/server/auth/auth-coverage.test.ts` walks `src/app` and fails if any page
or handler is missing its guard. Anything intentionally public has to be added
to an allow-list, which is a visible diff in review.

### Sharing a demo

`/demos/[id]` requires a session like everything else. Its id is a UUID, but an
unguessable URL is not an access control.

To show a demo to the business it was made for, the operator creates a **share**
from the preview page. That issues `/s/[token]`, the only route in the app
reachable without a session:

- The token is **32 random bytes**, minted server-side, never derived from the
  demo id. Two shares of one demo have unrelated tokens, so revoking one does
  not silently revoke the other.
- Every share **expires** (7, 30 or 90 days). There are no perpetual links.
- Any share can be **revoked**, which sets a timestamp rather than deleting the
  row — what was shared, and when, survives.
- Unknown, expired and revoked tokens all render the **same 404**, so a probe
  cannot confirm a token was ever real.
- The page carries **none of the operator chrome** — no lead, no analysis, no
  generator, no links into the dashboard — and performs **no write**.
- The **sample-content marks stay**. The shared page is the one place the
  business owner actually reads them, and they exist to be corrected.

---

## Demo sites

A demo is a proposed website for one business, generated in one click and
previewed internally. It is never published and never sent to anyone.

**Why demos contain sample content.** The businesses worth approaching have no
website, so all we hold is a name, a category, a city and maybe a phone number
and an address. A page built strictly from that reads "To be added." in every
slot — honest, and useless, because an owner cannot picture their site from a
blank template.

So unevidenced sections carry realistic, category-typical copy from
`src/lib/demo-samples.ts`. Three rules keep it honest:

1. **Every such section is marked.** It carries a visible "Sample content" tag,
   and the preview chrome lists the sample sections by name.
2. **The marking is not the generator's word.** `enforceSampleFlags` recomputes
   it from the facts actually held and combines the two, so a generator can only
   ever mark *more* as sample — never present an invention as confirmed.
3. **Sample copy never states a checkable specific.** No price, founding year,
   award, named staff member, testimonial, review score, phone number, address,
   URL or clock time. Generic copy reads as a placeholder; one wrong specific
   reads as a lie. It also never invites an action the page cannot back — no
   "give us a call" above a missing phone number.

Real facts always win. Opening hours come from the business's own site when
research read them there, and otherwise from OpenStreetMap's `opening_hours`
tag — parsed by a deliberately narrow reader that understands a value whole or
returns nothing, since a half-read schedule renders a confident, wrong
"Closed". With real hours and a real way to make contact, the contact section
is confirmed rather than marked as sample. Name, phone and address are copied
from the lead.

The store is append-only, so a demo already shown to a prospect is never
rewritten. The index groups by business and shows the newest, with a count of
earlier versions.

---

## Where businesses come from

Two datasets, kept apart on purpose.

**OpenStreetMap**, queried live per search through Overpass. High quality, and
the source of the opening hours a demo shows. It cannot do a state: Overpass
explicitly forbids region-tiling, and the endpoint is volunteer-run community
infrastructure, not our capacity.

**Overture Maps**, ingested in bulk from public Parquet. 72M places under
CDLA-Permissive 2.0 — free, storable, no rate limit and no per-query result
cap, which is what makes state- and country-scale search possible at all.

```bash
# Assess a region before ingesting it
node scripts/overture-probe.mjs

# Extract it to a local file (never to the database)
npx tsx scripts/overture-ingest.mts --region=CA:QC

# Check how much of it you already have (read-only)
npx tsx scripts/overture-overlap.mts

# Regenerate the Region Resolver's city list
npx tsx scripts/overture-localities.mts --regions=CA:QC,US:TX
```

Quebec yields **45,484 businesses** across the twelve trades, 9,985 with no
website listed. Overlap with an existing 230 OSM leads was **4** — the two
datasets are complementary, not redundant.

Three rules the ingest holds:

- **Confidence is a filter, not a field.** Below 0.5, a place often does not
  exist. Storing the number would mean changing the domain type and every
  provider to carry something one source supplies.
- **An unrecognised category is skipped, not approximated.** A bakery filed as
  a restaurant produces a demo about the wrong business.
- **The bounding box prunes; the address codes decide.** A box alone sweeps in
  the neighbouring state; codes alone force a full scan of 7GB.

Regions resolve through `src/lib/region/`. Collisions are reported rather than
guessed — "CA" is both Canada and California, and "Austin" is a real
municipality in Quebec as well as the city in Texas.

---

## Rate limits

`src/server/rate-limit.ts` governs every route that reaches a third party or
spends money -- search and discovery (Overpass, Google), research (a business's
own server), analysis and demo generation (Claude) -- plus sign-in attempts.

The counters are **in-process memory**. On Vercel that means per-instance and
reset on cold start, so this is a governor on accidents and runaway retry
loops, not a defence against a distributed attacker. That is the right amount
of machinery for a single-operator tool behind a login; real users would need a
shared store.

---

## Configuration

Every provider is selected by an environment variable and **defaults to its
mock**, so a missing value can never cause an accidental network call or a
billable request. `.env.example` documents all of them, including which cost
money. The short version:

| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | *(none -- required)* | Signs the session cookie |
| `AUTH_PASSWORD` | *(none -- required)* | The operator's password |
| `DISCOVERY_SOURCES` | falls back to `PLACES_PROVIDER` | osm, google, mock |
| `PLACES_PROVIDER` | `mock` | mock, osm, google |
| `OVERPASS_API_URL` | public instance | Shared community infrastructure |
| `RESEARCH_PROVIDER` | `mock` | `website` makes real outbound requests |
| `WEBSITE_LOOKUP` | `off` | **Paid** per lead when set to `google` |
| `ANALYSIS_PROVIDER` | `mock` | **Paid** when `anthropic` |
| `DEMO_PROVIDER` | `mock` | **Paid** when `anthropic`; `mock` writes the copy for free |
| `LEAD_REPOSITORY` | `json` | `json` is development-only |

**Overpass is not our capacity.** The public instance is volunteer-run
community infrastructure. Queries are bounded to one registry-defined area and
category, run only in response to an explicit user search, and never crawl,
poll or retry in a loop.

**The JSON store is development-only.** It has no concurrency control, no
integrity guarantees, and does not survive Vercel's ephemeral filesystem. Lead
data must move to Supabase/PostgreSQL before deployment; the repository
interface means that is a one-file change.

---

## Architecture

- **Provider interfaces for every external dependency.** Discovery, research,
  analysis and demo generation each have a mock and a real implementation,
  selected by env var. The whole pipeline can be built and tested with zero
  API spend.
- **A repository interface for persistence.** UI and routes never touch a
  database driver; they call a repository. Swapping the store touches one file.
- **Server Components read the repository. Client Components call the API.**
  A page never fetches its own API over HTTP -- that is a round trip to the
  same process. Interactivity lives in small Client Components that POST/PATCH
  and then call `router.refresh()`.
- **Server-only modules are enforced, not conventional.** Anything reading env,
  secrets, a database or a third-party API imports `server-only`. `src/server/`
  is an organisational convention on top of that; the folder name alone is not
  a security boundary.
- **Deduplication** uses Place ID as the external reference plus a normalised
  name+address match, because Place IDs are stable in practice but not
  guaranteed permanent. Leads keep an internal id that never changes.

### Layout

```
src/
  app/          Pages and route handlers
  components/   UI, including the small Client Components
  lib/          Domain types, pure functions (scoring, dedupe, formatting)
  server/       Everything server-only
    auth/       Session, password, DAL, coverage guard
    places/     Discovery providers (mock, OSM)
    research/   Safe fetch, robots, HTML extraction
    analysis/   Mock and Anthropic analysers
    demo/       Mock and Anthropic demo generators
    repo/       Repository interfaces, JSON and Supabase implementations
  proxy.ts      Optimistic auth redirect (NOT the security boundary)
supabase/
  migrations/   RLS-locked schema
```

---

## Deployment

Not deployed yet. Before it is:

- [x] Authentication on every page and route
- [x] Rate limits on every third-party and billable route
- [x] CI running lint, tests and build
- [ ] Move lead data off the JSON store to Supabase/PostgreSQL
- [ ] Decide how (and whether) demos are shared with businesses

See `ROADMAP.md` for what comes next and why in that order.

---

## Licence and data

OpenStreetMap data is (c) OpenStreetMap contributors, licensed under the
[ODbL](https://openstreetmap.org/copyright), and is credited in the UI wherever
it appears. Google Places data is subject to Google Maps Platform terms: place
IDs may be stored, lat/lng cached for at most 30 days, and everything else must
be requested live rather than warehoused.
