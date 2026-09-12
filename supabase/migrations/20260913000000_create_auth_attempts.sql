-- One row per FAILED sign-in attempt.
--
-- WHY THIS TABLE EXISTS. The app is public on Vercel, and its one password is
-- the only lock. A limit on guessing that lives in a server's memory does not
-- hold there: each request may land on a different, freshly started server,
-- so every server starts counting from zero. Counting failures here means
-- every server sees the same count.
--
-- WHAT IS STORED. Not the address. `identity` is a keyed hash (HMAC with the
-- session secret) of the visitor's network address: enough to count repeated
-- failures from one place, not enough to say where that place is. No password,
-- right or wrong, is ever stored.
--
-- RETENTION. Rows older than a day are deleted by the application on each new
-- failure; a successful sign-in deletes that visitor's rows.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards.
--
-- SECURITY, declared explicitly as CLAUDE.md requires.

create table public.auth_attempts (
  id uuid primary key default gen_random_uuid(),

  -- HMAC-SHA256 of the client address, hex.
  identity text not null
    constraint auth_attempts_identity_shape check (identity ~ '^[0-9a-f]{64}$'),

  attempted_at timestamptz not null default now()
);

-- "Failures from this visitor since T", and "all failures since T".
create index auth_attempts_identity_time_idx
  on public.auth_attempts (identity, attempted_at desc);
create index auth_attempts_time_idx
  on public.auth_attempts (attempted_at desc);

-- ---- Security ------------------------------------------------------------
revoke all on table public.auth_attempts from anon, authenticated, service_role;

-- service_role: record a failure (INSERT), count recent failures (SELECT),
-- clear them on success and prune old ones (DELETE). No UPDATE: a recorded
-- failure is never edited.
grant select, insert, delete on table public.auth_attempts to service_role;

alter table public.auth_attempts enable row level security;

notify pgrst, 'reload schema';
