-- Sourced research records for leads.
--
-- The evidence layer of the pipeline:
--
--   leads -> business_profiles -> lead_analyses -> demo_sites
--
-- A lead may be researched many times; each run is one immutable row. Nothing
-- in public.leads, public.lead_analyses or public.demo_sites is altered by this
-- migration, and no existing behaviour depends on this table yet.
--
-- The profile document is a single jsonb column holding four subtrees:
--   sources      every source consulted, each with an id
--   facts        observations, each naming one of those source ids
--   coverage     which research areas were looked at, and which were not
--   limitations  what this run could not establish
--
-- The database's job is identity, ordering, referential integrity and access
-- control. That every fact names a real source is checked by the application on
-- every read, because jsonb guarantees only that a value is JSON.
--
-- No markup, no stylesheet and no script is stored. The only URLs are ones a
-- source was observed to contain, and they are validated as absolute http(s)
-- before a row can be written or read.
--
-- SECURITY, declared explicitly as CLAUDE.md requires. Nothing here relies on
-- default privileges, even though 20260906130000 already revoked them.

create table public.business_profiles (
  id uuid primary key,

  -- Cascade: a profile describes exactly one business, and deleting a lead
  -- must not strand evidence about it.
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- Only completed runs are persisted; a failed run is reported, not stored.
  status text not null constraint business_profiles_status_check check (status in ('complete')),

  created_at timestamptz not null,
  updated_at timestamptz not null,

  -- Which researcher produced this, so an old row stays interpretable after
  -- the research sources change.
  researcher_name text not null,
  researcher_version text not null,

  -- sources + facts + coverage + limitations.
  profile jsonb not null
);

-- "Profiles for this lead, newest first", and its head, "the latest profile
-- for this lead". One composite index serves both.
create index business_profiles_lead_id_created_at_idx
  on public.business_profiles (lead_id, created_at desc);

-- Recent research across every lead, for a future review queue.
create index business_profiles_created_at_idx
  on public.business_profiles (created_at desc);

-- ---- Security ------------------------------------------------------------
--
-- Start from nothing for every API-facing role, including service_role, rather
-- than trusting what this table may have inherited at creation time.
revoke all on table public.business_profiles from anon, authenticated, service_role;

-- service_role receives ONLY what BusinessProfileRepository performs: record a
-- research run (INSERT) and read profiles (SELECT).
--
-- Append-only by design. A profile is the evidence a later conversation with a
-- business owner rests on, so being able to say "this is what we held on this
-- date, and this is where each part came from" requires that no row was ever
-- quietly edited. The repository therefore never updates or deletes, and is
-- not granted the ability to.
grant select, insert on table public.business_profiles to service_role;

-- No sequence grant: `id` is an application-generated UUID and the table has no
-- serial or identity column.

-- RLS enabled with NO policies. With RLS on and no policy, anon and
-- authenticated can read and write nothing even if a table grant were ever
-- added by mistake. service_role bypasses RLS, which is why its access is
-- governed by the explicit grant above.
alter table public.business_profiles enable row level security;
