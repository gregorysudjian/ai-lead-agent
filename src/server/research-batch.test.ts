import { afterEach, describe, expect, it, vi } from "vitest";

import type { BusinessProfile } from "@/lib/business-profile";
import type { Lead } from "@/lib/types";

/**
 * The batch runner. Every dependency is mocked, so no site is fetched and no
 * billable lookup happens anywhere in this file.
 */

const AT = "2026-09-07T12:00:00.000Z";

const lead = (id: string, name = `Business ${id}`): Lead => ({
  id,
  status: "new",
  createdAt: AT,
  updatedAt: AT,
  provider: {
    externalId: `node/${id}`,
    source: "osm",
    name,
    category: "Barber shop",
    city: "Montreal",
    address: "1 Rue Test",
    phone: "+1 514 000 0000",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
  },
});

const profileFor = (leadId: string) => ({ leadId }) as BusinessProfile;

const leadRepo = {
  list: vi.fn(async (): Promise<Lead[]> => []),
  // researchLead re-reads the lead by id; the batch must not pass one in.
  findById: vi.fn(async (id: string): Promise<Lead | null> => lead(id)),
};
const profileRepo = {
  listRecent: vi.fn(async (): Promise<BusinessProfile[]> => []),
  latestForLead: vi.fn(),
  create: vi.fn(),
};

vi.mock("@/server/repo", () => ({
  getLeadRepository: () => leadRepo,
  getBusinessProfileRepository: () => profileRepo,
}));

const researched: string[] = [];
const failing = new Set<string>();

vi.mock("@/server/research", () => ({
  getResearchProvider: () => ({
    name: "website",
    version: "v1",
    research: async () => ({ sources: [], observations: [], coverage: [], limitations: [] }),
  }),
  ResearchProviderError: class extends Error {},
}));

const { researchLeadsWithoutProfiles, MAX_BATCH_SIZE } = await import("./research-service");

// researchLead runs for real against these mocks; the repository's `create`
// is what records that a lead was researched, and what a test makes fail.
vi.mock("@/lib/profile-facts", () => ({
  deriveLeadSnapshotSource: () => ({
    id: "lead-snapshot",
    type: "lead-snapshot",
    reference: "osm:node/1",
    fetchedAt: AT,
    title: "OpenStreetMap",
  }),
  deriveLeadObservations: () => [],
  toResearchInput: () => ({}),
}));

afterEach(() => {
  vi.clearAllMocks();
  researched.length = 0;
  failing.clear();
});

/** Wire the repositories so `researchLead` succeeds or fails per lead. */
function arrange(leads: Lead[], alreadyResearched: string[] = []) {
  leadRepo.list.mockResolvedValue(leads);
  profileRepo.listRecent.mockResolvedValue(alreadyResearched.map(profileFor));
  profileRepo.create.mockImplementation(async (leadId: string) => {
    if (failing.has(leadId)) throw new Error("upstream detail that must not leak");
    researched.push(leadId);
    return profileFor(leadId);
  });
}

const noSleep = { sleep: async () => {}, delayMs: 0 };

describe("a batch is bounded and deliberate", () => {
  it("refuses a limit above the cap", async () => {
    arrange([]);
    await expect(
      researchLeadsWithoutProfiles(MAX_BATCH_SIZE + 1, noSleep),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it("refuses a nonsense limit", async () => {
    arrange([]);
    for (const limit of [0, -1, 2.5, Number.NaN]) {
      await expect(researchLeadsWithoutProfiles(limit, noSleep)).rejects.toBeInstanceOf(
        RangeError,
      );
    }
  });

  it("never touches more leads than the limit", async () => {
    arrange([lead("1"), lead("2"), lead("3"), lead("4")]);
    const result = await researchLeadsWithoutProfiles(2, noSleep);

    expect(result.attempted).toBe(2);
    expect(researched).toEqual(["1", "2"]);
    // And says honestly how many it did not reach.
    expect(result.remaining).toBe(2);
  });

  it("pauses between leads rather than firing them at once", async () => {
    arrange([lead("1"), lead("2"), lead("3")]);
    const waits: number[] = [];

    await researchLeadsWithoutProfiles(3, {
      delayMs: 250,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    // One pause between each pair, none before the first.
    expect(waits).toEqual([250, 250]);
  });
});

describe("work already done is not repeated", () => {
  it("skips leads that already have a profile", async () => {
    arrange([lead("1"), lead("2"), lead("3")], ["2"]);
    const result = await researchLeadsWithoutProfiles(10, noSleep);

    expect(researched).toEqual(["1", "3"]);
    expect(result.attempted).toBe(2);
  });

  it("does nothing at all when every lead is researched", async () => {
    arrange([lead("1"), lead("2")], ["1", "2"]);
    const result = await researchLeadsWithoutProfiles(10, noSleep);

    expect(result).toMatchObject({ attempted: 0, researched: 0, failed: 0, remaining: 0 });
    expect(researched).toEqual([]);
  });
});

describe("one bad lead does not cost the others", () => {
  it("records a failure, skips it, and carries on", async () => {
    arrange([lead("1"), lead("2", "Broken"), lead("3")]);
    failing.add("2");

    const result = await researchLeadsWithoutProfiles(10, noSleep);

    expect(researched).toEqual(["1", "3"]);
    expect(result).toMatchObject({ attempted: 3, researched: 2, failed: 1 });
  });

  it("never retries the lead that failed", async () => {
    arrange([lead("1")]);
    failing.add("1");

    await researchLeadsWithoutProfiles(10, noSleep);
    // Exactly one attempt. A site that timed out is not more likely to answer
    // a second later, and a repeated billable lookup is just a bill.
    expect(profileRepo.create).toHaveBeenCalledTimes(1);
  });

  it("leaks no upstream detail into the outcome", async () => {
    arrange([lead("1", "Broken")]);
    failing.add("1");

    const result = await researchLeadsWithoutProfiles(10, noSleep);
    const note = result.outcomes[0].note;

    expect(note).not.toContain("upstream detail");
    expect(note).toContain("skipped, not retried");
  });

  it("names each lead in its outcome so a run is reviewable", async () => {
    arrange([lead("1", "Salon One"), lead("2", "Salon Two")]);
    const result = await researchLeadsWithoutProfiles(10, noSleep);

    expect(result.outcomes.map((o) => o.name)).toEqual(["Salon One", "Salon Two"]);
    expect(result.outcomes.every((o) => o.status === "researched")).toBe(true);
  });
});

describe("nothing schedules this", () => {
  it("exposes no interval, cron or repeat option", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "research-service.ts"),
      "utf8",
    );

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("cron");
    expect(source).not.toMatch(/while\s*\(\s*true\s*\)/);
  });
});
