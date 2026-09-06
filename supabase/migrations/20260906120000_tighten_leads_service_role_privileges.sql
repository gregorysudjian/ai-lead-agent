-- Tighten service_role privileges on public.leads to exactly the four verbs
-- the application uses.
--
-- WHY THIS IS NEEDED
--
-- Live inspection after the first migration showed:
--
--   relacl = postgres=arwdDxtm/postgres | service_role=arwdDxtm/postgres
--
-- so service_role held TRUNCATE, REFERENCES, TRIGGER (and MAINTAIN) in addition
-- to the intended CRUD. Two sources combined to produce that:
--
--   1. `ALTER DEFAULT PRIVILEGES` for schema public, owned by `postgres`, grants
--      `Dxtm` to anon, authenticated and service_role for every new table. Our
--      first migration runs as postgres, so the table picked this up at CREATE.
--   2. The first migration then explicitly granted SELECT/INSERT/UPDATE/DELETE
--      (`arwd`) to service_role.
--
-- Together: `arwdDxtm`.
--
-- These are DIRECT entries in the table's ACL, not inherited: pg_auth_members
-- shows service_role is a member of no role, it is not the table owner
-- (postgres is), and rolsuper = false. A plain REVOKE on the table is therefore
-- sufficient and correct -- no broader Supabase role needs to change.
--
-- Note: service_role has rolbypassrls = true. That is by design and unrelated;
-- RLS bypass does not grant table privileges, which is exactly why the explicit
-- CRUD grant below is still required for the server-side client to work.

-- Clear every direct privilege, including the Dxtm inherited from default
-- privileges at CREATE time, then re-grant only what the application uses.
revoke all on table public.leads from service_role;

grant select, insert, update, delete on table public.leads to service_role;

-- Deliberately NOT touched:
--   * anon and authenticated -- already hold nothing (the first migration
--     revoked the `Dxtm` they would otherwise have received). Re-revoking here
--     would be a no-op, and leaving them alone keeps this migration's blast
--     radius to a single role.
--   * Row Level Security -- stays enabled with zero policies.
--   * Schema, columns, indexes and data -- untouched.
--
-- Scope note: this fixes public.leads only. The schema-level default privileges
-- that caused it still apply to any FUTURE table created in public, so a new
-- table would need the same treatment (or a change to the defaults themselves,
-- which is a broader decision than this migration should make).
