import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ResearchProviderInput,
  ResearchProviderResult,
  SourceRecord,
} from "@/lib/business-profile";
import type { Lead } from "@/lib/types";
import type { BusinessProfileRepository } from "@/server/repo/profile-types";
import type { ResearchProvider } from "@/server/research/types";

/**
 * The research workflow.
 *
 * The lead repository and the researcher are fakes so nothing touches a
 * network or a database -- but the PROFILE repository is the real one over an
 * in-memory gateway, so the validation guarding persistence is genuinely
 * exercised rather than stubbed out.
 */

const state = vi.hoisted(() => ({
  leads: new Map<string, unknown>(),
  provider: null as unknown,
  profileRepository: null as unknown,
  /** Any mutating call on the lead store. Must stay empty. */
  mutations: [] as string[],
}));

vi.mock("@/server/repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/repo")>();
  return {
    ...actual,
    getLeadRepository: () => ({
      findById: async (id: string) => state.leads.get(id) ?? null,
      upsertMany: () => {
        state.mutations.push("lead.upsertMany");
        throw new Error("not expected");
      },
      updateStatus: () => {
        state.mutations.push("lead.updateStatus");
        throw new Error("not expected");
      },
    }),
    getBusinessProfileRepository: () => state.profileRepository as BusinessProfileRepository,
  };
});

vi.mock("@/server/research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/research")>();
  return { ...actual, getResearchProvider: () => state.provider as ResearchProvider };
});

const { createBusinessProfileRepository } = await import("@/server/repo/profile-supabase");
const { InMemoryBusinessProfileTableGateway } = await import("@/server/repo/profile-table");
const { BusinessProfileRepositoryError } = await import("@/server/repo/profile-types");
const { ResearchProviderError } = await import("@/server/research/types");
const { mockResearchProvider } = await import("@/server/research/mock");
const { LeadNotFoundError, mergeCoverage, researchLead } = await import("./research-service");

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const lead = (over: Partial<Lead["provider"]> = {}): Lead => ({
  id: LEAD_ID,
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Salon Milano",
    category: "Barber shop",
    city: "Montreal",
    address: "151 Rue Beaubien Est",
    phone: "+1 514 271 3898",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-09-06T06:03:33.000Z",
    ...over,
  },
});

const EMPTY_COVERAGE: ResearchProviderResult["coverage"] = [];

/** A researcher returning whatever a test supplies, recording its input. */
function stubResearcher(
  research: (input: ResearchProviderInput) => Promise<ResearchProviderResult>,
  identity: { name: string; version: string } = { name: "stub", version: "stub-v1" },
): ResearchProvider & { calls: ResearchProviderInput[] } {
  const calls: ResearchProviderInput[] = [];
  return {
    name: identity.name,
    version: identity.version,
    calls,
    research: (input) => {
      calls.push(input);
      return research(input);
    },
  };
}

const websiteSource: SourceRecord = {
  id: "site-1",
  type: "website",
  reference: "https://example.test/",
  fetchedAt: "2026-09-07T09:00:00.000Z",
  title: "Salon Milano",
};

beforeEach(() => {
  state.leads.clear();
  state.mutations = [];
  state.provider = mockResearchProvider;
  state.profileRepository = createBusinessProfileRepository(
    new InMemoryBusinessProfileTableGateway(),
  );
});

describe("the happy path", () => {
  beforeEach(() => state.leads.set(LEAD_ID, lead()));

  it("persists a profile linked to the lead", async () => {
    const profile = await researchLead(LEAD_ID);

    expect(profile.leadId).toBe(LEAD_ID);
    expect(profile.status).toBe("complete");
    expect(await (state.profileRepository as BusinessProfileRepository).findById(profile.id)).toEqual(
      profile,
    );
  });

  it("records the lead's own facts, cited to the stored discovery record", async () => {
    const profile = await researchLead(LEAD_ID);

    expect(profile.sources.map((s) => s.id)).toEqual(["lead-snapshot"]);
    expect(profile.facts["identity.name"][0]).toEqual({
      value: "Salon Milano",
      sourceId: "lead-snapshot",
      kind: "observed",
    });
    expect(profile.facts["contact.phone"][0].value).toBe("+1 514 271 3898");
  });

  it("reports coverage for every area, even ones the researcher ignored", async () => {
    const profile = await researchLead(LEAD_ID);
    const byArea = new Map(profile.coverage.map((c) => [c.area, c]));

    expect(byArea.size).toBe(5);
    // Application code is the honest author of these two: the snapshot covered
    // them, not the researcher.
    expect(byArea.get("identity")?.status).toBe("covered");
    expect(byArea.get("contact")?.status).toBe("covered");
    // And of these three, the researcher's own report stands.
    expect(byArea.get("web")?.status).toBe("not-researched");
    expect(byArea.get("business")?.status).toBe("not-researched");
    expect(byArea.get("reputation")?.status).toBe("not-researched");
  });

  it("marks an area as not researched when nothing covered it", async () => {
    state.leads.set(LEAD_ID, lead({ rating: null, reviewCount: null }));
    const profile = await researchLead(LEAD_ID);

    const reputation = profile.coverage.find((c) => c.area === "reputation");
    expect(reputation?.status).toBe("not-researched");
    // Never "the business has no reviews".
    expect(reputation?.note.toLowerCase()).not.toContain("no reviews");
  });

  it("re-running adds a profile rather than replacing one", async () => {
    const first = await researchLead(LEAD_ID);
    const second = await researchLead(LEAD_ID);

    expect(first.id).not.toBe(second.id);
    expect(await (state.profileRepository as BusinessProfileRepository).listForLead(LEAD_ID)).toHaveLength(
      2,
    );
  });

  it("mutates the lead in no way", async () => {
    const before = structuredClone(lead());
    await researchLead(LEAD_ID);

    expect(state.leads.get(LEAD_ID)).toEqual(before);
    expect(state.mutations).toEqual([]);
  });
});

describe("the researcher controls none of the record's identity", () => {
  beforeEach(() => state.leads.set(LEAD_ID, lead()));

  it("takes the researcher name from the object, not from its output", async () => {
    state.provider = stubResearcher(
      async () =>
        ({
          sources: [],
          observations: [],
          coverage: EMPTY_COVERAGE,
          limitations: [],
          researcher: { name: "not-me", version: "9.9" },
        }) as unknown as ResearchProviderResult,
    );

    const profile = await researchLead(LEAD_ID);
    expect(profile.researcher).toEqual({ name: "stub", version: "stub-v1" });
  });

  it("ignores an id, leadId or timestamp a researcher tries to set", async () => {
    state.provider = stubResearcher(
      async () =>
        ({
          sources: [],
          observations: [],
          coverage: EMPTY_COVERAGE,
          limitations: [],
          id: "chosen-by-the-researcher",
          leadId: "someone-elses-lead",
          createdAt: "1999-01-01T00:00:00.000Z",
        }) as unknown as ResearchProviderResult,
    );

    const profile = await researchLead(LEAD_ID);
    expect(profile.id).not.toBe("chosen-by-the-researcher");
    expect(profile.leadId).toBe(LEAD_ID);
    expect(profile.createdAt.startsWith("1999")).toBe(false);
  });

  it("refuses a researcher that cites the reserved discovery-record source", async () => {
    // Otherwise it could attribute an invention to a source it never read.
    state.provider = stubResearcher(async () => ({
      sources: [{ ...websiteSource, id: "lead-snapshot" }],
      observations: [],
      coverage: EMPTY_COVERAGE,
      limitations: [],
    }));

    await expect(researchLead(LEAD_ID)).rejects.toBeInstanceOf(ResearchProviderError);
  });

  it("refuses an observation attributed to the discovery record", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource],
      observations: [
        { field: "contact.phone", value: "+1 000", sourceId: "lead-snapshot", kind: "stated" },
      ],
      coverage: EMPTY_COVERAGE,
      limitations: [],
    }));

    await expect(researchLead(LEAD_ID)).rejects.toBeInstanceOf(ResearchProviderError);
  });

  it("refuses an observation with no matching source", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource],
      observations: [
        { field: "contact.phone", value: "+1 000", sourceId: "never-declared", kind: "stated" },
      ],
      coverage: EMPTY_COVERAGE,
      limitations: [],
    }));

    const thrown = await researchLead(LEAD_ID).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ResearchProviderError);
    expect((thrown as Error).message).toContain("no matching source");
  });

  it("refuses duplicate source ids", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource, { ...websiteSource, reference: "https://other.test/" }],
      observations: [],
      coverage: EMPTY_COVERAGE,
      limitations: [],
    }));

    await expect(researchLead(LEAD_ID)).rejects.toBeInstanceOf(ResearchProviderError);
  });
});

describe("evidence from several sources is combined, never overwritten", () => {
  beforeEach(() => state.leads.set(LEAD_ID, lead()));

  it("keeps a researcher's phone number alongside the lead's", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource],
      observations: [
        { field: "contact.phone", value: "+1 514 000 0000", sourceId: "site-1", kind: "stated" },
      ],
      coverage: [{ area: "web", status: "covered", note: "The website was fetched." }],
      limitations: [],
    }));

    const profile = await researchLead(LEAD_ID);
    const phones = profile.facts["contact.phone"];

    expect(phones).toHaveLength(2);
    expect(phones.map((o) => o.sourceId).sort()).toEqual(["lead-snapshot", "site-1"]);
    // Both values survive; neither replaced the other.
    expect(phones.map((o) => o.value).sort()).toEqual(["+1 514 000 0000", "+1 514 271 3898"]);
  });

  it("lists the discovery record first and the researcher's sources after", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource],
      observations: [],
      coverage: [{ area: "web", status: "covered", note: "The website was fetched." }],
      limitations: [],
    }));

    const profile = await researchLead(LEAD_ID);
    expect(profile.sources.map((s) => s.id)).toEqual(["lead-snapshot", "site-1"]);
  });

  it("lets a researcher's coverage report win over the application default", async () => {
    state.provider = stubResearcher(async () => ({
      sources: [websiteSource],
      observations: [],
      coverage: [{ area: "contact", status: "unavailable", note: "The page could not be parsed." }],
      limitations: [],
    }));

    const profile = await researchLead(LEAD_ID);
    expect(profile.coverage.find((c) => c.area === "contact")?.status).toBe("unavailable");
  });
});

describe("what a researcher receives", () => {
  beforeEach(() => state.leads.set(LEAD_ID, lead({ website: "https://example.test" })));

  it("gets the sanitized input and no internal identifiers", async () => {
    const researcher = stubResearcher(async () => ({
      sources: [],
      observations: [],
      coverage: EMPTY_COVERAGE,
      limitations: [],
    }));
    state.provider = researcher;

    await researchLead(LEAD_ID);

    const sent = JSON.stringify(researcher.calls[0]);
    expect(researcher.calls[0].businessName).toBe("Salon Milano");
    expect(researcher.calls[0].website).toBe("https://example.test");
    expect(sent).not.toContain(LEAD_ID);
    expect(sent).not.toContain("node/1");
  });
});

describe("failures", () => {
  it("reports a missing lead", async () => {
    await expect(researchLead(LEAD_ID)).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it("propagates a researcher failure and stores nothing", async () => {
    state.leads.set(LEAD_ID, lead());
    state.provider = stubResearcher(() => Promise.reject(new ResearchProviderError("no")));

    await expect(researchLead(LEAD_ID)).rejects.toBeInstanceOf(ResearchProviderError);
    expect(await (state.profileRepository as BusinessProfileRepository).listForLead(LEAD_ID)).toEqual(
      [],
    );
  });

  it("rejects invalid researcher output and stores nothing", async () => {
    state.leads.set(LEAD_ID, lead());
    state.provider = stubResearcher(
      async () => ({ sources: [], observations: [] }) as unknown as ResearchProviderResult,
    );

    await expect(researchLead(LEAD_ID)).rejects.toThrow();
    expect(await (state.profileRepository as BusinessProfileRepository).listForLead(LEAD_ID)).toEqual(
      [],
    );
  });

  it("surfaces a persistence failure without the driver's message", async () => {
    state.leads.set(LEAD_ID, lead());
    state.profileRepository = createBusinessProfileRepository({
      insertRow: () => Promise.reject(new Error("connection reset by peer")),
      findRowById: async () => null,
      listRowsForLead: async () => [],
      listRecentRows: async () => [],
    });

    const thrown = await researchLead(LEAD_ID).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(BusinessProfileRepositoryError);
    expect((thrown as Error).message).not.toContain("connection reset");
  });

  it("leaves the lead untouched after any failure", async () => {
    state.leads.set(LEAD_ID, lead());
    state.provider = stubResearcher(() => Promise.reject(new ResearchProviderError("no")));
    const before = structuredClone(lead());

    await researchLead(LEAD_ID).catch(() => undefined);

    expect(state.leads.get(LEAD_ID)).toEqual(before);
    expect(state.mutations).toEqual([]);
  });
});

describe("mergeCoverage", () => {
  it("fills an unreported area from whether the snapshot covered it", () => {
    const merged = mergeCoverage(
      [],
      [{ field: "identity.name", value: "X", sourceId: "lead-snapshot", kind: "observed" }],
    );

    expect(merged).toHaveLength(5);
    expect(merged.find((c) => c.area === "identity")?.status).toBe("covered");
    expect(merged.find((c) => c.area === "web")?.status).toBe("not-researched");
  });

  it("never invents a 'covered' for an area with no observations", () => {
    const merged = mergeCoverage([], []);
    expect(merged.every((c) => c.status === "not-researched")).toBe(true);
  });

  it("gives every area exactly one entry", () => {
    const merged = mergeCoverage(
      [
        { area: "web", status: "unavailable", note: "n" },
        { area: "business", status: "covered", note: "n" },
      ],
      [],
    );
    expect(new Set(merged.map((c) => c.area)).size).toBe(5);
  });
});
