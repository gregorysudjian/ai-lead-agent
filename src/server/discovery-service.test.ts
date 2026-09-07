import { afterEach, describe, expect, it, vi } from "vitest";

import type { DiscoveredBusiness, Lead } from "@/lib/types";

/**
 * The application service: registry resolution, source selection policy, and
 * the guarantee that a discovery run does not write.
 *
 * The repository and the source registry are both mocked, so nothing here
 * touches a network, a file or a database.
 */

const AT = "2026-09-07T12:00:00.000Z";

const business = (
  source: "osm" | "google",
  externalId: string,
  over: Partial<DiscoveredBusiness> = {},
): DiscoveredBusiness => ({
  externalId,
  source,
  name: "G&G Barbershop",
  category: "Barber shop",
  city: "Montreal",
  address: "28 Avenue des Pins Est",
  phone: "+1 514 844 4384",
  website: null,
  rating: null,
  reviewCount: null,
  openingHours: null,
  fetchedAt: AT,
  ...over,
});

const lead = (id: string, over: Partial<DiscoveredBusiness> = {}): Lead => ({
  id,
  status: "new",
  createdAt: AT,
  updatedAt: AT,
  provider: business("osm", "node/1", over),
});

/** Every repository method, so an unexpected write is a visible call. */
const repo = {
  list: vi.fn(async (): Promise<Lead[]> => []),
  findById: vi.fn(),
  upsertDiscovered: vi.fn(),
  updateStatus: vi.fn(),
};

const sources = vi.fn();

vi.mock("@/server/repo", () => ({
  getLeadRepository: () => repo,
  LeadRepositoryError: class LeadRepositoryError extends Error {},
}));

vi.mock("@/server/discovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/discovery")>();
  return { ...actual, configuredDiscoverySources: () => sources() };
});

const { discoverCandidates } = await import("./discovery-service");
const { DiscoveryValidationError } = await import("./discovery");

function stub(name: "osm" | "google" | "mock", businesses: DiscoveredBusiness[]) {
  const source = {
    name,
    persistable: name !== "google",
    asked: 0,
    async search() {
      source.asked += 1;
      return { businesses, meta: { truncated: false, limit: null } };
    },
  };
  return source;
}

afterEach(() => {
  vi.clearAllMocks();
  repo.list.mockResolvedValue([]);
});

describe("input is resolved against the curated registries first", () => {
  it("accepts a supported city and category, in any spelling", async () => {
    sources.mockReturnValue([stub("osm", [business("osm", "node/1")])]);

    const result = await discoverCandidates({ city: " MONTRÉAL ", category: "barbershop" });
    expect(result.query).toEqual({ city: "Montreal", category: "Barber shop" });
  });

  it("rejects an unsupported city before any source is asked", async () => {
    const osm = stub("osm", []);
    sources.mockReturnValue([osm]);

    await expect(
      discoverCandidates({ city: "Atlantis", category: "Barber shop" }),
    ).rejects.toBeInstanceOf(DiscoveryValidationError);
    expect(osm.asked).toBe(0);
  });

  it("rejects an unsupported category before any source is asked", async () => {
    const osm = stub("osm", []);
    sources.mockReturnValue([osm]);

    await expect(
      discoverCandidates({ city: "Montreal", category: "nightclubs" }),
    ).rejects.toBeInstanceOf(DiscoveryValidationError);
    expect(osm.asked).toBe(0);
  });

  it("lists what IS supported, and nothing internal", async () => {
    sources.mockReturnValue([stub("osm", [])]);

    const thrown = (await discoverCandidates({
      city: "Atlantis",
      category: "Barber shop",
    }).catch((e: unknown) => e)) as InstanceType<typeof DiscoveryValidationError>;

    expect(thrown.supported?.cities).toContain("Montreal");
  });
});

describe("a request may narrow the enabled sources, never widen them", () => {
  it("asks every enabled source when none is named", async () => {
    const osm = stub("osm", []);
    const google = stub("google", []);
    sources.mockReturnValue([osm, google]);

    const result = await discoverCandidates({ city: "Montreal", category: "Barber shop" });

    expect(osm.asked).toBe(1);
    expect(google.asked).toBe(1);
    expect(result.requestedSources).toEqual(["osm", "google"]);
  });

  it("asks only the named subset", async () => {
    const osm = stub("osm", []);
    const google = stub("google", []);
    sources.mockReturnValue([osm, google]);

    const result = await discoverCandidates({
      city: "Montreal",
      category: "Barber shop",
      sources: ["osm"],
    });

    expect(osm.asked).toBe(1);
    expect(google.asked).toBe(0);
    expect(result.requestedSources).toEqual(["osm"]);
    // The UI still learns what else exists, so it can offer the choice.
    expect(result.availableSources).toEqual(["osm", "google"]);
  });

  it("refuses a source this server has not enabled", async () => {
    const osm = stub("osm", []);
    sources.mockReturnValue([osm]);

    // The client cannot switch a billable provider on by asking for it.
    await expect(
      discoverCandidates({ city: "Montreal", category: "Barber shop", sources: ["google"] }),
    ).rejects.toBeInstanceOf(DiscoveryValidationError);
    expect(osm.asked).toBe(0);
  });

  it("refuses an unknown source name rather than ignoring it", async () => {
    sources.mockReturnValue([stub("osm", [])]);

    await expect(
      discoverCandidates({ city: "Montreal", category: "Barber shop", sources: ["yelp"] }),
    ).rejects.toBeInstanceOf(DiscoveryValidationError);
  });

  it("refuses an empty selection", async () => {
    sources.mockReturnValue([stub("osm", [])]);

    await expect(
      discoverCandidates({ city: "Montreal", category: "Barber shop", sources: [] }),
    ).rejects.toBeInstanceOf(DiscoveryValidationError);
  });
});

describe("a discovery run reads the lead store and writes nothing", () => {
  it("marks a candidate we already hold", async () => {
    repo.list.mockResolvedValue([lead("lead-77")]);
    sources.mockReturnValue([stub("osm", [business("osm", "node/1")])]);

    const result = await discoverCandidates({ city: "Montreal", category: "Barber shop" });

    expect(result.candidates[0].state).toBe("in-leads");
    expect(result.candidates[0].existingLeadId).toBe("lead-77");
  });

  it("never creates or updates a lead", async () => {
    sources.mockReturnValue([
      stub("osm", [business("osm", "node/NEW", { name: "Brand New Salon" })]),
      stub("google", [business("google", "ChIJnew", { name: "Google Only Salon" })]),
    ]);

    await discoverCandidates({ city: "Montreal", category: "Barber shop" });

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.upsertDiscovered).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("does not persist a Google-only candidate", async () => {
    sources.mockReturnValue([stub("google", [business("google", "ChIJabc")])]);

    const result = await discoverCandidates({ city: "Montreal", category: "Barber shop" });

    expect(result.candidates[0].state).toBe("candidate-only");
    expect(repo.upsertDiscovered).not.toHaveBeenCalled();
  });

  it("reads the store once, not once per candidate", async () => {
    sources.mockReturnValue([
      stub("osm", [
        business("osm", "node/1", { name: "A", address: "1 St", phone: null }),
        business("osm", "node/2", { name: "B", address: "2 St", phone: null }),
        business("osm", "node/3", { name: "C", address: "3 St", phone: null }),
      ]),
    ]);

    await discoverCandidates({ city: "Montreal", category: "Barber shop" });
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});
