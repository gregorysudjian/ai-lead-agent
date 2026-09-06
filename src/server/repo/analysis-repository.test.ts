import { describe, expect, it } from "vitest";

import type { AnalysisDraft } from "@/lib/analysis";

import { createAnalysisRepository } from "./analysis-supabase";
import { InMemoryAnalysisTableGateway } from "./analysis-table";
import { AnalysisRepositoryError } from "./analysis-types";

const draft = (over: Partial<AnalysisDraft> = {}): AnalysisDraft => ({
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
    businessSummary: "A summary.",
    websiteOpportunity: "An opportunity.",
    recommendedSiteType: "booking-focused-site",
    recommendedPages: ["Home"],
    homepageSections: ["Hero"],
    keySellingPoints: ["Point"],
    callsToAction: ["Call"],
    designDirection: { tone: "t", palette: "p", imagery: "i", typography: "ty" },
    draftPositioning: "Positioning.",
  },
  assumptions: ["A"],
  limitations: ["L"],
  ...over,
});

const repo = (gateway = new InMemoryAnalysisTableGateway(), iso = "2026-09-06T00:00:00.000Z") =>
  createAnalysisRepository(gateway, { now: () => new Date(iso) });

const LEAD = "22222222-2222-4222-8222-222222222222";

describe("create", () => {
  it("assigns identity, status and timestamps", async () => {
    const analysis = await repo().create(LEAD, draft());
    expect(analysis.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(analysis.leadId).toBe(LEAD);
    expect(analysis.status).toBe("complete");
    expect(analysis.createdAt).toBe("2026-09-06T00:00:00.000Z");
    expect(analysis.updatedAt).toBe("2026-09-06T00:00:00.000Z");
  });

  it("preserves the provider draft verbatim", async () => {
    const d = draft();
    const analysis = await repo().create(LEAD, d);
    expect(analysis.facts).toEqual(d.facts);
    expect(analysis.recommendations).toEqual(d.recommendations);
    expect(analysis.provider).toEqual(d.provider);
  });

  it("does not mutate the draft it was given", async () => {
    const d = draft();
    const before = structuredClone(d);
    await repo().create(LEAD, d);
    expect(d).toEqual(before);
  });

  it.each([
    ["unknown site type", { recommendedSiteType: "mega-site" }],
    ["empty page entry", { recommendedPages: [""] }],
    ["missing summary", { businessSummary: "" }],
  ])("rejects invalid provider output before writing: %s", async (_label, patch) => {
    const gateway = new InMemoryAnalysisTableGateway();
    const bad = draft({ recommendations: { ...draft().recommendations, ...patch } as never });

    await expect(repo(gateway).create(LEAD, bad)).rejects.toThrow();
    // Nothing partial was persisted.
    expect(await gateway.listRowsForLead(LEAD)).toHaveLength(0);
  });

  it("wraps a gateway failure in AnalysisRepositoryError", async () => {
    const failing = {
      async insertRow() { throw new Error("connection reset"); },
      async findRowById() { return null; },
      async listRowsForLead() { return []; },
    };
    await expect(repo(failing as never).create(LEAD, draft())).rejects.toBeInstanceOf(
      AnalysisRepositoryError,
    );
  });
});

describe("reads", () => {
  it("finds an analysis by its own id", async () => {
    const gateway = new InMemoryAnalysisTableGateway();
    const created = await repo(gateway).create(LEAD, draft());
    expect((await repo(gateway).findById(created.id))?.id).toBe(created.id);
    expect(await repo(gateway).findById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("lists analyses for a lead, newest first", async () => {
    const gateway = new InMemoryAnalysisTableGateway();
    await repo(gateway, "2026-09-01T00:00:00.000Z").create(LEAD, draft());
    await repo(gateway, "2026-09-02T00:00:00.000Z").create(LEAD, draft());
    await repo(gateway, "2026-09-03T00:00:00.000Z").create(LEAD, draft());

    const list = await repo(gateway).listForLead(LEAD);
    expect(list.map((a) => a.createdAt)).toEqual([
      "2026-09-03T00:00:00.000Z",
      "2026-09-02T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
  });

  it("keeps analyses for different leads separate", async () => {
    const gateway = new InMemoryAnalysisTableGateway();
    await repo(gateway).create(LEAD, draft());
    await repo(gateway).create("33333333-3333-4333-8333-333333333333", draft());
    expect(await repo(gateway).listForLead(LEAD)).toHaveLength(1);
  });

  it("returns the newest as latestForLead, or null when never analysed", async () => {
    const gateway = new InMemoryAnalysisTableGateway();
    expect(await repo(gateway).latestForLead(LEAD)).toBeNull();

    await repo(gateway, "2026-09-01T00:00:00.000Z").create(LEAD, draft());
    const newest = await repo(gateway, "2026-09-09T00:00:00.000Z").create(LEAD, draft());

    expect((await repo(gateway).latestForLead(LEAD))?.id).toBe(newest.id);
  });

  it("is append-only: re-analysing adds a run rather than replacing one", async () => {
    const gateway = new InMemoryAnalysisTableGateway();
    const first = await repo(gateway, "2026-09-01T00:00:00.000Z").create(LEAD, draft());
    await repo(gateway, "2026-09-02T00:00:00.000Z").create(LEAD, draft());

    const list = await repo(gateway).listForLead(LEAD);
    expect(list).toHaveLength(2);
    // The original run is still readable, unchanged.
    expect(list.map((a) => a.id)).toContain(first.id);
  });
});
