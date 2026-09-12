# Overnight plan — 12→13 September 2026

Three pieces of work, in this order:

1. **The business list keeps itself up to date**, with junk entries cleaned out.
2. **The live site is hardened**, now that it is public on Vercel.
3. **The app looks calmer**: the lead page first, then the dashboard and the
   Businesses page.

The previous overnight plan (the website generator) is kept in
[`docs/plans/2026-09-11-website-generator.md`](docs/plans/2026-09-11-website-generator.md).

---

## What I found while planning

- **The business list is frozen.** It holds Overture release `2026-08-19.0`,
  which is still the newest one published; the next is due around
  mid-September. Nothing refreshes it without a person running two scripts by
  hand, which is the opposite of what you asked for: *"the search engine should
  always be up to date and automatically add new businesses without me telling
  you every time."*
- **Junk and misfiled entries.** `6r5dxckulcvbol/.` (a nonsense name in
  Overture's own data), and pharmacies and chains such as Sephora filed as
  beauty salons.
- **The login limit doesn't hold on Vercel.** Failed-password counting lives in
  one server's memory. On Vercel every request can land on a different, fresh
  server, so the limit barely slows someone guessing. The password is now the
  only lock on a public site.
- **An intermittent Supabase error** (`PGRST303`, a rejected access token) when
  reading the list's "last updated" date. The page survives it, but the date
  can go missing.
- **The pages are busy.** From screenshots of the live site:
  - *Lead page*: about 3,100 px tall, 11 boxes. Phone, address and website
    appear three times (overview, business profile, outreach). Every box opens
    with a grey disclaimer. The actions you actually use (research, website,
    outreach) sit in the middle, while internal IDs and timestamps get full
    boxes. The phone is shown raw (`+15142777528`).
  - *Dashboard*: repeats the Businesses page's four number tiles, adds five
    more for leads, and shows a row of system settings ("Lead store:
    Supabase, Analysis: Mock") that are for a developer, not for you.
  - *Businesses*: the same four tiles again, a large filter panel, and three
    links plus a button on every card.

---

## Rules for the night

- **Nothing paid, nothing contacted.** Only the free providers already
  configured. No business is emailed, called or visited by code.
- **Every push goes live.** GitHub `main` now deploys to Vercel production
  automatically, so a commit is only pushed after the full check passes in an
  isolated copy: types, lint, all tests, and a production build.
- **Code that needs a new database table must work before the table exists.**
  You will apply migrations in the morning; until then the site must behave
  exactly as it does today.
- **Honesty rules stay.** "Not listed" never becomes "none", sample content
  stays marked, data sources stay credited. Making a page calmer means saying
  each of these once and clearly, not deleting them.
- **Look at every change.** Screenshots before and after, desktop and phone,
  **light and dark mode** (you use dark).
- **Old demos, leads and records are never rewritten.**

---

## Part 1 — The business list updates itself

### 1.1 Find the newest release automatically
- A small function lists Overture's public releases and picks the newest one
  that is newer than what the catalog last loaded. Pure logic, tested with
  fixture listings (older, equal, newer, malformed names).

### 1.2 One command that does the whole refresh
- `scripts/catalog-refresh.mts` chains what exists today: extract the island
  from the new release, then load it through the same `refresh()` rules the
  catalog already enforces (a new business is added; a changed one updated;
  one the release no longer lists is marked "no longer listed", never
  deleted).
- **A circuit breaker.** If the new extract is much smaller than the current
  list (say under 80% of it), the run stops and reports instead of marking
  hundreds of businesses as gone because of a bad release.
- `--dry-run` prints what would change without writing.
- Every run is recorded in the existing `ingest_runs` table.

### 1.3 A scheduled job on GitHub Actions
- `.github/workflows/catalog-refresh.yml` runs **once a week** (cheap: if
  there's no new release it exits in seconds) and can also be started by
  hand from GitHub.
- Why GitHub and not Vercel: the extract reads a very large public dataset
  for several minutes, far beyond a Vercel function's time limit. GitHub
  Actions is free for a public repository.
- It needs two repository secrets, `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
  (see *What I need from you*).
- Each run writes a short summary on GitHub: release, added, updated, no
  longer listed, skipped.

### 1.4 Clean out junk, and keep it out
- A pure `catalogExclusion(record)` rule used **both** when loading and when
  searching, so today's junk disappears from the list without deleting
  anything, and future junk never gets in:
  - names that aren't a real name (no real word, digit-and-letter noise,
    trailing punctuation), tested against the whole real catalog so no real
    business is caught;
  - known chains and non-trades filed under beauty (Sephora, Jean Coutu,
    Pharmaprix, Uniprix, Familiprix, Walmart and similar), as a data list;
  - rows Overture files under a pharmacy or department-store category
    alongside a beauty one.
- The rule's effect on the real catalog is written to the results below: how
  many hidden, and the full list, so you can see that nothing real was hidden.

### 1.5 Show freshness in the app
- The Businesses page and dashboard show "Updated <date> · release <x>" and,
  after the first real refresh, "N new this month" (the tile already exists
  but reads "—").

*Done when:* a dry run against the current release reports "no changes"; a
refresh against a fixture release adds, updates and marks businesses
correctly in tests; the workflow file is committed; junk is hidden in the
live list.

---

## Part 2 — Harden the live site

### 2.1 A login limit that holds on Vercel
- Failed attempts are counted in Supabase (a new `auth_attempts` table, per
  hashed client address, 15-minute window), so every server sees the same
  count. After a few failures, sign-in pauses with a clear message.
- **Before the table exists**, it falls back to today's in-memory limit, so
  deploying tonight changes nothing until you run the migration.
- The migration follows the project's security rule: RLS on, no policies,
  and the server may only insert, read and delete.

### 2.2 Find and fix `PGRST303`
- Reproduce it, identify the cause (likely the access token's time claims
  being checked against a clock that disagrees), and fix it properly. If it
  can't be fully fixed from our side, retry once and log clearly.

### 2.3 Standard protections
- Browser security headers on every page: no framing by other sites (our own
  design grid still works), no content-type guessing, a strict referrer
  policy, and camera, microphone and location turned off.
- Keep the dashboard out of search engines: `robots.txt` disallows
  everything, and pages carry `noindex`. The share pages already do.
- Confirm the login limit reads the real visitor address on Vercel, not a
  proxy's.

*Done when:* the live site sends the headers (checked with a real request),
the fallback is proven by tests with and without the table, and `PGRST303` is
explained in the results.

---

## Part 3 — A calmer interface

The goal is **less on screen at once, same information available**. Not a
redesign: same colours, same components, clearer hierarchy.

### 3.1 Lead page (the priority)
- **One header that answers "who and what next"**: name, trade, area,
  priority, formatted phone and address, website status, and the next useful
  action (research, generate a site, write outreach) as the main button.
- **Each fact shown once.** Contact and website live in the header and one
  "Details" box; the business profile shows only what research ADDED, with
  its sources.
- **Disclaimers said once, calmly**: one short line where it matters, the rest
  behind a small "?" or a "How this works" toggle. The honesty text is kept.
- **Order by what you do**: Research → Website (analysis + demo) → Outreach.
- **Technical details collapsed**: internal IDs, external IDs, fetch times
  and the priority breakdown go into a closed "Record details" section.
- Target: roughly half the page height with nothing lost.

### 3.2 Dashboard
- Becomes "what to do next": a short list (leads not yet researched, leads
  without a website demo, leads marked new), a few key numbers, and the
  search box.
- Drop the tiles that repeat the Businesses page, and move the system
  settings row into a small footer line.

### 3.3 Businesses page
- Fewer tiles; filters in a slimmer bar; each card clickable as a whole to
  its detail page, with **Add to leads** as its only button.

### 3.4 Everywhere
- Consistent spacing and text sizes, fewer borders and boxes-inside-boxes,
  phone numbers always formatted. The "SOON" items in the menu become quieter
  or grouped.
- Checked in light and dark mode, desktop and phone.

*Done when:* before and after screenshots for each page are in the results,
every test passes (including the honesty tests), and nothing that was on a
page is unreachable.

---

## What I need from you

**Before you sleep (optional, saves time):**
- Reply **"yes, add the GitHub secrets"** and I'll store `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` as encrypted GitHub Actions secrets with your existing
  GitHub login, so the weekly job can run tonight. Otherwise I'll leave
  two-minute steps for the morning, and the job will wait until then.

**In the morning:**
1. Run one SQL migration in Supabase (the login attempts table). I'll send the
   direct link and the file.
2. Open the live site and look at the lead page, dashboard and Businesses page.
3. Read **Results** below.

---

## Your answers before sleeping

- **GitHub secrets:** yes, add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as
  encrypted Actions secrets.
- **Going live:** yes, each change goes live as it's finished, after the full
  check passes.
- **"SOON" menu items** (AI Analysis, Outreach): hide them for now.

---

## Results

*Filled in as I go, newest last.*

### Part 1 — the business list updates itself · done, one step left for you

- **GitHub secrets** `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are stored,
  encrypted, on the repository.
- **Finding new releases** (`src/lib/catalog/releases.ts`, 10 tests): reads
  Overture's public release list, picks the newest one not yet loaded, never
  goes backwards.
- **One refresh command** (`scripts/catalog-refresh.mts`): check → read the
  release → safety check → load, with a summary GitHub shows on each run.
  Default is a dry run; `--commit` loads.
  - Tonight's run: *"Loaded 2026-08-19.0 (2,821 listed) · newest published
    2026-08-19.0 · up to date."* A forced dry run of the same release read
    4,878 places in 10 seconds, built 2,825 businesses and would add 0 and
    refresh 2,821. The whole pipeline works end to end.
  - **Safety stop**: a release with under 80% of today's list stops the run
    and fails the job (GitHub then emails you) instead of marking real
    businesses as gone.
- **Junk cleaned out** (`src/lib/catalog/exclusion.ts`, 9 tests): hidden in
  search and never loaded again. On the real catalog it hides **18 of
  2,839**: 13 pharmacies (Uniprix and its "Clinique Santé … Pharmacie
  affiliée" branches), 3 chain stores (2 Sephora, Bath & Body Works), 2
  chiropractors, 2 broken names (`6r5dxckulcvbol/.`, `�Bricassoo�`). None is
  one of your leads, and a lead is never hidden. Real names that merely look
  odd (Fade2Brooklyn, Salon H4H, WNTD, Au 2e) are kept, and tested.
- **Freshness** was already shown ("Updated … · Overture Maps release …"
  and the "New this month" tile); it gets a cleaner place in Part 3.
- **The weekly schedule is on** (12 Sept, morning). GitHub wouldn't let me add
  the schedule file, because automation files need a "workflow" permission my
  saved login doesn't have. So you added
  [`.github/workflows/catalog-refresh.yml`](.github/workflows/catalog-refresh.yml)
  on GitHub yourself.
  - Its first test run passed in 19 seconds: *"Loaded release: 2026-08-19.0
    (2821 businesses listed) · Newest published: 2026-08-19.0 · Up to date:
    nothing newer to load."*
  - It now runs every Monday at 05:17 Montreal time. You can also start it by
    hand under **Actions → Refresh business list → Run workflow**.
  - A change to this file has to be made on GitHub the same way, until the
    saved login is given the permission.

### Part 2 — the live site is hardened · done, one migration for you

- **A sign-in limit that holds on Vercel.** Failed attempts are counted in a
  new Supabase table, `auth_attempts`: 8 failures from one visitor, or 40
  from everyone, within 15 minutes pauses sign-in. It stores a keyed hash of
  the visitor's address (never the address, never a password), clears a
  visitor's count when they sign in, and prunes itself daily. The address is
  read from Vercel's own `x-real-ip` header.
  - **Until you run the migration**, and whenever Supabase is unreachable, it
    falls back to the old in-memory limit, so it never locks you out. Tested
    live tonight: a wrong password says "Incorrect password", and the right
    one signs in.
  - Migration: `supabase/migrations/20260913000000_create_auth_attempts.sql`
    (RLS on, no policies, the server may only insert, read and delete).
    **Applied by you on 12 Sept**; the table is confirmed readable by the
    server, so the shared limit is now in force.
- **`PGRST303` explained and fixed.** The full error is *"JWT issued at
  future"*. Supabase's gateway turns the secret key into a short-lived token
  for each request, and its clock sometimes runs slightly ahead of the
  database API's, which then refuses the token. Not our bug and not your key.
  That exact response is now retried once after a second, in the one place
  every Supabase request passes through (`src/server/supabase/clock-skew.ts`,
  5 tests); every other error still fails immediately.
- **Browser protections, checked on the live site:** no framing by other sites
  (your design grid still works), no MIME guessing, a strict referrer policy
  (none at all from share links, whose URL is the key), camera, microphone,
  location, payment and USB refused, HTTPS enforced, and `noindex` on every
  page including the login.
- The live Businesses page now shows **2,821** businesses: the 18 junk entries
  are hidden.

### Part 3 — a calmer interface · done

Same colours and components; less on screen at once. Nothing was removed
that isn't still one click away. Page heights at desktop width, before → after:

| Page | Before | After |
|---|---|---|
| Lead page, fully worked (St-Viateur Bagel) | 4,233 px | **1,760 px** (−58%) |
| Lead page, new lead | 3,107 px | **1,371 px** (−56%) |
| Businesses | 3,751 px | **3,292 px** (24 cards) |
| Dashboard | 984 px | **900 px** |

- **Lead page.**
  - One header card: name, trade · area, status, priority, then phone
    (formatted, tap to call), address (with a Google Maps link), website and
    reputation, each shown once.
  - The "Not listed means the listing doesn't say" caution is said once, under
    those facts.
  - A **"Next:" button** points at the next useful step (research → strategy
    → demo → first message → record the conversation), chosen only from what
    exists.
  - Sections now follow the work: **Research → Website strategy → Demo
    website → Outreach**.
  - Research shows what research *added*. The facts that only repeat the
    listing, and the full source list, are folded under "Sources".
  - The strategy shows its summary, the opportunity and the positioning. The
    rest is under "Show the full strategy".
  - Priority breakdown, opening hours, IDs and fetch times are under "Record
    details" at the bottom. The OpenStreetMap/Overture credit stays visible.
  - Big dashed "nothing yet" boxes became one line, and duplicate warnings
    were removed.
- **Dashboard.**
  - Opens on **Next up**: your new leads, highest priority first, with one
    click each.
  - Beside it, **Your leads** gives the counts and the priority spread.
  - Then the search box with trades, where the four tiles are now one line
    ("2,821 businesses · 1,165 with no website listed · updated …").
  - The system settings row is now a footer.
- **Businesses page.**
  - The four tiles are gone; each number is one filter away.
  - The filter bar is two rows instead of five: search, trades, then area,
    order, leads and toggles on one line.
  - **The whole card opens the business.** Its only button is **Add to
    leads**, with a small Google Maps link. The site preview is on the
    business's page.
- **Everywhere.**
  - The greyed-out "SOON" menu items are hidden.
  - Phone numbers are formatted in the leads list and outreach contacts too.
    Research keeps each value exactly as its source stated it, because that
    is evidence.
- **Checked:**
  - Light and dark mode, 1440px and 400px wide, with no sideways scrolling.
  - No console errors on any page.
  - A click anywhere on a business card opens it, while Add and Maps still get
    their own clicks.
  - All 2,103 tests pass.

---

## Google Maps check — 12 September, afternoon

**Your request:** "our data of businesses are too much … businesses that might not
be real or don't even have a google map. Check every business and make sure it
has a valid google map location."

**Your answers:** use the Google Places API · hide failing businesses but keep
them in the database · remove failing leads from the list.

### Result

| | Businesses | What happens |
|---|---|---|
| Found on Google Maps at our address | 1,939 | shown |
| Similar place found, not sure it's the same | 224 | shown (kept on purpose) |
| Not found on Google Maps | 579 | **hidden**, kept in the database |
| Permanently closed on Google Maps | 79 | **hidden**, kept in the database |

- The Businesses page now shows **2,163** businesses (was 2,821). A line at
  the bottom says how many are hidden and why, and each hidden business's
  own page says "Not found on Google Maps" or "Closed on Google Maps".
- **Leads:** 11 of 12 pass. **Verdure Chic** is permanently closed on Google
  Maps, so it was **removed from your leads**. It isn't deleted: its page
  says why and has a **"Put back on my list"** button, and its research and
  demos are kept.
- **Cost: $0.** 3,845 lookups this month, under the 4,500 cap the code
  enforces (Google's free amount is 5,000). Every lookup is counted in the
  database *before* it is made.

### How a business is judged

Google always answers with *something* — ask for a salon that closed and it
returns the one next door. So a result only counts if **the name matches**
(on its distinctive words; every salon shares "salon" and "coiffure") **and it
is where we have it**, with more distance allowed the closer the names agree.
Anything not found gets a second, name-only search, because a query with a
street address sometimes returns the address itself instead of the shop.
When it can't decide (for example the same name at another address, where
our address may be old), it answers "uncertain" and **keeps the business
visible**.

I checked the matching by hand on samples and fixed three things along the way:
- a salon with the same name 800 m up the street ("MTL Tattoo");
- the city word being part of the name ("Yumi Lashes Montréal" /
  "YUMI Lashes MTL");
- neighbouring door numbers (3339 vs 3337 Jean-Talon).

Among the hidden, many list a website of their own. I looked at a sample:
Google really has nothing at that address. These are chains that left
(Concept Elite, Spa Eastman) or salons that closed, and the website is just
old data.

### Place IDs · done

My first migration had a mistake: a pattern Postgres refuses (`{10,300}`; its
limit is 255). It only failed once a real Google place ID was saved, so the
verdicts were first stored without place IDs. You ran the fix migration
([`20260914000100_fix_google_place_id_check.sql`](supabase/migrations/20260914000100_fix_google_place_id_check.sql)),
and I copied the IDs in from the run files with no new Google lookups:
**2,018 place IDs**, one for every verified or closed business. The "Google
Maps" links now open each business's exact listing (checked on the live
site). A new test rejects that kind of pattern in any migration.

### Doing it again

`scripts/catalog-google-check.mts` checks every business that hasn't been
checked yet (new ones from the weekly refresh, for example):
`npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-google-check.mts --commit`.
Add `--leads --remove-leads` to include your leads. The monthly cap stops it
before it could cost anything.
