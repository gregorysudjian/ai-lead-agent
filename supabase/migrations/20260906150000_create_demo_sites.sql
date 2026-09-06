-- Generated demo websites for leads.
--
-- The third link in the chain: a lead may be analysed many times, and each
-- analysis may be turned into a demo site many times. Every generation is one
-- immutable row, so a demo that was shown to a prospect stays exactly as it
-- was. Neither public.leads nor public.lead_analyses is altered by this
-- migration.
--
-- The spec is stored as a single jsonb document with two subtrees:
--   business  application-owned facts copied from the lead snapshot
--   content   generator-owned wording, structure and theme
-- The database's job is identity, ordering, referential integrity and access
-- control; the document's internal shape is validated by the application on
-- every read, because jsonb guarantees only that a value is JSON.
--
-- No markup is stored. There is no column, and no field inside the document,
-- that holds HTML, a stylesheet, a script or a URL.
--
-- SECURITY, declared explicitly as CLAUDE.md requires. Nothing here relies on
-- default privileges, even though 20260906130000 already revoked them.

create table public.demo_sites (
  id uuid primary key,

  -- Cascade: a demo site is meaningless without the business it proposes a
  -- site for, and deleting a lead must not strand rows.
  lead_id uuid not null references public.leads (id) on delete cascade,

  -- Cascade as well, for the same reason: a demo records which analysis shaped
  -- it, and an orphaned demo could no longer be explained or regenerated.
  -- RESTRICT was considered and rejected -- lead_analyses itself cascades from
  -- leads, so restricting here would block a lead deletion that the lead
  -- repository is granted to perform, turning a documented delete into a
  -- foreign-key error instead.
  analysis_id uuid not null references public.lead_analyses (id) on delete cascade,

  -- Only successful generations are persisted; a failure is reported, not stored.
  status text not null constraint demo_sites_status_check check (status in ('generated')),

  created_at timestamptz not null,
  updated_at timestamptz not null,

  -- Which generator produced this, so an old row stays interpretable after the
  -- generator changes.
  generator_name text not null,
  generator_model text not null,

  -- business + content.
  spec jsonb not null
);

-- "Demos for this lead, newest first", and its head, "the latest demo for this
-- lead". One composite index serves both.
create index demo_sites_lead_id_created_at_idx
  on public.demo_sites (lead_id, created_at desc);

-- "Demos generated from this analysis, newest first" -- used to show which
-- analysis a demo came from and how many times it has been regenerated.
create index demo_sites_analysis_id_created_at_idx
  on public.demo_sites (analysis_id, created_at desc);

-- The /demos overview lists every stored demo, newest first, across all leads.
create index demo_sites_created_at_idx
  on public.demo_sites (created_at desc);

-- ---- Security ------------------------------------------------------------
--
-- Start from nothing for every API-facing role, including service_role, rather
-- than trusting what this table may have inherited at creation time.
revoke all on table public.demo_sites from anon, authenticated, service_role;

-- service_role receives ONLY what DemoSiteRepository actually performs:
-- generate a demo (INSERT) and read demos (SELECT).
--
-- Append-only by design, like lead_analyses: regenerating writes a new row
-- rather than editing an old one, so the repository never updates or deletes,
-- and therefore is not granted the ability to. Narrower than public.leads,
-- which genuinely needs UPDATE and DELETE.
grant select, insert on table public.demo_sites to service_role;

-- No sequence grant: `id` is an application-generated UUID and the table has no
-- serial or identity column.

-- RLS enabled with NO policies. With RLS on and no policy, anon and
-- authenticated can read and write nothing even if a table grant were ever
-- added by mistake. service_role bypasses RLS, which is why its access is
-- governed by the explicit grant above.
alter table public.demo_sites enable row level security;
