# Roadmap

Where this project stands, what to build next, and why in that order.

Written 2026-09-07 against commit `2d3b75f` ("Add contact sheets and outreach
records"), with uncommitted work in progress on the demo/profile migration.

**Updated 2026-09-08.** Phases 0 and 1 are done. The demo/profile migration
landed across five commits (`9ad15fe`..`de4ad79`) and the suite is green;
authentication, rate limits, CI and the README followed. Phase 2 is next.
Gaps 1, 2, 3, 8 and 9 below are closed and struck through; the rest stand.

This document is a plan, not a promise. Each phase states what it delivers, the
files it touches, and how you know it is done. Phases are ordered by dependency
and risk, not by how interesting they are. Read the rationale before the
checklist — the ordering is the actual content here.

---

## Part 1 — Where the project actually is

### Built and working

| Layer | State |
|---|---|
| Domain types | `Lead` / `provider` split enforced, `null` vs `[]` distinction honoured |
| Discovery (single-source) | OSM via Overpass, mock fixtures, search-and-save persists leads |
| Discovery (multi-source) | Orchestrator groups OSM + Google into **transient candidates** |
| Dedupe | Place ID primary, normalized name+address secondary |
| Scoring | Deterministic, pure, unit-tested, provider-independent |
| Research | `BusinessProfile` with per-fact `sourceId`, SSRF-guarded fetch, robots honoured |
| Analysis | Mock + Anthropic providers, reads the **lead snapshot** |
| Demo sites | Generated specs, internal preview route |
| Outreach | Contact sheet with provenance, deterministic drafts, status log, no send path |
| Persistence | JSON (dev) and Supabase behind repository interfaces, RLS-locked migrations |

That is a genuinely well-built foundation. The provider and repository seams are
real, the safety rules are enforced by tests rather than by comments, and the
`Lead -> BusinessProfile` boundary holds.

### The honest gaps

These are the things actually missing, found by reading the code:

1. ~~**Six tests are failing right now.**~~ **DONE.** The migration landed and
   the suite is green (1355 tests, up from 1268). Original note: the in-flight demo/profile migration
   trips the architecture guard in
   [profile-architecture.test.ts](src/server/repo/profile-architecture.test.ts),
   which still asserts demo generation does *not* read profiles. Also
   [demo-facts.test.ts](src/lib/demo-facts.test.ts) and
   [demo-mapping.test.ts](src/server/repo/demo-mapping.test.ts) — field-set
   assertions that have not caught up with the new `bookingUrl` field.

2. ~~**There is no authentication of any kind.**~~ **DONE.** Password login,
   signed stateless session cookie, `proxy.ts` optimistic redirect, and a
   Data Access Layer enforcing every page and route handler. An architecture
   guard test fails if a new one forgets.

3. ~~**`/demos/[id]` claims to be private and is not.**~~ **DONE.** It now
   requires a session, and the comment says so -- including that this means
   demos cannot currently be shown to the business, which is Phase 8's job.
   Original note: the file comment said
   "NOT a public URL ... reachable only by someone already using the tool."
   With no auth, that sentence becomes false the moment this deploys. Anyone
   with the id — a UUID, but still — reads the demo.

4. **Discovery candidates are a dead end.** The orchestrator explicitly writes
   nothing, and no promotion step exists. A Google-sourced business can be
   *seen* and never *kept*. The multi-source work is currently a preview with no
   exit.

5. **Analysis still reads the lead, not the profile.** CLAUDE.md names this as a
   deliberate step rather than an oversight — but it remains undone, and the
   demo migration in flight is the precedent for it.

6. **Nothing tracks spend.** Google Places and Anthropic are both billable per
   call. Hard rule 5 governs *connecting* them; nothing governs what they cost
   once connected.

7. **Nothing ages.** `fetchedAt` is stored and displayed but never acted on. No
   snapshot is ever considered stale.

8. ~~**The README is still the `create-next-app` default.**~~ **DONE.** Rewritten:
   what this is, the hard rules, how to run it on mocks, where the auth
   boundary actually sits, and what each provider costs.

9. ~~**No CI.**~~ **DONE.** `.github/workflows/ci.yml` runs lint, tests and
   build on every push and pull request, with no real credentials.

---

## Part 2 — Two research findings that change the plan

I looked these up rather than assuming them, because both directly shape
features below.

### CASL makes provenance a legal asset, not just good hygiene

The target market is Montreal. Canada's Anti-Spam Legislation is opt-in, has
**no blanket B2B exemption**, and carries penalties up to **CAD $10M per
violation** with personal liability for directors and officers. It applies to
any commercial electronic message sent to a Canadian address — including one a
human sends by hand from a draft this tool produced.

The relevant basis for cold outreach is **implied consent by conspicuous
publication**: the business published its contact address publicly, without a
no-solicitation notice, and the message is relevant to its role.

Here is why that matters architecturally. This codebase *already* records
exactly the evidence that basis requires. Every `ContactPoint` in
[outreach.ts](src/lib/outreach.ts) carries `origin` (`website` | `discovery`)
and `sourceLabel`, and every profile fact carries a `sourceId` resolving to a
`SourceRecord`. The compliance feature is not new plumbing — it is *reading the
provenance you already store* and deciding whether a contact is defensible.

That makes CASL support one of the highest-value, lowest-effort features
available. It is Phase 4.

### Google's caching rules confirm the current boundary — and add one rule

Place IDs are storable indefinitely; latitude/longitude may be cached at most 30
days; everything else (name, address, phone, website, rating, hours) must be
requested live and not warehoused. The existing "Google is how we find the door,
not what we record" boundary in `.env.example` is correct.

The one thing not yet handled: Google recommends **refreshing place IDs older
than 12 months**, since they can be retired or replaced. That is a concrete
freshness job, and it is Phase 7.

---

## Part 3 — The roadmap

### Phase 0 — Land the in-flight demo/profile migration  ✅ DONE

**Why first:** a red test suite disables every guard in the project. Until this
is green, none of the architecture tests are protecting anything, and every
later phase builds on an unverified base.

- Update the architecture guard in `profile-architecture.test.ts` to reflect the
  new intended shape: demo generation *is* now a profile reader. Do not delete
  the guard — move the line. It should still fail if, say, `scoring.ts` starts
  importing profiles.
- Update the permitted field sets in `demo-facts.test.ts` and the round-trip in
  `demo-mapping.test.ts` for `bookingUrl`.
- Confirm the precedence rule holds: a fact read from the business's own site
  outranks the discovery snapshot, and a demo never states a fact with no
  source.

**Done when:** `npm test` is green and the guard still fails if an unrelated
module imports `business-profile`.

---

### Phase 1 — Make deployment safe  ✅ DONE

**Why here:** this is the only phase that is a genuine blocker on shipping.
Everything else can wait; this cannot. The lead database, every generated demo,
and every outreach draft are currently readable by anyone who reaches the URL.

1. **Authentication.** Single-operator app, so keep it boring: Supabase Auth
   with one account, or a signed session cookie behind a password from the
   environment. Add `src/middleware.ts` protecting everything except an explicit
   public allow-list.
2. **Decide what `/demos/[id]` is.** Either put it behind auth (and correct the
   file comment), or make sharing deliberate — see Phase 8. Do not leave it in
   its current state, where the comment and the reality disagree.
3. **Rate-limit the route handlers.** `/api/search`, `/api/discovery` and
   `/api/leads/[id]/research` each reach a third party. Unauthenticated *and*
   unlimited is how a public Overpass instance gets abused in your name — which
   CLAUDE.md explicitly forbids.
4. **CI.** GitHub Actions running `npm run lint`, `npm test`, `npm run build` on
   every push. The test suite encodes the hard rules; automate it.
5. **Rewrite the README.** What this is, the hard rules in brief, how to run it
   with mock providers, and how to turn on each real provider and what it costs.

**Done when:** a logged-out request to `/leads`, `/demos/<id>` and every `/api`
route is refused, and CI is green on `main`.

---

### Phase 2 — Give discovery candidates an exit  ⬅ NEXT

**Why here:** the multi-source orchestrator is finished work that currently
produces nothing durable. This is the highest ratio of value to new code in the
roadmap — the hard part is built.

- A **promote** step: candidate -> `upsertDiscovered`, running through the
  existing dedupe rather than beside it.
- Promotion is **explicit and per-candidate**. No "save all". The preview is a
  human decision point, and that is a feature.
- **Respect the Google boundary on promotion.** A Google-sourced candidate may
  contribute a place ID and the fact that a business exists. It must not
  warehouse Google's name, phone or rating into a stored snapshot. Practically:
  promote it as a lead whose durable content comes from OSM or from our own
  reading of the business's page, with Google as an external reference only. If
  a candidate has *only* Google as a source, that constraint is real and the UI
  should say so rather than quietly storing the payload.
- Show, on each candidate, whether it already matches a stored lead — so the
  operator is not deciding blind.

**Done when:** a multi-source run can be turned into leads without leaving the
page, no Google-only field lands in `provider`, and re-running the same search
creates zero duplicates.

---

### Phase 3 — Analysis reads the profile

**Why here:** it completes the pipeline CLAUDE.md declares
(`Lead -> BusinessProfile -> Analysis -> DemoSite`), and the demo migration in
Phase 0 is the worked example to copy.

- `analysis-facts.ts` reads the profile with `resolveField` precedence, exactly
  as demo facts now do.
- Every fact handed to the model keeps its source. Untrusted page text stays
  data — never concatenated into the prompt as instructions.
- The prompt gains an explicit "state nothing without a source" constraint, and
  the schema keeps a field for what the model was *not* able to determine.
- Extend the architecture guard again rather than removing it.

**Done when:** an analysis for a researched lead cites facts from the business's
own site, and an analysis for an unresearched lead degrades to the snapshot
without inventing anything.

---

### Phase 4 — CASL-defensible outreach

**Why here:** this is where the research changed my recommendation. Outreach
exists; the next thing it needs is not more features but a legal spine — and the
data model already has the bones.

1. **A consent basis on every `OutreachRecord`.** Not free text — a union:
   `conspicuous-publication | existing-relationship | enquiry | express | none`.
   A draft with `none` cannot be marked approved.
2. **Derive the basis from provenance you already hold.** A `ContactPoint` with
   `origin: "website"`, read from the business's own public page, is the
   textbook conspicuous-publication case, and the `sourceLabel` is the evidence.
   Compute a *suggested* basis; require a human to confirm it.
3. **Detect no-solicitation notices.** The website source already fetches and
   extracts page text. Scanning for "no unsolicited", "pas de sollicitation" and
   the common variants is cheap, and it is precisely the condition that destroys
   the conspicuous-publication basis. Record the finding as an observation with
   a source, like everything else.
4. **Mandatory identification block on email drafts.** Sender name, mailing
   address, and a working way to opt out. Compose it from configuration; refuse
   to produce an email draft when it is unset.
5. **A suppression list.** One table, checked before any draft is composed. "Do
   not contact" must outlive the lead record and survive rediscovery — so key it
   on our internal lead id *and* on the normalized name+address, since a
   business can come back under a new place ID.
6. **Relevance to role.** The basis requires the message to be relevant to the
   recipient's business. A one-line note per record is enough, and it forces the
   operator to think before approving.

**The hard rule is untouched.** Nothing here sends anything. This phase makes
the *human's* send defensible, which is the only kind of send this system will
ever participate in.

**Done when:** every record carries a basis, an unbacked draft cannot reach
`approved`, a suppressed business produces no draft at all, and the record shows
the evidence for its basis on screen.

---

### Phase 5 — Find the contacts that actually exist

**Why here:** [outreach.ts](src/lib/outreach.ts) makes the sharp observation
that the businesses worth approaching have no website, so no email exists in our
records. That is true — and partially fixable, because plenty of these
businesses have a Facebook page and a contact form and no `.com`.

- **Follow the contact page.** Research reads only the homepage today. Add a
  bounded second hop: at most one or two same-origin links matching `/contact`,
  `/about`, `/nous-joindre`, `/coordonnees`. Every hop still goes through
  `assertResearchableUrl`; the budget is small and fixed.
- **Extract emails and phone numbers with provenance**, as observations
  attributed to the page they were read from. This is what makes Phase 4's
  consent basis available for email at all.
- **Resolve social profiles.** OSM carries `contact:facebook` and
  `contact:instagram` tags that are not imported yet. For a business with no
  website, the Facebook page often *is* the website — and that reframes the
  pitch honestly, which the draft composer already tries hard to do.
- ~~**Import OSM opening hours.**~~ **DONE.** `parseOsmOpeningHours` reads the
  tag all-or-nothing: a small unambiguous subset is parsed, everything else
  returns null rather than a half-understood schedule. About a third of live
  Montreal results carry a value it accepts. Demos now show a business's real
  hours, and their contact section is confirmed rather than marked sample.

**Done when:** a researched lead with a contact page yields an email carrying a
source, and a website-less lead can still surface a social contact point.

---

### Phase 6 — Know what you are spending

**Why here:** hard rule 5 governs connecting paid services. Once Google Places
and Anthropic are on, nothing tells you what a day of use costs, and nothing
stops a loop from costing real money.

- **A call ledger.** One row per billable call: provider, operation, lead id,
  timestamp, and — where derivable — the SKU. Not the payload.
- **A configurable daily cap** per provider. Exceeded, the provider refuses and
  says so plainly, rather than the run silently degrading.
- **Surface it.** `system-status.tsx` already reports configuration; it is the
  natural home for "today: 14 Places lookups, 6 analyses."
- **Make cost visible at the point of decision.** A button that spends money
  should say so before it is clicked.

**Done when:** every paid call is ledgered, the cap is enforced server-side, and
the UI shows the day's spend without a database query by hand.

---

### Phase 7 — Let data age honestly

**Why here:** `fetchedAt` exists on every snapshot and nothing reads it. This is
both a compliance obligation and a quality feature.

- **Staleness in the UI.** A snapshot fetched eight months ago should say so.
  Cheap, and it changes how an operator reads the record.
- **Place ID refresh past 12 months**, per Google's own guidance. Place IDs can
  be retired; the dedupe design already anticipates a business reappearing under
  a new one, so this closes the loop the architecture was built for.
- **Enforce the 30-day coordinate rule** — if lat/lng is ever stored, it needs a
  deletion job. Better still: decide deliberately not to store it.
- **Re-verify "no website found."** Rule 7 says a missing website is never a
  confirmed absence, and that is right. But "we looked on three occasions over
  six months and found nothing" is a stronger, still-honest statement than "no
  website listed" — and it is the single most decision-relevant fact in the
  system. Record verification attempts with dates; never let it collapse into a
  boolean.

**Done when:** the lead page distinguishes fresh from stale data, and a
never-verified lead reads differently from a repeatedly-verified one.

---

### Phase 8 — The operator's day

**Why last of the substantial phases:** these are quality-of-life features. They
compound only once the pipeline above is complete, and building them earlier
would mean building them twice.

- **Territory coverage.** Which city × category pairs have been searched, when,
  and how many leads each produced. Turns ad-hoc searching into a plan and stops
  wasted repeat runs against a volunteer-run Overpass instance.
- **A pipeline board.** Leads grouped by outreach status, not just lead status.
  The `LeadStatus` union stays minimal (CLAUDE.md is right to resist a CRM state
  machine) — the board reads `OutreachRecord` status instead.
- **Follow-up reminders.** A due date on a record and a "due today" list. Still
  no sending; a reminder tells a human to act.
- **CSV export.** Leads with scores and contact points, for working offline.
- ~~**Shareable demo links.**~~ **DONE**, pulled forward out of this phase: it
  was the one thing blocking the tool from being used at all. `/s/[token]` is
  the only public route; the token is 32 random bytes distinct from the demo
  id, every share expires, any share can be revoked, and unknown, expired and
  revoked all render the same 404.
- **Pagination / server-side filtering.** `leads-browser.tsx` loads every lead
  and filters client-side with a presentation cap. Fine at hundreds; not at
  thousands. Move filtering into the repository when it actually hurts — not
  before.

---

## Part 4 — Things worth considering, with reservations

Ideas that came out of brainstorming and did not earn a phase. Recorded with the
reason, so they are not re-proposed from scratch later.

- **Bulk or scheduled rediscovery.** Directly at odds with "requests happen only
  in response to an explicit user search." If it is ever built, it needs its own
  rate budget and a hard justification. Default answer: no.
- **AI-scored lead ranking.** Explicitly forbidden. Scoring stays deterministic.
  Worth restating because it is the single most likely rule to be violated by
  accident, in a moment when the fixed weights feel wrong.
- **Competitor analysis for the pitch.** Genuinely useful (*"three of the five
  salons near you have booking pages"*), but it means fetching other businesses'
  sites on behalf of a business that did not ask. Needs the request budget and
  the SSRF guard considered again from scratch.
- **Generated images for demo sites.** Cost, licensing, and the risk of showing
  a business a photo of a salon that is not theirs. A placeholder that is
  obviously a placeholder is more honest.
- **Multi-user or team support.** No second user exists. Do not build for one.
- **Automated sending, in any form.** Not a roadmap item at any horizon. It is
  hard rule 1, and the value of this tool is partly that it cannot.

---

## Part 5 — Suggested order, condensed

| # | Phase | Blocking? | Rough size |
|---|---|---|---|
| 0 | Land demo/profile migration, green tests | Yes | Small |
| 1 | Auth, rate limits, CI, README | Yes — nothing ships safely without it | Medium |
| 2 | Promote discovery candidates to leads | No | Medium |
| 3 | Analysis reads the profile | No | Medium |
| 4 | CASL-defensible outreach | Before any real outreach | Medium |
| 5 | Contact-page research, socials, OSM hours | No | Medium |
| 6 | Spend ledger and caps | Before enabling paid providers broadly | Small |
| 7 | Staleness, place-ID refresh, re-verification | No | Small |
| 8 | Operator workflow, sharing, export | No | Large |

**If you only do three:** Phase 0, Phase 1, and Phase 4. The first makes the
guards real again, the second makes deployment safe, and the third is what
stands between a well-built tool and a CAD $10M statute.

---

## Sources

- [Policies and attributions for Places API — Google for Developers](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Place IDs — Places API, Google for Developers](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [CASL Compliance for B2B Cold Email in Canada (2026)](https://www.smarte.pro/blog/casl-compliance)
- [CASL Cold Email: 2026 Compliance Rules & Checklist](https://tomba.io/blog/casl-cold-email)
- [CASL Cold Email Canada Guide 2026](https://litemail.ai/blog/casl-cold-email-canada-guide-2026)

The CASL summaries above are secondary sources. Before acting on Phase 4, read
the legislation and the CRTC's own guidance directly, and consider an hour of a
Quebec lawyer's time — the penalty ceiling makes that the cheapest line item in
this document.
