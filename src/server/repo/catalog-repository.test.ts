import { describe, expect, it } from "vitest";

import type { CatalogRecord } from "@/lib/catalog/types";
import type { DiscoveredBusiness } from "@/lib/types";

import { InMemoryCatalogTableGateway } from "./catalog-gateway";
import { catalogBusinessToRow, CatalogRowMappingError, rowToCatalogBusiness } from "./catalog-mapping";
import { createCatalogRepository } from "./catalog-supabase";
import { CatalogRepositoryError } from "./catalog-types";

/**
 * The catalog repository against the in-memory gateway: no network, no
 * credentials. The in-memory gateway mirrors the database's unique indexes,
 * so a plan the database would refuse is refused here too.
 */

function business(patch: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness {
  return {
    externalId: "gers-1",
    source: "overture",
    name: "Salon Lumière",
    category: "Hair salon",
    city: "Verdun",
    address: "4500 Rue Wellington",
    phone: null,
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-08-20T00:00:00.000Z",
    ...patch,
  };
}

const record = (patch: Partial<DiscoveredBusiness> = {}): CatalogRecord => ({
  business: business(patch),
  municipality: "Montréal",
  location: { latitude: 45.46, longitude: -73.57 },
});

function setup() {
  const gateway = new InMemoryCatalogTableGateway();
  let clock = Date.parse("2026-08-20T06:00:00.000Z");
  let id = 0;
  const repo = createCatalogRepository(gateway, {
    now: () => new Date((clock += 1000)),
    newId: () => `id-${++id}`,
  });
  return { gateway, repo };
}

describe("refresh", () => {
  it("adds on the first load and refreshes on the second, keeping ids", async () => {
    const { repo } = setup();

    const first = await repo.refresh([record(), record({ externalId: "gers-2", name: "Barbier Nord" })], "2026-08-19.0");
    expect(first).toMatchObject({ added: 2, refreshed: 0, unseen: 0 });

    const before = await repo.listAll();
    const second = await repo.refresh([record({ phone: "+15145550100" })], "2026-09-16.0");
    expect(second).toMatchObject({ added: 0, refreshed: 1, unseen: 1 });

    const after = await repo.listAll();
    const salon = after.find((b) => b.provider.name === "Salon Lumière");
    expect(salon?.id).toBe(before.find((b) => b.provider.name === "Salon Lumière")?.id);
    expect(salon?.provider.phone).toBe("+15145550100");
    expect(salon?.lastSeenRelease).toBe("2026-09-16.0");
    expect(salon?.firstSeenRelease).toBe("2026-08-19.0");

    // The barber was not in the second release: kept, not deleted, not refreshed.
    const barber = after.find((b) => b.provider.name === "Barbier Nord");
    expect(barber?.lastSeenRelease).toBe("2026-08-19.0");
  });

  it("is idempotent: loading the same extract twice changes nothing but last-seen", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-08-19.0");
    const again = await repo.refresh([record()], "2026-08-19.0");
    expect(again).toMatchObject({ added: 0, refreshed: 1 });
    expect(await repo.listAll()).toHaveLength(1);
  });

  it("refuses a release older than the one already loaded", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-09-16.0");
    await expect(repo.refresh([record()], "2026-08-19.0")).rejects.toThrow(CatalogRepositoryError);
  });

  it("reports conflicts instead of writing them", async () => {
    const { repo } = setup();
    await repo.refresh(
      [record({ externalId: "a", name: "Old", address: "1 Rue A" }), record({ externalId: "b", name: "Taken", address: "9 Rue B" })],
      "2026-08-19.0",
    );
    const result = await repo.refresh(
      [record({ externalId: "a", name: "Taken", address: "9 Rue B" })],
      "2026-09-16.0",
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.refreshed).toBe(0);
  });
});

describe("linkLead", () => {
  it("sets a link once and never repoints it", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-08-19.0");
    const [stored] = await repo.listAll();

    expect((await repo.linkLead(stored.id, "lead-1"))?.leadId).toBe("lead-1");
    // A second request for a different lead gets the stored truth back.
    expect((await repo.linkLead(stored.id, "lead-2"))?.leadId).toBe("lead-1");
  });

  it("returns null for an unknown business", async () => {
    const { repo } = setup();
    expect(await repo.linkLead("nope", "lead-1")).toBeNull();
  });

  it("survives a refresh: the provider's data changes, the link does not", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-08-19.0");
    const [stored] = await repo.listAll();
    await repo.linkLead(stored.id, "lead-1");

    await repo.refresh([record({ name: "Salon Lumière", phone: "+15145550100" })], "2026-09-16.0");
    const [after] = await repo.listAll();
    expect(after.leadId).toBe("lead-1");
    expect(after.provider.phone).toBe("+15145550100");
  });
});

describe("ingest runs", () => {
  it("opens a run in 'running', advances it, and lists newest first", async () => {
    const { repo } = setup();
    const input = {
      dataset: "overture",
      release: "2026-08-19.0",
      area: "montreal-island",
      sourceFile: "data/overture/montreal-island.ndjson",
      sourceSha256: "a".repeat(64),
      records: 2,
    };
    const first = await repo.openRun(input);
    expect(first).toMatchObject({ state: "running", businessesUnseen: null, finishedAt: null });

    await repo.updateRun(first.id, { businessesAdded: 2, state: "complete", finishedAt: "2026-08-20T07:00:00.000Z", businessesUnseen: 0 });
    const second = await repo.openRun({ ...input, release: "2026-09-16.0" });

    const runs = await repo.recentRuns(5);
    expect(runs.map((run) => run.id)).toEqual([second.id, first.id]);
    expect(runs[1]).toMatchObject({ state: "complete", businessesAdded: 2, businessesUnseen: 0 });
  });
});

describe("row mapping", () => {
  const stored = {
    id: "id-1",
    municipality: "Montréal",
    location: { latitude: 45.46, longitude: -73.57 },
    firstSeenAt: "2026-08-20T00:00:00.000Z",
    lastSeenAt: "2026-08-20T00:00:00.000Z",
    firstSeenRelease: "2026-08-19.0",
    lastSeenRelease: "2026-08-19.0",
    leadId: null,
    googleCheck: null,
    provider: business(),
  };

  it("round-trips a business through its row", () => {
    expect(rowToCatalogBusiness(catalogBusinessToRow(stored))).toEqual(stored);
  });

  it("round-trips a business with no coordinates", () => {
    const noLocation = { ...stored, location: null };
    expect(rowToCatalogBusiness(catalogBusinessToRow(noLocation))).toEqual(noLocation);
  });

  it.each([
    ["half a coordinate pair", { latitude: 45.4, longitude: null }],
    ["a latitude out of range", { latitude: 145, longitude: -73.5 }],
    ["dedupe columns that disagree with the snapshot", { normalized_name: "someone else" }],
    ["an unparseable timestamp", { first_seen_at: "yesterday" }],
    ["a blank municipality", { municipality: "  " }],
    ["a snapshot that is not a snapshot", { provider: { name: "only a name" } }],
  ])("refuses %s", (_label, patch) => {
    const row = { ...catalogBusinessToRow(stored), ...patch };
    expect(() => rowToCatalogBusiness(row)).toThrow(CatalogRowMappingError);
  });
});

describe("the Google Maps check", () => {
  const check = { verdict: "verified" as const, placeId: "ChIJtestplaceid0001", checkedAt: "2026-09-12T12:00:00.000Z" };

  it("records a verdict and keeps it through a refresh", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-08-19.0");
    const [stored] = await repo.listAll();
    await repo.recordGoogleCheck(stored.id, check);
    expect((await repo.findById(stored.id))?.googleCheck).toEqual(check);

    await repo.refresh([record({ phone: "+1 514 555 0100" })], "2026-09-16.0");
    expect((await repo.findById(stored.id))?.googleCheck).toEqual(check);
  });

  it("refuses a place id beside not_found", async () => {
    const { repo } = setup();
    await repo.refresh([record()], "2026-08-19.0");
    const [stored] = await repo.listAll();
    await expect(
      repo.recordGoogleCheck(stored.id, { ...check, verdict: "not_found" }),
    ).rejects.toThrow(CatalogRepositoryError);
  });

  it("unlinks a removed lead, and only that one", async () => {
    const { repo } = setup();
    await repo.refresh([record(), record({ externalId: "gers-2", name: "Barbier Nord", address: "1 Rue Nord" })], "2026-08-19.0");
    const [a, b] = await repo.listAll();
    await repo.linkLead(a.id, "lead-a");
    await repo.linkLead(b.id, "lead-b");
    await repo.unlinkLead("lead-a");
    expect((await repo.findById(a.id))?.leadId).toBeNull();
    expect((await repo.findById(b.id))?.leadId).toBe("lead-b");
  });

  it("round-trips a checked business through its row, and refuses a verdict without a time", () => {
    const stored = {
      id: "id-1",
      municipality: "Montréal",
      location: null,
      firstSeenAt: "2026-08-20T00:00:00.000Z",
      lastSeenAt: "2026-08-20T00:00:00.000Z",
      firstSeenRelease: "2026-08-19.0",
      lastSeenRelease: "2026-08-19.0",
      leadId: null,
      googleCheck: check,
      provider: business(),
    };
    expect(rowToCatalogBusiness(catalogBusinessToRow(stored))).toEqual(stored);
    const broken = { ...catalogBusinessToRow(stored), google_checked_at: null };
    expect(() => rowToCatalogBusiness(broken)).toThrow(CatalogRowMappingError);
    const unknown = { ...catalogBusinessToRow(stored), google_check: "fake" };
    expect(() => rowToCatalogBusiness(unknown)).toThrow(CatalogRowMappingError);
  });
});
