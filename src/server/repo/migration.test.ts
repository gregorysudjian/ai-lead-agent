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
