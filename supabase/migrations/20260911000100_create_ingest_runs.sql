-- One row per catalog refresh.
--
-- WHY THIS TABLE EXISTS. A refresh writes thousands of catalog rows from a
-- file, unattended, and the rows themselves cannot say which extract they came
-- from, which Overture release it was, or whether the run finished. This is
-- the record of each refresh: what it read, what it changed, and how it ended.
--
-- It also makes an interrupted refresh legible. A row still in 'running' with
-- an old started_at is a run that died. Refreshing is idempotent -- the same
-- extract loaded twice refreshes rather than duplicates -- so the recovery is
-- simply to run it again, and this table is what tells you that is needed.
--
-- NOT A QUEUE. Nothing reads this table to decide what to do next; no worker
-- polls it. The scheduled refresh decides what to do by asking Overture which
-- release is current. Rows here are read by a person asking what happened.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards.
--
-- SECURITY, declared explicitly as CLAUDE.md requires.

create table public.ingest_runs (
  id uuid primary key,

  -- The dataset and published release, e.g. 'overture' / '2026-08-19.0'.
  dataset text not null
    constraint ingest_runs_dataset_not_blank check (char_length(dataset) > 0),
  release text not null
    constraint ingest_runs_release_not_blank check (char_length(release) > 0),

  -- The catalog area loaded, by registry key: 'montreal-island'.
  area text not null
    constraint ingest_runs_area_not_blank check (char_length(area) > 0),

  -- The extract read, and a checksum of its exact bytes. The path alone is
  -- not identifying: every refresh rewrites the same filename.
  source_file text not null,
  source_sha256 text not null
    constraint ingest_runs_sha256_shape check (source_sha256 ~ '^[0-9a-f]{64}$'),

  -- Records in the extract, and what the refresh decided for them. These are
  -- the counts the upsert planner reports, in the same words.
  records integer not null
    constraint ingest_runs_records_non_negative check (records >= 0),
  businesses_added integer not null default 0
    constraint ingest_runs_added_non_negative check (businesses_added >= 0),
  businesses_refreshed integer not null default 0
    constraint ingest_runs_refreshed_non_negative check (businesses_refreshed >= 0),
  records_collapsed integer not null default 0
    constraint ingest_runs_collapsed_non_negative check (records_collapsed >= 0),
  -- Records not written because they would have collided with a different
  -- stored business. Named in the run's console report.
  records_skipped integer not null default 0
    constraint ingest_runs_skipped_non_negative check (records_skipped >= 0),
  -- Catalog businesses this release no longer lists. Null until the run ends,
  -- because it can only be counted once every refresh has been written.
  businesses_unseen integer
    constraint ingest_runs_unseen_non_negative check (businesses_unseen >= 0),
  -- Existing leads connected to their catalog business during this run.
  leads_linked integer not null default 0
    constraint ingest_runs_linked_non_negative check (leads_linked >= 0),

  started_at timestamptz not null,
  -- Null while in flight. Set once, whatever the outcome.
  finished_at timestamptz,

  state text not null default 'running'
    constraint ingest_runs_state check (state in ('running', 'complete', 'failed')),

  -- A short, operator-facing summary when a run ends badly. Never a driver
  -- error body: those can carry connection details.
  detail text
);

-- "What have we loaded, most recent first" -- the only read this table serves.
create index ingest_runs_started_at_idx
  on public.ingest_runs (started_at desc);

-- ---- Security ------------------------------------------------------------
revoke all on table public.ingest_runs from anon, authenticated, service_role;

-- service_role: open a run (INSERT), advance and close it (UPDATE), read the
-- history (SELECT). No DELETE: a refresh that happened stays on the record.
grant select, insert, update on table public.ingest_runs to service_role;

alter table public.ingest_runs enable row level security;

notify pgrst, 'reload schema';
