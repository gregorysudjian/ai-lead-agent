import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Analysis } from "@/lib/analysis";
import type { DemoSiteContent, DemoSiteGeneratorInput } from "@/lib/demo-site";
import type { Lead } from "@/lib/types";
import type { DemoSiteProvider } from "@/server/demo/types";
import type { DemoSiteRepository } from "@/server/repo/demo-types";

/**
 * The generation workflow.
 *
 * The repositories and the generator are replaced with fakes so nothing here
 * touches a network or a database -- but the DEMO repository is the real one
 * over an in-memory gateway, so the validation that guards persistence is
 * genuinely exercised rather than stubbed out.
 */

const state = vi.hoisted(() => ({
  leads: new Map<string, unknown>(),
  analyses: new Map<string, unknown>(),
  provider: null as unknown,
  demoRepository: null as unknown,
  /** Every mutating call the fakes see. Must stay empty for leads/analyses. */
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
    getAnalysisRepository: () => ({
      findById: async (id: string) => state.analyses.get(id) ?? null,
      latestForLead: async (leadId: string) =>
        [...state.analyses.values()].find((a) => (a as Analysis).leadId === leadId) ?? null,
      create: () => {
        state.mutations.push("analysis.create");
        throw new Error("not expected");
      },
      listForLead: async () => [],
    }),
    getDemoSiteRepository: () => state.demoRepository as DemoSiteRepository,
  };
});

vi.mock("@/server/demo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/demo")>();
  return { ...actual, getDemoSiteProvider: () => state.provider as DemoSiteProvider };
});

const { createDemoSiteRepository } = await import("@/server/repo/demo-supabase");
const { InMemoryDemoSiteTableGateway } = await import("@/server/repo/demo-table");
const { DemoSiteProviderError } = await import("@/server/demo/types");
const { mockDemoSiteProvider } = await import("@/server/demo/mock");
const { DemoSiteRepositoryError } = await import("@/server/repo/demo-types");
const {
  AnalysisLeadMismatchError,
  AnalysisNotFoundError,
  generateDemoSite,
  LeadNotFoundError,
} = await import("./demo-service");

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_LEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";

const lead = (over: Partial<Lead["provider"]> = {}, id = LEAD_ID): Lead => ({
  id,
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Salon Test",
    category: "Hair salon",
    city: "Montreal",
    address: "100 Rue Test",
    phone: "+1 514 555 0100",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-09-05T00:00:00.000Z",
    ...over,
  },
});

const analysis = (leadId = LEAD_ID, id = ANALYSIS_ID): Analysis => ({
  id,
  leadId,
  status: "complete",
  createdAt: "2026-09-06T09:00:00.000Z",
  updatedAt: "2026-09-06T09:00:00.000Z",
  provider: { name: "mock", model: "deterministic-rules-v1" },
  facts: {
    businessName: "Salon Test",
    category: "Hair salon",
    city: "Montreal",
    source: "osm",
    snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    websiteListed: false,
    phoneListed: true,
    addressListed: true,
    ratingListed: null,
    reviewCountListed: null,
  },
  recommendations: {
    businessSummary: "Listed as a hair salon in Montreal.",
    websiteOpportunity: "No website was listed by the provider.",
    recommendedSiteType: "booking-focused-site",
    recommendedPages: ["Home", "Services", "Contact"],
    homepageSections: ["Intro", "Services", "Contact"],
    keySellingPoints: ["Easy to reach"],
    callsToAction: ["Call the shop"],
    designDirection: {
      tone: "Warm and local",
      palette: "Two neutrals plus one accent",
      imagery: "Photographs of the premises",
      typography: "One readable sans-serif",
    },
    draftPositioning: "A hair salon in Montreal, easy to find.",
  },
  assumptions: ["That the category describes the business."],
  limitations: ["Generated from a provider listing only."],
});

/** A generator returning whatever a test supplies, recording its input. */
function stubProvider(
  generate: (input: DemoSiteGeneratorInput) => Promise<DemoSiteContent>,
): DemoSiteProvider & { calls: DemoSiteGeneratorInput[] } {
  const calls: DemoSiteGeneratorInput[] = [];
  return {
    name: "stub",
    model: "stub-v1",
    calls,
    generate: (input) => {
      calls.push(input);
      return generate(input);
    },
  };
}

beforeEach(() => {
  state.leads.clear();
  state.analyses.clear();
  state.mutations = [];
  state.provider = mockDemoSiteProvider;
  state.demoRepository = createDemoSiteRepository(new InMemoryDemoSiteTableGateway());
});

describe("the happy path", () => {
  beforeEach(() => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis());
  });

  it("persists a demo linked to both the lead and the analysis", async () => {
    const demo = await generateDemoSite(LEAD_ID, ANALYSIS_ID);

    expect(demo.leadId).toBe(LEAD_ID);
    expect(demo.analysisId).toBe(ANALYSIS_ID);
    expect(demo.status).toBe("generated");
    expect(await (state.demoRepository as DemoSiteRepository).findById(demo.id)).toEqual(demo);
  });

  it("uses the lead's latest analysis when none is named", async () => {
    const demo = await generateDemoSite(LEAD_ID);
    expect(demo.analysisId).toBe(ANALYSIS_ID);
  });

  it("records the generator's own identity, not anything from its output", async () => {
    state.provider = stubProvider(async () => {
      const content = await mockDemoSiteProvider.generate({
        businessName: "Salon Test",
        category: "Hair salon",
        city: "Montreal",
        phoneListed: true,
        addressListed: true,
        websiteListed: false,
        recommendedSiteType: "one-page-site",
        recommendedPages: [],
        homepageSections: [],
        keySellingPoints: ["x"],
        callsToAction: [],
        designDirection: { tone: "a", palette: "b", imagery: "c", typography: "d" },
        draftPositioning: "p",
        businessSummary: "s",
      });
      return { ...content, generator: { name: "not-me" } } as DemoSiteContent;
    });

    const demo = await generateDemoSite(LEAD_ID, ANALYSIS_ID);
    expect(demo.generator).toEqual({ name: "stub", model: "stub-v1" });
  });

  it("mutates neither the lead nor the analysis", async () => {
    const before = structuredClone(lead());
    const analysisBefore = structuredClone(analysis());

    await generateDemoSite(LEAD_ID, ANALYSIS_ID);

    expect(state.leads.get(LEAD_ID)).toEqual(before);
    expect(state.analyses.get(ANALYSIS_ID)).toEqual(analysisBefore);
    expect(state.mutations).toEqual([]);
  });

  it("regenerating adds a demo rather than replacing one", async () => {
    const first = await generateDemoSite(LEAD_ID, ANALYSIS_ID);
    const second = await generateDemoSite(LEAD_ID, ANALYSIS_ID);

    expect(first.id).not.toBe(second.id);
    const stored = await (state.demoRepository as DemoSiteRepository).listForLead(LEAD_ID);
    expect(stored).toHaveLength(2);
  });
});

describe("fact ownership", () => {
  beforeEach(() => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis());
  });

  it("copies business facts from the lead, not from the analysis snapshot", async () => {
    // The lead has moved on since the analysis ran. The demo must reflect the
    // lead, which is the current record.
    state.leads.set(LEAD_ID, lead({ name: "Salon Renamed", phone: "+1 514 555 0999" }));

    const demo = await generateDemoSite(LEAD_ID, ANALYSIS_ID);
    expect(demo.spec.business.name).toBe("Salon Renamed");
    expect(demo.spec.business.phone).toBe("+1 514 555 0999");
  });

  it("never lets the generator supply a business fact", async () => {
    state.provider = stubProvider(async (input) => {
      const content = await mockDemoSiteProvider.generate(input);
      // A generator trying to assert facts. None of these keys survive.
      return {
        ...content,
        business: { name: "Fabricated Ltd", phone: "+1 000 000 0000" },
      } as unknown as DemoSiteContent;
    });

    const demo = await generateDemoSite(LEAD_ID, ANALYSIS_ID);
    expect(demo.spec.business.name).toBe("Salon Test");
    expect(demo.spec.business.phone).toBe("+1 514 555 0100");
    expect(Object.keys(demo.spec).sort()).toEqual(["business", "content"]);
    expect(demo.spec.content).not.toHaveProperty("business");
  });

  it("does not hand the generator any contact value or internal id", async () => {
    const provider = stubProvider((input) => mockDemoSiteProvider.generate(input));
    state.provider = provider;

    await generateDemoSite(LEAD_ID, ANALYSIS_ID);

    const sent = JSON.stringify(provider.calls[0]);
    expect(sent).not.toContain("555 0100");
    expect(sent).not.toContain("Rue Test");
    expect(sent).not.toContain(LEAD_ID);
    expect(sent).not.toContain(ANALYSIS_ID);
    expect(sent).not.toContain("node/1");
  });
});

describe("failures", () => {
  it("reports a missing lead", async () => {
    await expect(generateDemoSite(LEAD_ID)).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it("reports a lead that has never been analysed", async () => {
    state.leads.set(LEAD_ID, lead());
    await expect(generateDemoSite(LEAD_ID)).rejects.toBeInstanceOf(AnalysisNotFoundError);
  });

  it("reports a named analysis that does not exist", async () => {
    state.leads.set(LEAD_ID, lead());
    await expect(generateDemoSite(LEAD_ID, ANALYSIS_ID)).rejects.toBeInstanceOf(
      AnalysisNotFoundError,
    );
  });

  it("refuses an analysis belonging to a different lead", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis(OTHER_LEAD_ID));

    await expect(generateDemoSite(LEAD_ID, ANALYSIS_ID)).rejects.toBeInstanceOf(
      AnalysisLeadMismatchError,
    );
  });

  it("stores nothing when the lead and analysis do not match", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis(OTHER_LEAD_ID));

    await generateDemoSite(LEAD_ID, ANALYSIS_ID).catch(() => undefined);
    expect(await (state.demoRepository as DemoSiteRepository).listForLead(LEAD_ID)).toEqual([]);
  });

  it("propagates a generator failure and stores nothing", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis());
    state.provider = stubProvider(() => Promise.reject(new DemoSiteProviderError("no")));

    await expect(generateDemoSite(LEAD_ID, ANALYSIS_ID)).rejects.toBeInstanceOf(
      DemoSiteProviderError,
    );
    expect(await (state.demoRepository as DemoSiteRepository).listForLead(LEAD_ID)).toEqual([]);
  });

  it("rejects invalid generator output and stores nothing", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis());
    state.provider = stubProvider(async () => ({ sections: [] }) as unknown as DemoSiteContent);

    await expect(generateDemoSite(LEAD_ID, ANALYSIS_ID)).rejects.toThrow();
    expect(await (state.demoRepository as DemoSiteRepository).listForLead(LEAD_ID)).toEqual([]);
  });

  it("surfaces a persistence failure as a repository error", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis());
    state.demoRepository = createDemoSiteRepository({
      insertRow: () => Promise.reject(new Error("connection reset by peer")),
      findRowById: async () => null,
      listRowsForLead: async () => [],
      listRowsForAnalysis: async () => [],
      listRecentRows: async () => [],
    });

    const thrown = await generateDemoSite(LEAD_ID, ANALYSIS_ID).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(DemoSiteRepositoryError);
    expect((thrown as Error).message).not.toContain("connection reset");
  });

  it("leaves the lead and the analysis untouched after any failure", async () => {
    state.leads.set(LEAD_ID, lead());
    state.analyses.set(ANALYSIS_ID, analysis(OTHER_LEAD_ID));
    const before = structuredClone(lead());

    await generateDemoSite(LEAD_ID, ANALYSIS_ID).catch(() => undefined);

    expect(state.leads.get(LEAD_ID)).toEqual(before);
    expect(state.mutations).toEqual([]);
  });
});
