-- Website-strategy analyses for leads.
--
-- One lead may have many analyses over time; each row is one run. The lead
-- itself is untouched by this feature -- an analysis references it and never
-- copies its identity.
--
-- The analysis document is stored as a single jsonb column. Its internal shape
-- (facts vs recommendations) is the application's concern and is validated on
-- read; the database's job is identity, ordering, referential integrity and
-- access control.
--
-- SECURITY, declared explicitly as CLAUDE.md requires. Nothing here relies on
-- default privileges -- and as of 20260906130000 new tables in this schema
-- inherit none anyway.

create table public.lead_analyses (
  id uuid primary key,

  -- Cascade: an analysis is meaningless without its lead, and deleting a lead
  -- should not strand rows. This is the only coupling to public.leads.
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- Only successful runs are persisted; a failed run is reported, not stored.
  status text not null constraint lead_analyses_status_check check (status in ('complete')),

  created_at timestamptz not null,
  updated_at timestamptz not null,

  -- Which analyser produced this, so an old row stays interpretable after the
  -- provider changes.
  provider_name text not null,
  provider_model text not null,

  -- facts + recommendations + assumptions + limitations.
  analysis jsonb not null
);

-- The dominant read is "latest analysis for this lead", plus "all analyses for
-- this lead, newest first". One composite index serves both.
create index lead_analyses_lead_id_created_at_idx
  on public.lead_analyses (lead_id, created_at desc);

-- ---- Security ------------------------------------------------------------
--
-- Browser-facing roles get nothing. Explicit even though this schema's default
-- privileges now grant nothing, so the intent is stated rather than inherited.
revoke all on table public.lead_analyses from anon, authenticated;

-- service_role receives ONLY what AnalysisRepository actually performs:
-- create an analysis (INSERT) and read analyses (SELECT).
--
-- Deliberately NARROWER than public.leads, which also needs UPDATE and DELETE.
-- Analyses are append-only in this design: a re-analysis creates a new row
-- rather than editing an old one, so the repository never updates or deletes,
-- and therefore is not granted the ability to.
grant select, insert on table public.lead_analyses to service_role;

-- No sequence grant: `id` is an application-generated UUID and the table has no
-- serial or identity column.

-- RLS enabled with NO policies. With RLS on and no policy, anon and
-- authenticated can read and write nothing even if a table grant were ever
-- added by mistake. service_role bypasses RLS, which is why its access is
-- governed by the explicit grant above.
alter table public.lead_analyses enable row level security;
