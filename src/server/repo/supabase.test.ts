import { describe, expect, it } from "vitest";

import type { DiscoveredBusiness } from "@/lib/types";

import { createSupabaseLeadRepository } from "./supabase";
import {
  UniqueViolationError,
  type LeadStatusPatch,
  type LeadTableGateway,
} from "./supabase-gateway";
import type { DedupeColumns, LeadRefreshPatch, LeadRow } from "./supabase-mapping";

/**
 * In-memory gateway that enforces the SAME two unique indexes as the migration.
 *
 * This is what makes the repository's rules testable offline: no network, no
 * credentials, no Supabase query-builder mocking. If the fake's constraints and
 * the migration's indexes ever disagree, that is the thing to check first.
 */
class FakeGateway implements LeadTableGateway {
  rows: LeadRow[] = [];
  inserts = 0;
  /** Simulates losing a race: the next insert is rejected as a duplicate. */
  rejectNextInsert = false;

  async listRows(): Promise<LeadRow[]> {
    return [...this.rows];
  }

  async findRowById(id: string): Promise<LeadRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findMatchingRow(d: DedupeColumns): Promise<LeadRow | null> {
    const primary = this.rows.find(
      (r) =>
        r.provider_source === d.provider_source &&
        r.provider_external_id === d.provider_external_id,
    );
    if (primary) return primary;

    // Secondary never fires for a null address -- mirrors the partial index.
    if (d.normalized_address === null) return null;
    return (
      this.rows.find(
        (r) =>
          r.normalized_address !== null &&
          r.normalized_name === d.normalized_name &&
          r.normalized_address === d.normalized_address,
      ) ?? null
    );
  }

  async insertRow(row: LeadRow): Promise<void> {
    this.inserts += 1;
    if (this.rejectNextInsert) {
      this.rejectNextInsert = false;
      // Emulate the loser of a race: the winner's row already exists.
      this.rows.push({ ...row, id: "winner-row-id", created_at: "2026-01-01T00:00:00.000Z" });
      throw new UniqueViolationError("duplicate key value violates unique constraint");
    }
    // Enforce the indexes exactly as Postgres would.
    if (await this.findMatchingRow(row)) {
      throw new UniqueViolationError("duplicate key value violates unique constraint");
    }
    this.rows.push({ ...row });
  }

  async updateRow(
    id: string,
    patch: LeadRefreshPatch | LeadStatusPatch,
  ): Promise<LeadRow | null> {
    const index = this.rows.findIndex((r) => r.id === id);
    if (index === -1) return null;
    this.rows[index] = { ...this.rows[index], ...patch } as LeadRow;
    return this.rows[index];
  }
}

const business = (over: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness => ({
  externalId: "node/123",
  source: "osm",
  name: "Salon Réel",
  category: "Hair salon",
  city: "Montreal",
  address: "100 Rue Test, Montreal, QC",
  phone: null,
  website: null,
  rating: null,
  reviewCount: null,
  openingHours: null,
  fetchedAt: "2026-09-06T00:00:00.000Z",
  ...over,
});

const repo = (gateway: FakeGateway, iso = "2026-09-06T00:00:00.000Z") =>
  createSupabaseLeadRepository(gateway, { now: () => new Date(iso) });

describe("upsert: primary dedupe on source + externalId", () => {
  it("creates a lead on first sight", async () => {
    const g = new FakeGateway();
    const summary = await repo(g).upsertDiscovered([business()]);
    expect(summary).toMatchObject({ created: 1, updated: 0 });
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].provider_external_id).toBe("node/123");
  });

  it("refreshes rather than duplicating when the same object returns", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    const summary = await repo(g, "2026-09-07T00:00:00.000Z").upsertDiscovered([business()]);
    expect(summary).toMatchObject({ created: 0, updated: 1 });
    expect(g.rows).toHaveLength(1);
  });

  it("does not match the same externalId from a different source", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business({ source: "osm" })]);
    await repo(g).upsertDiscovered([
      business({ source: "mock", name: "Other", address: "9 Elsewhere Ave" }),
    ]);
    expect(g.rows).toHaveLength(2);
  });

  it("collapses duplicates inside a single batch", async () => {
    const g = new FakeGateway();
    const summary = await repo(g).upsertDiscovered([business(), business(), business()]);
    expect(g.rows).toHaveLength(1);
    expect(summary.created).toBe(1);
    expect(summary.updated).toBe(2);
  });
});

describe("upsert: secondary dedupe on normalized name + address", () => {
  it("matches a business re-listed under a new external id", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    const summary = await repo(g).upsertDiscovered([business({ externalId: "way/999" })]);
    expect(summary).toMatchObject({ created: 0, updated: 1 });
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].provider_external_id).toBe("way/999");
  });

  it("ignores case, accents and whitespace", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    await repo(g).upsertDiscovered([
      business({ externalId: "way/1", name: "  SALON   RÉEL ", address: "100 RUE TEST, MONTREAL, QC" }),
    ]);
    expect(g.rows).toHaveLength(1);
  });

  it("matches across providers at the same name and address", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business({ source: "osm" })]);
    await repo(g).upsertDiscovered([business({ source: "google", externalId: "place-abc" })]);
    expect(g.rows).toHaveLength(1);
  });

  it("does NOT merge the same name at a different address", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    await repo(g).upsertDiscovered([business({ externalId: "node/9", address: "999 Other St" })]);
    expect(g.rows).toHaveLength(2);
  });
});

describe("null addresses never enable merging", () => {
  it("two same-named businesses with null addresses stay separate", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business({ externalId: "node/1", address: null })]);
    await repo(g).upsertDiscovered([business({ externalId: "node/2", address: null })]);
    expect(g.rows).toHaveLength(2);
    expect(g.rows.every((r) => r.normalized_address === null)).toBe(true);
  });

  it("a null-address candidate does not match an addressed lead of the same name", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    await repo(g).upsertDiscovered([business({ externalId: "node/2", address: null })]);
    expect(g.rows).toHaveLength(2);
  });

  it("an addressed candidate does not match a null-address lead of the same name", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business({ externalId: "node/1", address: null })]);
    await repo(g).upsertDiscovered([business({ externalId: "node/2" })]);
    expect(g.rows).toHaveLength(2);
  });
});

describe("rediscovery preserves application-owned fields", () => {
  it("keeps id, status and createdAt while refreshing provider and updatedAt", async () => {
    const g = new FakeGateway();
    await repo(g, "2026-09-01T00:00:00.000Z").upsertDiscovered([business()]);
    const original = { ...g.rows[0] };

    // Mark it reviewed, then rediscover with changed provider data.
    await repo(g).updateStatus(original.id, "reviewed");
    const refreshed = await repo(g, "2026-09-09T12:00:00.000Z").upsertDiscovered([
      business({ phone: "+1 514 555 9999", website: "https://new.example.com", rating: 4.6 }),
    ]);

    const row = g.rows[0];
    expect(g.rows).toHaveLength(1);
    expect(row.id).toBe(original.id);
    expect(row.created_at).toBe("2026-09-01T00:00:00.000Z");
    expect(row.status).toBe("reviewed");
    expect(row.updated_at).toBe("2026-09-09T12:00:00.000Z");
    expect(refreshed.leads[0].status).toBe("reviewed");
    expect(refreshed.leads[0].provider.phone).toBe("+1 514 555 9999");
  });

  it("replaces the provider snapshot wholesale, dropping removed fields", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([
      business({ phone: "+1 514 555 0100", website: "https://old.example.com" }),
    ]);
    await repo(g).upsertDiscovered([business({ phone: null, website: null })]);

    const snapshot = g.rows[0].provider as DiscoveredBusiness;
    expect(snapshot.phone).toBeNull();
    expect(snapshot.website).toBeNull();
  });

  it("updates the dedupe helper columns when a business is re-listed", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    await repo(g).upsertDiscovered([business({ externalId: "relation/7" })]);
    expect(g.rows[0].provider_external_id).toBe("relation/7");
  });

  it("never persists a score or search metadata", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    const columns = Object.keys(g.rows[0]).sort();
    expect(columns).toEqual([
      "created_at", "id", "normalized_address", "normalized_name",
      "provider", "provider_external_id", "provider_source", "status", "updated_at",
    ]);
    const serialized = JSON.stringify(g.rows[0]).toLowerCase();
    for (const forbidden of ["score", "priority", "truncated", "limit"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("concurrency: the database is the final authority", () => {
  it("a rejected insert becomes a refresh of the winning row", async () => {
    const g = new FakeGateway();
    g.rejectNextInsert = true;

    const summary = await repo(g, "2026-09-09T00:00:00.000Z").upsertDiscovered([business()]);

    // No duplicate: the loser refreshed the winner instead of inserting.
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].id).toBe("winner-row-id");
    expect(g.rows[0].created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(g.rows[0].updated_at).toBe("2026-09-09T00:00:00.000Z");
    expect(summary).toMatchObject({ created: 0, updated: 1 });
  });

  it("attempts the insert exactly once - no retry loop", async () => {
    const g = new FakeGateway();
    g.rejectNextInsert = true;
    await repo(g).upsertDiscovered([business()]);
    expect(g.inserts).toBe(1);
  });
});

describe("read and status operations", () => {
  it("list maps every row into a Lead with nested provider", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business(), business({ externalId: "node/2", address: null })]);
    const leads = await repo(g).list();
    expect(leads).toHaveLength(2);
    expect(Object.keys(leads[0]).sort()).toEqual([
      "createdAt", "id", "provider", "status", "updatedAt",
    ]);
  });

  it("findById returns the lead, or null when absent", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    const id = g.rows[0].id;
    expect((await repo(g).findById(id))?.id).toBe(id);
    expect(await repo(g).findById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("updateStatus changes status and updatedAt, preserving everything else", async () => {
    const g = new FakeGateway();
    await repo(g, "2026-09-01T00:00:00.000Z").upsertDiscovered([business()]);
    const before = { ...g.rows[0] };

    const updated = await repo(g, "2026-09-10T00:00:00.000Z").updateStatus(before.id, "reviewed");

    expect(updated?.status).toBe("reviewed");
    expect(updated?.id).toBe(before.id);
    expect(updated?.createdAt).toBe(before.created_at);
    expect(updated?.updatedAt).toBe("2026-09-10T00:00:00.000Z");
    expect(g.rows[0].provider).toEqual(before.provider);
  });

  it("updateStatus returns null for an unknown id rather than throwing", async () => {
    const g = new FakeGateway();
    expect(await repo(g).updateStatus("00000000-0000-4000-8000-000000000000", "reviewed"))
      .toBeNull();
  });

  it("assigns a UUID that is not derived from the provider id", async () => {
    const g = new FakeGateway();
    await repo(g).upsertDiscovered([business()]);
    expect(g.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(g.rows[0].id).not.toBe("node/123");
  });
});
