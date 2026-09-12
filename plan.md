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

## Results

*Filled in as I go, newest last.*
