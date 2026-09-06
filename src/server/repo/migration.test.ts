import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Migration security regression test.
 *
 * Reads the SQL from disk and asserts the intended security properties. It does
 * NOT connect to Supabase -- the point is to catch a dangerous edit in review,
 * before anything is applied to a real database.
 *
 * The properties checked here are the ones whose absence is silent and costly:
 * a stray policy, a grant to a browser-facing role, or RLS quietly dropped.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function migrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  expect(files.length).toBeGreaterThan(0);
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

/** Strip SQL line comments so prose about grants never satisfies an assertion. */
function statementsOnly(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n")
    .toLowerCase();
}

describe("migration security properties", () => {
  const sql = statementsOnly(migrationSql());

  it("enables Row Level Security on the leads table", () => {
    expect(sql).toContain("alter table public.leads enable row level security");
  });

  it("creates NO policies", () => {
    // A policy would open a browser-facing path and must never appear by accident.
    expect(sql).not.toContain("create policy");
  });

  it("grants service_role exactly the four CRUD verbs it needs", () => {
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.leads to service_role",
    );
  });

  it("does not grant service_role anything beyond CRUD", () => {
    for (const verb of ["truncate", "references", "trigger", "all privileges"]) {
      expect(sql).not.toContain(`grant ${verb}`);
    }
    expect(sql).not.toContain("grant all on table public.leads");
  });

  it("revokes all access from the browser-facing roles", () => {
    expect(sql).toContain("revoke all on table public.leads from anon, authenticated");
  });

  it.each([["anon"], ["authenticated"], ["public"]])(
    "never grants anything to %s",
    (role) => {
      const grants = sql.split("\n").filter((line) => line.startsWith("grant "));
      for (const grant of grants) {
        expect(grant).not.toContain(` to ${role}`);
        expect(grant).not.toContain(` to ${role},`);
      }
    },
  );

  it("grants only to service_role", () => {
    const grants = sql.split("\n").filter((line) => line.startsWith("grant "));
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) expect(grant).toContain("to service_role");
  });

  it("contains no credentials", () => {
    for (const secret of ["supabase_secret_key=", "password", "eyj"]) {
      expect(sql).not.toContain(secret);
    }
  });
});

describe("migration schema properties", () => {
  const sql = statementsOnly(migrationSql());

  it("is strict: no IF NOT EXISTS / IF EXISTS guards", () => {
    // This is the first migration and has never been applied. It must fail on an
    // unexpected pre-existing table rather than adapt to a schema we did not author.
    expect(sql).not.toContain("if not exists");
    expect(sql).not.toContain("if exists");
  });

  it("constrains status to the two application statuses", () => {
    expect(sql).toContain("check (status in ('new', 'reviewed'))");
  });

  it("creates the primary dedupe unique index", () => {
    expect(sql).toContain("create unique index leads_provider_identity_idx");
    expect(sql).toContain("(provider_source, provider_external_id)");
  });

  it("creates the secondary dedupe index as PARTIAL on a non-null address", () => {
    // Without the WHERE clause, address-less businesses sharing a name would
    // collide and be merged -- the exact false merge we refuse to allow.
    expect(sql).toContain("create unique index leads_normalized_identity_idx");
    expect(sql).toContain("where normalized_address is not null");
  });

  it("stores the provider snapshot as a single jsonb column", () => {
    expect(sql).toContain("provider jsonb not null");
  });

  it("persists no score, priority or search metadata column", () => {
    for (const forbidden of ["score", "priority", "truncated"]) {
      expect(sql).not.toContain(`${forbidden} `);
    }
  });
});

describe("service_role privileges are tightened to CRUD only", () => {
  const sql = statementsOnly(migrationSql());

  it("revokes every direct privilege from service_role before re-granting", () => {
    // Necessary because ALTER DEFAULT PRIVILEGES for schema public grants
    // `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) to service_role on every new
    // table. Granting CRUD alone would leave those extras in place.
    expect(sql).toContain("revoke all on table public.leads from service_role");
  });

  it("re-grants exactly the four verbs the application uses", () => {
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.leads to service_role",
    );
  });

  it("the revoke precedes the grant, so CRUD survives", () => {
    const revoke = sql.indexOf("revoke all on table public.leads from service_role");
    const grant = sql.lastIndexOf(
      "grant select, insert, update, delete on table public.leads to service_role",
    );
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
  });

  it("does not change anon or authenticated access to the leads TABLE", () => {
    // They already hold nothing; the leads privilege migration touches one role.
    // Scoped to direct table revokes: a separate migration legitimately revokes
    // DEFAULT privileges from all three roles at once, and that is not this rule.
    const tableRevokes = sql
      .split("\n")
      .filter((l) => l.startsWith("revoke ") && l.includes("on table public.leads"));
    expect(tableRevokes.some((r) => r.includes("service_role"))).toBe(true);
    for (const revoke of tableRevokes.filter((r) => r.includes("service_role"))) {
      expect(revoke).not.toContain("anon");
      expect(revoke).not.toContain("authenticated");
    }
  });

  it("never disables RLS or adds a policy", () => {
    expect(sql).not.toContain("disable row level security");
    expect(sql).not.toContain("create policy");
  });

  it("does not alter table data, columns or indexes", () => {
    for (const forbidden of ["drop table", "drop index", "alter column", "delete from", "truncate", "insert into"]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});

describe("future tables inherit no privileges", () => {
  const sql = statementsOnly(migrationSql());

  it("revokes default TABLE privileges from every API-facing role", () => {
    // Without this, ALTER DEFAULT PRIVILEGES for schema public silently grants
    // Dxtm (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) on every new table.
    expect(sql).toContain(
      "alter default privileges for role postgres in schema public",
    );
    expect(sql).toContain("revoke all on tables from anon, authenticated, service_role");
  });

  it("revokes default SEQUENCE privileges from the same roles", () => {
    expect(sql).toContain("revoke all on sequences from anon, authenticated, service_role");
  });

  it("uses REVOKE ALL rather than enumerating today's privilege letters", () => {
    // Future-proofing: if a default grant ever widens, ALL still yields zero.
    for (const narrow of [
      "revoke truncate on tables",
      "revoke references on tables",
      "revoke trigger on tables",
    ]) {
      expect(sql).not.toContain(narrow);
    }
  });

  it("never GRANTS a default privilege to an API role", () => {
    const defaultGrants = sql
      .split("\n")
      .filter((l) => l.includes("alter default privileges") || l.startsWith("grant "));
    for (const line of defaultGrants) {
      if (!line.includes("alter default privileges")) continue;
      expect(line).not.toContain("grant");
    }
  });

  it("does not touch defaults owned by supabase_admin or other internal roles", () => {
    // Those govern Supabase's own managed objects; changing them is out of scope.
    expect(sql).not.toContain("for role supabase_admin");
    expect(sql).not.toContain("for role supabase_auth_admin");
    expect(sql).not.toContain("for role authenticator");
  });

  it("targets only schema public", () => {
    const lines = sql.split("\n").filter((l) => l.includes("alter default privileges"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain("in schema public");
  });

  it("changes no existing object", () => {
    for (const forbidden of ["drop table", "alter table public.leads drop", "delete from", "insert into"]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});
