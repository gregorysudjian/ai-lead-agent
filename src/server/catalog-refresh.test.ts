import { describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/lib/catalog/types";
import type { DiscoveredBusiness, Lead } from "@/lib/types";

import { refreshCatalog, type CatalogExtract } from "./catalog-refresh";
import { InMemoryCatalogTableGateway } from "./repo/catalog-gateway";
import { createCatalogRepository } from "./repo/catalog-supabase";
import type { LeadRepository } from "./repo";

const AT = "2026-09-11T00:00:00.000Z";

function business(patch: Partial<DiscoveredBusiness>): DiscoveredBusiness {
  return {
    externalId: "g1",
    source: "overture",
    name: "Salon",
    category: "Hair salon",
    city: "Montréal",
    address: "1 Rue A",
    phone: null,
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
    ...patch,
  };
}

const record = (patch: Partial<DiscoveredBusiness>): CatalogRecord => ({
  business: business(patch),
  municipality: "Montréal",
  location: { latitude: 45.5, longitude: -73.6 },
});

function extract(records: CatalogRecord[], release = "2026-08-19.0"): CatalogExtract {
  return {
    meta: { dataset: "overture", release, area: "montreal-island" },
    records,
    sourceFile: "data/catalog/montreal-island.ndjson",
    sha256: "f".repeat(64),
  };
}

function leadsRepo(leads: Lead[]): LeadRepository {
  return {
    list: async () => leads,
    findById: async (id) => leads.find((lead) => lead.id === id) ?? null,
    upsertDiscovered: async () => {
      throw new Error("a refresh must never create a lead");
    },
    updateStatus: async () => null,
  };
}

describe("refreshCatalog", () => {
  it("loads, links a lead that predates the catalog, and closes the run as complete", async () => {
    const catalog = createCatalogRepository(new InMemoryCatalogTableGateway());
    const osmLead: Lead = {
      id: "lead-1",
      status: "new",
      createdAt: AT,
      updatedAt: AT,
      // The same shop, written the OpenStreetMap way.
      provider: business({ source: "osm", externalId: "node/9", name: "Coupe Ozone", address: "1294 Rue Ontario Est, Montréal" }),
    };

    const outcome = await refreshCatalog(
      extract([
        record({ externalId: "g1", name: "Coupe Ozone", address: "1294 Ontario St E" }),
        record({ externalId: "g2", name: "Barbier Nord", address: "9 Rue B" }),
      ]),
      { catalog, leads: leadsRepo([osmLead]) },
    );

    expect(outcome).toMatchObject({ added: 2, refreshed: 0, leadsLinked: 1, conflicts: [] });
    const linked = (await catalog.listAll()).find((b) => b.provider.name === "Coupe Ozone");
    expect(linked?.leadId).toBe("lead-1");

    const [run] = await catalog.recentRuns(1);
    expect(run).toMatchObject({
      state: "complete",
      businessesAdded: 2,
      leadsLinked: 1,
      businessesUnseen: 0,
      release: "2026-08-19.0",
    });
    expect(run.finishedAt).not.toBeNull();
  });

  it("marks the run failed, rather than leaving it 'running', when the refresh throws", async () => {
    const catalog = createCatalogRepository(new InMemoryCatalogTableGateway());
    await refreshCatalog(extract([record({})], "2026-09-16.0"), { catalog, leads: leadsRepo([]) });

    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // An older release is refused by the repository.
    await expect(
      refreshCatalog(extract([record({})], "2026-08-19.0"), { catalog, leads: leadsRepo([]) }),
    ).rejects.toThrow();
    quiet.mockRestore();

    const [latest] = await catalog.recentRuns(1);
    expect(latest).toMatchObject({ state: "failed", detail: "refresh failed", release: "2026-08-19.0" });
  });

  it("never creates a lead", async () => {
    const catalog = createCatalogRepository(new InMemoryCatalogTableGateway());
    // leadsRepo throws from upsertDiscovered; reaching it would fail this test.
    await expect(
      refreshCatalog(extract([record({})]), { catalog, leads: leadsRepo([]) }),
    ).resolves.toMatchObject({ added: 1 });
  });
});
