-- Stop FUTURE tables in schema public from inheriting API-role privileges.
--
-- THE PROBLEM
--
-- Live inspection of pg_default_acl for grantor `postgres`, schema `public`:
--
--   tables:    postgres=arwdDxtm/postgres | anon=Dxtm/postgres
--              | authenticated=Dxtm/postgres | service_role=Dxtm/postgres
--   sequences: postgres=rwU/postgres
--   functions: postgres=X/postgres
--
-- So every NEW table created by our migration role automatically grants
-- `Dxtm` -- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN -- to anon,
-- authenticated and service_role, before any migration says a word about
-- permissions. That is exactly the over-grant we had to strip from
-- public.leads in 20260906120000, and without this it would silently recur on
-- every table we ever add.
--
-- SCOPE AND ROLE CHOICE
--
-- Our migrations run as `postgres` (verified: current_user = session_user =
-- postgres, is_superuser = off; public.leads is owned by postgres and its ACL
-- entries are granted by postgres). So the defaults that matter to us are the
-- ones owned by `postgres`.
--
-- A separate set of defaults owned by `supabase_admin` grants full `arwdDxtm`
-- to the same roles, but those apply only to objects created BY supabase_admin
-- -- Supabase's own internal objects, not ours. Touching them could affect
-- managed functionality, so they are deliberately left alone.
--
-- This changes NO existing object. ALTER DEFAULT PRIVILEGES applies only to
-- objects created after it runs; public.leads and its 95 rows are unaffected.

-- Future tables: no automatic privileges for any API-facing role.
--
-- REVOKE ALL rather than revoking the current `Dxtm` set specifically. The goal
-- is future-proof least privilege: if Postgres or Supabase ever widens what a
-- default grant includes, this still yields zero.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

-- Future sequences: currently a NO-OP -- the live default ACL grants sequence
-- access to `postgres` only (`postgres=rwU/postgres`), and these three roles
-- receive nothing. Stated explicitly anyway so the intent survives if that
-- default is ever widened, and so a future identity column cannot quietly hand
-- out sequence access.
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- THE RESULTING CONTRACT for every new table we create in public:
--   1. no role gets anything automatically
--   2. the table's own migration enables RLS and declares its policies
--   3. the table's own migration grants only the privileges its repository
--      actually uses -- which need not be the same CRUD set leads uses
