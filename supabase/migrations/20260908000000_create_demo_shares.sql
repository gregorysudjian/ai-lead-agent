-- Permission to view one demo site without a session.
--
-- WHY THIS TABLE EXISTS. public.demo_sites is reachable only by the operator,
-- because /demos/[id] previously claimed privacy it did not have and was put
-- behind the session. That fixed the lie and created a real problem: a demo is
-- the strongest thing in a pitch and could no longer be shown to the business
-- it was made for. A share is the deliberate version of what an unguessable
-- URL was pretending to be.
--
-- A share is its own row rather than a column on demo_sites. One demo can be
-- shared, revoked, and shared again to someone else, and the record of each act
-- has to outlive the act -- the same reason lead_analyses is not a column on
-- leads. Nothing in this migration alters public.demo_sites.
--
-- Append-mostly: revoking sets revoked_at rather than deleting the row, because
-- "what did we show them, and when" is exactly what a later conversation needs.
--
-- No markup and no payload. This table stores identity, a secret, three
-- timestamps and one operator note. The demo itself stays in demo_sites.
--
-- STRICT, like every migration here: no IF NOT EXISTS guards. An unexpected
-- pre-existing table must fail loudly rather than be silently adapted to, so
-- re-running this on a database that already has the table is an error you
-- see. `migration.test.ts` enforces that across every file in this directory.
--
-- The final NOTIFY is not optional. PostgREST serves the REST API from a
-- schema cache built at start up, so a table created without it exists in the
-- database and is still reported to the application as
-- "PGRST205: could not find the table" -- indistinguishable from a migration
-- that never ran. Omitting it cost a debugging session.
--
-- SECURITY, declared explicitly as CLAUDE.md requires. Nothing here relies on
-- default privileges, even though 20260906130000 already revoked them.

create table public.demo_shares (
  id uuid primary key,

  -- Cascade: a share grants access to one demo, and a share pointing at a
  -- deleted demo is not a record worth keeping -- it could never be honoured
  -- and could never be explained.
  demo_id uuid not null references public.demo_sites (id) on delete cascade,

  -- The secret in the URL. Application-generated from a CSPRNG, never derived
  -- from demo_id: an id that is hard to guess is not an access control, and a
  -- secret issued on purpose is. UNIQUE so a collision is a database error
  -- rather than two businesses quietly sharing one link.
  token text not null constraint demo_shares_token_unique unique
    constraint demo_shares_token_length check (char_length(token) between 32 and 128),

  created_at timestamptz not null,

  -- Always set. There is no perpetual link: one that outlives the conversation
  -- it was made for is one nobody remembers to revoke. The application clamps
  -- the range; this only refuses a share that was already dead on arrival.
  expires_at timestamptz not null
    constraint demo_shares_expires_after_created check (expires_at > created_at),

  -- Null while live. Set once, when the operator withdraws the link.
  revoked_at timestamptz,

  -- The operator's own note about why this was shared. Never shown to the
  -- recipient; it exists so a follow-up three weeks later has context.
  note text
);

-- "Shares for this demo, newest first" -- the operator's view of what has been
-- handed out for one business, and whether any of it is still live.
create index demo_shares_demo_id_created_at_idx
  on public.demo_shares (demo_id, created_at desc);

-- The unique constraint on token already provides the index the public lookup
-- needs, so no second index is created for it.

-- ---- Security ------------------------------------------------------------
--
-- Start from nothing for every API-facing role, including service_role, rather
-- than trusting what this table may have inherited at creation time.
revoke all on table public.demo_shares from anon, authenticated, service_role;

-- service_role receives ONLY what DemoShareRepository performs: create a share
-- (INSERT), resolve a token and list a demo's shares (SELECT), and revoke
-- (UPDATE).
--
-- UPDATE is granted here where demo_sites deliberately does not have it. That
-- is the one real difference between the two tables and it is not incidental:
-- revocation must change an existing row, and expressing it as a delete would
-- destroy the record of what was shared. The repository updates exactly one
-- column, revoked_at, and never rewrites a token or an expiry -- a link cannot
-- be quietly extended or repointed at a different demo after the fact.
--
-- No DELETE. A share is never removed; rows disappear only when their demo
-- does, through the cascade above.
grant select, insert, update on table public.demo_shares to service_role;

-- No sequence grant: `id` is an application-generated UUID and the table has no
-- serial or identity column.

-- RLS enabled with NO policies. anon and authenticated can read and write
-- nothing even if a table grant were ever added by mistake -- which matters
-- more here than anywhere else in the schema, because this is the one table
-- whose contents gate an UNAUTHENTICATED route. The public page reaches this
-- data only through the server, as service_role, after the application has
-- checked the share is neither expired nor revoked.
alter table public.demo_shares enable row level security;

-- ---- Make the API see it -------------------------------------------------
--
-- PostgREST answers every REST request from a schema cache it built at start
-- up. A table created without telling it to reload EXISTS in the database and
-- is still reported to the application as
--
--   PGRST205: Could not find the table 'public.demo_shares' in the schema cache
--
-- which reads exactly like the migration never ran. This is the statement that
-- makes the difference, and it is why this file ends here rather than at the
-- RLS line above.
notify pgrst, 'reload schema';
