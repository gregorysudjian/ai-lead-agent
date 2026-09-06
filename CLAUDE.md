# CLAUDE.md

Long-term instructions for this project. Read this before making changes.

## What this project is

An AI-assisted lead generation system for a web design business. It discovers
local businesses via legitimate APIs, stores them as leads, identifies which
ones lack a website, ranks them, and helps generate personalized copy and demo
websites. A human reviews and approves everything before any outreach.

Example use: search "Hair salons in Montreal" -> get businesses with name,
category, address, phone, website (if any), rating, review count, opening
hours, and place ID -> flag the ones with no website.

## Hard rules (never violate)

1. **Never contact businesses automatically.** No email, SMS, form-fill, or
   any outbound message is ever sent by code. Outreach drafts are generated and
   stored for manual human review only. There is no "send" implementation.
2. **No scraping that violates terms of service.** Prefer official APIs
   (Google Places). Do not scrape Google search results or Maps HTML. Fetching
   a business's own public homepage to check that it exists/responds is
   acceptable; honor robots.txt, identify with a User-Agent, and rate-limit.
3. **Never expose API keys to the browser.** All third-party API calls happen
   server-side (Route Handlers / Server Actions). Never prefix a secret with
   `NEXT_PUBLIC_`.
4. **Secrets come from environment variables only.** No credentials in source,
   no credentials in git. `.env.local` is gitignored; `.env.example` is
   committed with empty placeholder values.
5. **No paid services connected without explicit approval.** Google Places,
   Anthropic API, and hosted Supabase stay behind provider interfaces with mock
   implementations until the user says otherwise.
6. **Follow Google Maps Platform policy for Places data.** When the real Google
   Places provider is implemented, look up the then-current Google Maps
   Platform storage and caching policies and follow them per content type --
   different fields carry different rules, and the rules change. Do not assume
   a fixed retention window from memory. Place IDs may be stored as permitted
   by those policies. Every record stores a `fetched_at` timestamp, and
   provider-sourced fields are treated as a refreshable cache kept separate
   from our own durable data (notes, status, approvals, generated copy).
7. **Do not overstate provider data.** A missing website from a discovery
   provider means "no website found or listed by that provider" -- not
   "confirmed to have no website." The UI, scoring, and any generated copy
   must preserve that distinction unless a later verification step actually
   confirms it. The same caution applies to every other absent field.

## Working agreement

- The user is learning while building. Explain architectural decisions briefly
  before implementing; don't dump large amounts of unexplained code.
- Build incrementally. One phase at a time, verified working before the next.
- Show a plan before making major structural changes.
- Prefer boring, readable solutions over clever ones. One developer maintains
  this.

## Tech stack

- **TypeScript everywhere.** `strict: true`. No `any` without a comment saying
  why.
- **Next.js (App Router)** — one deployable containing both UI and backend.
- **Tailwind CSS** for styling.
- **Data:** JSON file store behind a repository interface for local
  development; Supabase / PostgreSQL before deployment.
- **Deployment target:** Vercel (later).
- **Package manager:** npm.

## Architecture principles

- **Provider interfaces for every external dependency.** Business discovery
  (`PlacesProvider`) and AI (`AiProvider`) are interfaces with a mock
  implementation and a real implementation. The app selects one via an env var.
  This lets the whole pipeline be built and tested with zero API spend.
- **Repository interface for persistence.** UI and API routes never talk to a
  database driver directly; they call `LeadRepository`. Swapping the backing
  store touches one file.
- **The JSON `LeadRepository` is development-only.** It exists for local
  development and the mock-data phases. It is not production persistence: a
  JSON file on disk has no concurrency control, no integrity guarantees, and
  does not survive on Vercel's ephemeral filesystem. Persistent lead data must
  move to Supabase/PostgreSQL (or another real database) before deployment.
- **Scoring is deterministic, not AI.** Lead ranking is a pure, unit-tested
  function of known fields (has website, review count, rating, has phone). AI
  is used for qualitative analysis and copy generation only, never for ranking
  math.
- **Deduplication uses Place ID as the primary external identifier, with a
  normalized name+address match as a required secondary strategy.** Place IDs
  are stable in practice but are not guaranteed permanent -- Google can retire
  or replace them, and a business can be re-listed under a new one. So: store
  the Place ID as an external reference, never as our own primary key; give
  each lead an internal ID that never changes; keep the name+address match to
  catch a business that reappears under a different Place ID; and make the
  Place ID field refreshable/replaceable without rewriting the lead's history.
- **A lead keeps application-owned data and provider data structurally apart.**
  `Lead` holds what we own at the top level (`id`, `status`, `createdAt`,
  `updatedAt`) and the provider's latest snapshot under `lead.provider`.
  Rediscovery replaces the `provider` subtree wholesale, so our fields survive
  by construction rather than by remembering to preserve them, and the caching
  policy above applies to exactly one subtree. Do not flatten this.

- **OpenStreetMap data carries its provenance and attribution.** OSM-derived
  records keep `source: "osm"`, and any view showing them must credit
  OpenStreetMap with a link to openstreetmap.org/copyright and make the ODbL
  clear. Never present OSM data as though it came from another provider.
- **Public Overpass is shared community infrastructure, not our capacity.** The
  endpoint stays configurable (`OVERPASS_API_URL`), queries are bounded to one
  registry-defined area and category, and requests happen only in response to an
  explicit user search -- no crawling, polling, background refresh or retry
  loops. Public Nominatim is not part of the discovery pipeline; cities resolve
  through a curated registry instead.
- **User input never becomes provider query syntax.** Cities and categories are
  resolved against curated registries first, and unsupported values are rejected
  before any network call. Only registry-derived tokens reach a query.
- **Raw provider payloads are not persisted.** Provider responses pass through a
  pure normalization layer, and only the normalized domain fields are stored --
  never the upstream tag or record object.

- **Lead priority is deterministic, derived, and provider-independent.** It is
  computed from the current provider snapshot by a pure function, never
  persisted, never AI-generated, and never influenced by application-owned
  fields such as `status`. The provider `source` itself awards zero points: the
  same field values must score identically whoever supplied them. Weights sit on
  signals every provider can supply, with reputation as a bonus a richer
  provider may add -- never rescale one provider's reachable maximum to 100,
  which would make a score built on less evidence look equal to one built on
  more. A score is a review-order hint, not a prediction of purchase and not
  evidence about whether a business has a website.
- **Provider search metadata is request-level and never persisted.** Facts about
  a search -- whether it was capped, what the limit was -- belong to that
  request, not to any lead. A capped result must be reported as capped rather
  than silently looking complete.
- **Provider subtype tags outrank the user's search label.** When provider data
  itself identifies a more specific category, that wins over whichever
  overlapping search happened to find it, so a rediscovery cannot flip a stored
  category back and forth.

- **Every new table in `public` declares its own security explicitly.** A
  migration that creates an application-owned table must state, in that same
  migration: whether RLS is enabled, which policies exist (if any), and what
  `anon`, `authenticated` and `service_role` may each do. Never rely on
  Supabase or Postgres default privileges -- they have granted API roles
  unrequested access before, and the schema defaults for objects created by
  other roles still do. Grant only the operations that table's repository
  actually performs; that need not be the same set another table uses. For the
  current server-only pattern that means: RLS enabled, zero policies,
  `anon`/`authenticated` no access, and `service_role` limited to the verbs in
  use.

- **Server Components read the repository; Client Components call the API.**
  A page renders by calling `getLeadRepository()` directly -- never by fetching
  its own API over HTTP, which is a pointless round trip to the same process.
  Interactivity (search, filters, status changes) lives in small Client
  Components that POST/PATCH to a route handler and then call
  `router.refresh()`, so the server stays the source of truth and the UI never
  shows a state the store has not confirmed. Do not make the page one large
  Client Component.

- **Server-only modules are enforced, not just conventional.** Any module that
  reads environment variables or secrets, talks to a database, or calls a
  third-party server API imports the `server-only` package at the top. That
  turns an accidental import from a Client Component into a build error. The
  `src/server/` folder is an organizational convention on top of that
  enforcement -- the folder name alone is not a security boundary.

## Conventions

- Path alias `@/*` -> `src/*`.
- Domain types live in `src/lib/types.ts` and are the shared contract between
  layers.
- Route handlers validate input with Zod before using it.
- Errors returned to the client are generic; details are logged server-side.
  Never leak provider error bodies (they can contain keys or quota info).
- Commit messages: short imperative subject line.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint

## Next.js version notes

@AGENTS.md
