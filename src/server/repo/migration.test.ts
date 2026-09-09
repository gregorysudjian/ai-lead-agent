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
    // Applies to EVERY migration in the directory, not just the first -- this
    // assertion reads them all concatenated. A migration must fail on an
    // unexpected pre-existing table rather than adapt to a schema we did not
    // author, because "it ran and changed nothing" and "it ran and built what
    // I expected" are indistinguishable afterwards.
    //
    // The tension is real: these are applied by hand through a SQL editor, and
    // a hand-applied migration can be half-run. The answer is to fix the
    // database deliberately, not to make every migration silently tolerant.
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

describe("lead_analyses table security", () => {
  const sql = statementsOnly(migrationSql());

  it("enables RLS with no policies", () => {
    expect(sql).toContain("alter table public.lead_analyses enable row level security");
    // The file-wide "creates NO policies" test already covers policy absence.
  });

  it("revokes all access from the browser-facing roles", () => {
    expect(sql).toContain("revoke all on table public.lead_analyses from anon, authenticated");
  });

  it("grants service_role ONLY select and insert", () => {
    // Narrower than leads on purpose: analyses are append-only, so the
    // repository never updates or deletes and is not granted the ability to.
    expect(sql).toContain("grant select, insert on table public.lead_analyses to service_role");
    expect(sql).not.toContain("on table public.lead_analyses to service_role with");
    for (const verb of ["update", "delete", "truncate"]) {
      expect(sql).not.toContain(`grant select, insert, ${verb} on table public.lead_analyses`);
    }
  });

  it("never grants anything on lead_analyses to anon or authenticated", () => {
    const grants = sql.split("\n").filter((l) => l.startsWith("grant ") && l.includes("lead_analyses"));
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).toContain("to service_role");
      expect(grant).not.toContain("anon");
      expect(grant).not.toContain("authenticated");
    }
  });

  it("references leads with an ON DELETE CASCADE foreign key", () => {
    expect(sql).toContain("references public.leads (id) on delete cascade");
  });

  it("indexes the lead + recency lookup the repository performs", () => {
    expect(sql).toContain("create index lead_analyses_lead_id_created_at_idx");
    expect(sql).toContain("(lead_id, created_at desc)");
  });

  it("constrains status to the single persisted state", () => {
    expect(sql).toContain("check (status in ('complete'))");
  });

  it("does not alter or drop the leads table", () => {
    for (const forbidden of ["drop table public.leads", "alter table public.leads drop", "delete from public.leads"]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});

describe("demo_sites table security", () => {
  const sql = statementsOnly(migrationSql());

  it("enables RLS", () => {
    expect(sql).toContain("alter table public.demo_sites enable row level security");
    // The file-wide "creates NO policies" test covers policy absence, so RLS on
    // with no policy means anon and authenticated can reach nothing.
  });

  it("starts every API role from zero rather than trusting inherited defaults", () => {
    // Includes service_role deliberately: ALTER DEFAULT PRIVILEGES has granted
    // Dxtm on new tables before, and this table must not inherit it.
    expect(sql).toContain(
      "revoke all on table public.demo_sites from anon, authenticated, service_role",
    );
  });

  it("grants service_role ONLY select and insert", () => {
    expect(sql).toContain("grant select, insert on table public.demo_sites to service_role");
    for (const verb of ["update", "delete", "truncate", "references", "trigger"]) {
      expect(sql).not.toContain(`grant select, insert, ${verb} on table public.demo_sites`);
      expect(sql).not.toContain(`grant ${verb} on table public.demo_sites`);
    }
    expect(sql).not.toContain("grant all on table public.demo_sites");
  });

  it("revokes before it grants, so the grant survives", () => {
    const revoke = sql.indexOf(
      "revoke all on table public.demo_sites from anon, authenticated, service_role",
    );
    const grant = sql.indexOf("grant select, insert on table public.demo_sites to service_role");
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
  });

  it("never grants anything on demo_sites to a browser-facing role", () => {
    const grants = sql.split("\n").filter((l) => l.startsWith("grant ") && l.includes("demo_sites"));
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).toContain("to service_role");
      expect(grant).not.toContain("anon");
      expect(grant).not.toContain("authenticated");
    }
  });
});

describe("demo_sites table schema", () => {
  const sql = statementsOnly(migrationSql());

  it("references both a lead and an analysis, each cascading on delete", () => {
    expect(sql).toContain("lead_id uuid not null references public.leads (id) on delete cascade");
    expect(sql).toContain(
      "analysis_id uuid not null references public.lead_analyses (id) on delete cascade",
    );
  });

  it("constrains status to the single persisted state", () => {
    expect(sql).toContain("check (status in ('generated'))");
  });

  it("stores the spec as a single jsonb column", () => {
    expect(sql).toContain("spec jsonb not null");
  });

  it("records which generator produced the row", () => {
    expect(sql).toContain("generator_name text not null");
    expect(sql).toContain("generator_model text not null");
  });

  it("indexes the three lookups the repository performs", () => {
    expect(sql).toContain("create index demo_sites_lead_id_created_at_idx");
    expect(sql).toContain("(lead_id, created_at desc)");
    expect(sql).toContain("create index demo_sites_analysis_id_created_at_idx");
    expect(sql).toContain("(analysis_id, created_at desc)");
    expect(sql).toContain("create index demo_sites_created_at_idx");
  });

  it("stores no HTML, stylesheet or URL column", () => {
    for (const forbidden of ["html", "css", "url ", "script"]) {
      expect(sql).not.toContain(`${forbidden} text`);
    }
  });

  it("does not alter or drop leads or lead_analyses", () => {
    for (const forbidden of [
      "drop table public.leads",
      "drop table public.lead_analyses",
      "alter table public.leads drop",
      "alter table public.lead_analyses drop",
      "delete from public.leads",
      "delete from public.lead_analyses",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});

describe("business_profiles table security", () => {
  const sql = statementsOnly(migrationSql());

  it("enables RLS", () => {
    expect(sql).toContain("alter table public.business_profiles enable row level security");
    // The file-wide "creates NO policies" test covers policy absence, so RLS on
    // with no policy means anon and authenticated can reach nothing.
  });

  it("starts every API role from zero rather than trusting inherited defaults", () => {
    expect(sql).toContain(
      "revoke all on table public.business_profiles from anon, authenticated, service_role",
    );
  });

  it("grants service_role ONLY select and insert", () => {
    expect(sql).toContain("grant select, insert on table public.business_profiles to service_role");
    for (const verb of ["update", "delete", "truncate", "references", "trigger"]) {
      expect(sql).not.toContain(`grant select, insert, ${verb} on table public.business_profiles`);
      expect(sql).not.toContain(`grant ${verb} on table public.business_profiles`);
    }
    expect(sql).not.toContain("grant all on table public.business_profiles");
  });

  it("revokes before it grants, so the grant survives", () => {
    const revoke = sql.indexOf(
      "revoke all on table public.business_profiles from anon, authenticated, service_role",
    );
    const grant = sql.indexOf(
      "grant select, insert on table public.business_profiles to service_role",
    );
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
  });

  it("never grants anything on business_profiles to a browser-facing role", () => {
    const grants = sql
      .split("\n")
      .filter((l) => l.startsWith("grant ") && l.includes("business_profiles"));
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).toContain("to service_role");
      expect(grant).not.toContain("anon");
      expect(grant).not.toContain("authenticated");
    }
  });
});

describe("business_profiles table schema", () => {
  const sql = statementsOnly(migrationSql());

  it("references a lead, cascading on delete", () => {
    expect(sql).toContain("lead_id uuid not null references public.leads (id) on delete cascade");
  });

  it("constrains status to the single persisted state", () => {
    expect(sql).toContain("check (status in ('complete'))");
  });

  it("stores the profile document as a single jsonb column", () => {
    expect(sql).toContain("profile jsonb not null");
  });

  it("records which researcher produced the row", () => {
    expect(sql).toContain("researcher_name text not null");
    expect(sql).toContain("researcher_version text not null");
  });

  it("indexes the two lookups the repository performs", () => {
    expect(sql).toContain("create index business_profiles_lead_id_created_at_idx");
    expect(sql).toContain("create index business_profiles_created_at_idx");
  });

  it("stores no HTML, stylesheet or free-standing URL column", () => {
    for (const forbidden of ["html", "css", "url ", "script"]) {
      expect(sql).not.toContain(`${forbidden} text`);
    }
  });

  it("does not alter or drop any existing table", () => {
    for (const forbidden of [
      "drop table public.leads",
      "drop table public.lead_analyses",
      "drop table public.demo_sites",
      "alter table public.leads drop",
      "alter table public.lead_analyses drop",
      "alter table public.demo_sites drop",
      "delete from public.leads",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});
