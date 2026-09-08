import { describe, expect, it } from "vitest";

import type { DemoSiteDraft, DemoSiteSpec } from "@/lib/demo-site";

import { createDemoSiteRepository } from "./demo-supabase";
import type { DemoSiteTableGateway } from "./demo-gateway";
import type { DemoSiteRow } from "./demo-mapping";
import { InMemoryDemoSiteTableGateway } from "./demo-table";
import { DemoSiteRepositoryError } from "./demo-types";

/**
 * Repository behaviour, exercised against an in-memory gateway.
 *
 * No network, no credentials, no Supabase. The gateway seam is exactly what
 * makes that possible: the repository holds the rules, the gateway holds row
 * access, and only the latter knows what a database is.
 */

const LEAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ANALYSIS_1 = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_2 = "22222222-2222-4222-8222-222222222222";

const spec = (name = "Salon Test"): DemoSiteSpec => ({
  business: {
    name,
    category: "Hair salon",
    city: "Montreal",
    phone: "+1 514 555 0100",
    address: "100 Rue Test",
    websiteListed: false,
    source: "osm",
    snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    socialLinks: [],
    openingHours: [],
    bookingUrl: null,
    ownDescription: null,
    profileSourced: false,
  },
  content: {
    siteTitle: name,
    tagline: "Hair salon · Montreal",
    theme: "calm-minimal",
    navigation: [{ label: "Visit", targetSectionId: "visit" }],
    sections: [
      {
        kind: "hero",
        id: "top",
        sample: false,
        eyebrow: "Hair salon · Montreal",
        heading: "A hair salon in Montreal",
        subheading: "Easy to find, easy to contact.",
        primaryCta: { label: "Call us", action: "call" },
        secondaryCta: null,
      },
      {
        kind: "contact",
        id: "visit",
        sample: false,
        heading: "Find us",
        body: "Our phone number and address are below.",
        hoursNote: "Opening hours appear here once you confirm them.",
      },
    ],
    footer: { note: "A proposed website." },
  },
});

const draft = (name?: string): DemoSiteDraft => ({
  generator: { name: "mock", model: "deterministic-demo-rules-v1" },
  spec: spec(name),
});

/** A clock that advances one second per call, so ordering is unambiguous. */
function tickingClock(startMs = Date.parse("2026-09-06T10:00:00.000Z")) {
  let ms = startMs;
  return () => new Date((ms += 1000));
}

const repo = (gateway: DemoSiteTableGateway = new InMemoryDemoSiteTableGateway()) =>
  createDemoSiteRepository(gateway, { now: tickingClock() });

describe("create", () => {
  it("assigns identity, status and timestamps the caller did not supply", async () => {
    const demo = await repo().create(LEAD_A, ANALYSIS_1, draft());

    expect(demo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(demo.leadId).toBe(LEAD_A);
    expect(demo.analysisId).toBe(ANALYSIS_1);
    expect(demo.status).toBe("generated");
    expect(demo.createdAt).toBe(demo.updatedAt);
  });

  it("gives each generation its own id", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, ANALYSIS_1, draft());
    const second = await store.create(LEAD_A, ANALYSIS_1, draft());
    expect(first.id).not.toBe(second.id);
  });

  it("validates the draft BEFORE writing, and stores nothing when it fails", async () => {
    const gateway = new InMemoryDemoSiteTableGateway();
    const store = repo(gateway);

    const bad = draft();
    (bad.spec.content as unknown as Record<string, unknown>).theme = "not-a-theme";

    await expect(store.create(LEAD_A, ANALYSIS_1, bad)).rejects.toThrow();
    expect(await store.listForLead(LEAD_A)).toEqual([]);
  });

  it("reports a persistence failure without leaking the driver's message", async () => {
    const failing: DemoSiteTableGateway = {
      insertRow: () => Promise.reject(new Error("duplicate key value violates unique constraint")),
      findRowById: async () => null,
      listRowsForLead: async () => [],
      listRowsForAnalysis: async () => [],
      listRecentRows: async () => [],
    };

    const thrown = await repo(failing)
      .create(LEAD_A, ANALYSIS_1, draft())
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(DemoSiteRepositoryError);
    expect((thrown as Error).message).toBe("Could not save the demo site.");
    expect((thrown as Error).message).not.toContain("unique constraint");
    // The detail survives for a server log, on `cause`.
    expect(((thrown as Error).cause as Error).message).toContain("unique constraint");
  });
});

describe("reads", () => {
  it("finds a stored demo by its own id", async () => {
    const store = repo();
    const created = await store.create(LEAD_A, ANALYSIS_1, draft());
    expect(await store.findById(created.id)).toEqual(created);
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(await repo().findById("no-such-id")).toBeNull();
  });

  it("lists demos for a lead newest first", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, ANALYSIS_1, draft("First"));
    const second = await store.create(LEAD_A, ANALYSIS_1, draft("Second"));
    const third = await store.create(LEAD_A, ANALYSIS_2, draft("Third"));

    const listed = await store.listForLead(LEAD_A);
    expect(listed.map((d) => d.id)).toEqual([third.id, second.id, first.id]);
  });

  it("does not mix demos from another lead", async () => {
    const store = repo();
    await store.create(LEAD_A, ANALYSIS_1, draft("A"));
    await store.create(LEAD_B, ANALYSIS_2, draft("B"));

    const listed = await store.listForLead(LEAD_A);
    expect(listed).toHaveLength(1);
    expect(listed[0].spec.business.name).toBe("A");
  });

  it("lists demos for one analysis newest first", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, ANALYSIS_1, draft());
    await store.create(LEAD_A, ANALYSIS_2, draft());
    const third = await store.create(LEAD_A, ANALYSIS_1, draft());

    const listed = await store.listForAnalysis(ANALYSIS_1);
    expect(listed.map((d) => d.id)).toEqual([third.id, first.id]);
  });

  it("returns the newest demo for a lead", async () => {
    const store = repo();
    await store.create(LEAD_A, ANALYSIS_1, draft("Older"));
    const newest = await store.create(LEAD_A, ANALYSIS_1, draft("Newer"));

    expect((await store.latestForLead(LEAD_A))?.id).toBe(newest.id);
  });

  it("returns null when a lead has never had a demo generated", async () => {
    expect(await repo().latestForLead(LEAD_A)).toBeNull();
  });

  it("lists recent demos across every lead, newest first", async () => {
    const store = repo();
    const a = await store.create(LEAD_A, ANALYSIS_1, draft("A"));
    const b = await store.create(LEAD_B, ANALYSIS_2, draft("B"));

    const listed = await store.listRecent(10);
    expect(listed.map((d) => d.id)).toEqual([b.id, a.id]);
  });

  it("honours the recent limit", async () => {
    const store = repo();
    await store.create(LEAD_A, ANALYSIS_1, draft("A"));
    const b = await store.create(LEAD_B, ANALYSIS_2, draft("B"));

    expect((await store.listRecent(1)).map((d) => d.id)).toEqual([b.id]);
  });

  it("refuses a nonsensical limit rather than guessing one", async () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(repo().listRecent(bad)).rejects.toBeInstanceOf(DemoSiteRepositoryError);
    }
  });

  it("rejects a stored row that no longer matches the schema", async () => {
    // A row written by an older or broken version must fail loudly on read
    // rather than being rendered as a partially-valid page.
    const corrupted: DemoSiteRow = {
      id: "id-1",
      lead_id: LEAD_A,
      analysis_id: ANALYSIS_1,
      status: "generated",
      created_at: "2026-09-06T10:00:00.000Z",
      updated_at: "2026-09-06T10:00:00.000Z",
      generator_name: "mock",
      generator_model: "v1",
      spec: { business: {}, content: {} },
    };

    const gateway: DemoSiteTableGateway = {
      insertRow: async () => undefined,
      findRowById: async () => corrupted,
      listRowsForLead: async () => [corrupted],
      listRowsForAnalysis: async () => [],
      listRecentRows: async () => [],
    };

    await expect(repo(gateway).findById("id-1")).rejects.toBeInstanceOf(DemoSiteRepositoryError);
    await expect(repo(gateway).listForLead(LEAD_A)).rejects.toBeInstanceOf(DemoSiteRepositoryError);
  });
});

describe("the store is append-only by construction", () => {
  it("exposes no update and no delete", () => {
    const store = repo();
    expect(store).not.toHaveProperty("update");
    expect(store).not.toHaveProperty("delete");
    expect(Object.keys(store).sort()).toEqual([
      "create",
      "findById",
      "latestForLead",
      "listForAnalysis",
      "listForLead",
      "listRecent",
    ]);
  });

  it("leaves an earlier demo untouched when a newer one is generated", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, ANALYSIS_1, draft("First"));
    await store.create(LEAD_A, ANALYSIS_1, draft("Second"));

    expect(await store.findById(first.id)).toEqual(first);
  });
});
