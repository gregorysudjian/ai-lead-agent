-- The Google Maps check: does each catalog business have a real Google Maps
-- listing?
--
-- WHY. The catalog comes from Overture's open data, and some of its places do
-- not exist, have closed, or are filed in the wrong place. The operator asked
-- for every business to be checked against Google Maps, and for the ones
-- Google cannot find to be hidden. The check is scripts/catalog-google-check.mts,
-- run by hand; the application itself never calls Google for this.
--
-- WHAT IS STORED FROM GOOGLE: ONLY THE PLACE ID. Google's terms allow a place
-- ID to be kept indefinitely, and it is what makes the "Google Maps" link open
-- the exact listing. Google's name, address, coordinates, phone, rating and
-- reviews are compared in memory during the check and never written anywhere.
-- The verdict is ours: our own conclusion about our own record.
--
-- "not_found" MEANS GOOGLE RETURNED NO MATCHING PLACE, not that the business
-- does not exist -- the same caution as "no website listed" (CLAUDE.md rule 7).
-- A hidden business keeps its row and can come back when checked again.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards.
--
-- SECURITY, declared explicitly as CLAUDE.md requires. Columns added to
-- public.businesses and public.leads change nothing about who may reach those
-- tables: both keep RLS on, no policies, no anon/authenticated access, and the
-- service_role grants they already have (UPDATE covers the new columns).

-- ---- Catalog: the check result -------------------------------------------
alter table public.businesses
  add column google_place_id text
    constraint businesses_google_place_id_shape check (google_place_id ~ '^[A-Za-z0-9_-]{10,300}$'),
  add column google_check text
    constraint businesses_google_check_values
      check (google_check in ('verified', 'not_found', 'closed', 'uncertain')),
  add column google_checked_at timestamptz,
  add constraint businesses_google_check_paired
    check ((google_check is null) = (google_checked_at is null)),
  -- A place ID is only ever recorded for a place Google actually matched.
  add constraint businesses_google_place_id_only_when_matched
    check (google_place_id is null or google_check in ('verified', 'closed', 'uncertain'));

-- ---- Leads: removed, never deleted -----------------------------------------
--
-- Deleting a lead would cascade to its research, analyses, demos and outreach
-- (every one of those tables references leads ON DELETE CASCADE). A lead the
-- operator no longer wants is therefore MARKED removed: it leaves the lead
-- list, and everything done for it stays exactly as it was.
alter table public.leads
  add column removed_at timestamptz,
  add column removed_reason text
    constraint leads_removed_reason_not_blank check (char_length(removed_reason) between 1 and 500),
  add constraint leads_removed_paired check ((removed_at is null) = (removed_reason is null));

-- ---- Google lookups: one row per billable call -----------------------------
--
-- The cost guard. Google gives a monthly free allowance per kind of lookup;
-- the check script counts this month's rows before every call and stops well
-- short of the allowance, across every run, machine and retry.
create table public.google_api_calls (
  id uuid primary key default gen_random_uuid(),
  called_at timestamptz not null default now(),
  -- Google's name for the billed kind of request.
  sku text not null
    constraint google_api_calls_sku_values check (sku in ('text_search_pro', 'text_search_ids_only'))
);

create index google_api_calls_time_idx on public.google_api_calls (called_at desc);

revoke all on table public.google_api_calls from anon, authenticated, service_role;

-- service_role: record a call (INSERT) and count this month's (SELECT). No
-- UPDATE or DELETE: the ledger is append-only, so it cannot be made to
-- under-count.
grant select, insert on table public.google_api_calls to service_role;

alter table public.google_api_calls enable row level security;

notify pgrst, 'reload schema';
