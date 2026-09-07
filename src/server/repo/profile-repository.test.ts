import { describe, expect, it } from "vitest";

import type { BusinessProfileDraft, ProfileFacts } from "@/lib/business-profile";
import { emptyProfileFacts } from "@/lib/business-profile";

import { createBusinessProfileRepository } from "./profile-supabase";
import type { BusinessProfileTableGateway } from "./profile-gateway";
import type { BusinessProfileRow } from "./profile-mapping";
import { InMemoryBusinessProfileTableGateway } from "./profile-table";
import { BusinessProfileRepositoryError } from "./profile-types";

/**
 * Repository behaviour, exercised against an in-memory gateway. No network, no
 * credentials, no Supabase.
 */

const LEAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const facts = (name = "Salon Test"): ProfileFacts => ({
  ...emptyProfileFacts(),
  "identity.name": [{ value: name, sourceId: "lead-snapshot", kind: "observed" }],
});

const draft = (name?: string): BusinessProfileDraft => ({
  researcher: { name: "mock", version: "no-external-sources-v1" },
  sources: [
    {
      id: "lead-snapshot",
      type: "lead-snapshot",
      reference: "osm:node/1",
      fetchedAt: "2026-09-06T06:00:00.000Z",
      title: "OpenStreetMap",
    },
  ],
  facts: facts(name),
  coverage: [
    { area: "identity", status: "covered", note: "From the stored discovery record." },
    { area: "contact", status: "not-researched", note: "Nothing was consulted." },
    { area: "web", status: "not-researched", note: "Nothing was consulted." },
    { area: "business", status: "not-researched", note: "Nothing was consulted." },
    { area: "reputation", status: "not-researched", note: "Nothing was consulted." },
  ],
  limitations: ["No external source was consulted."],
});

/** A clock that advances one second per call, so ordering is unambiguous. */
function tickingClock(startMs = Date.parse("2026-09-07T10:00:00.000Z")) {
  let ms = startMs;
  return () => new Date((ms += 1000));
}

const repo = (gateway: BusinessProfileTableGateway = new InMemoryBusinessProfileTableGateway()) =>
  createBusinessProfileRepository(gateway, { now: tickingClock() });

const failingGateway = (error: Error): BusinessProfileTableGateway => ({
  insertRow: () => Promise.reject(error),
  findRowById: async () => null,
  listRowsForLead: async () => [],
  listRecentRows: async () => [],
});

describe("create", () => {
  it("assigns identity, status and timestamps the caller did not supply", async () => {
    const profile = await repo().create(LEAD_A, draft());

    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profile.leadId).toBe(LEAD_A);
    expect(profile.status).toBe("complete");
    expect(profile.createdAt).toBe(profile.updatedAt);
  });

  it("gives each run its own id", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, draft());
    const second = await store.create(LEAD_A, draft());
    expect(first.id).not.toBe(second.id);
  });

  it("validates the draft BEFORE writing, and stores nothing when it fails", async () => {
    const gateway = new InMemoryBusinessProfileTableGateway();
    const store = repo(gateway);

    const unattributed = draft();
    unattributed.facts["contact.phone"] = [
      { value: "+1 000", sourceId: "nowhere", kind: "observed" },
    ];

    await expect(store.create(LEAD_A, unattributed)).rejects.toThrow();
    expect(await store.listForLead(LEAD_A)).toEqual([]);
  });

  it("reports a persistence failure without leaking the driver's message", async () => {
    const thrown = await repo(failingGateway(new Error("duplicate key value violates constraint")))
      .create(LEAD_A, draft())
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(BusinessProfileRepositoryError);
    expect((thrown as Error).message).toBe("Could not save the business profile.");
    expect((thrown as Error).message).not.toContain("duplicate key");
    // The detail survives for a server log, on `cause`.
    expect(((thrown as Error).cause as Error).message).toContain("duplicate key");
  });
});

describe("reads", () => {
  it("finds a stored profile by its own id", async () => {
    const store = repo();
    const created = await store.create(LEAD_A, draft());
    expect(await store.findById(created.id)).toEqual(created);
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(await repo().findById("no-such-id")).toBeNull();
  });

  it("lists profiles for a lead newest first", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, draft("First"));
    const second = await store.create(LEAD_A, draft("Second"));
    const third = await store.create(LEAD_A, draft("Third"));

    expect((await store.listForLead(LEAD_A)).map((p) => p.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it("does not mix profiles from another lead", async () => {
    const store = repo();
    await store.create(LEAD_A, draft("A"));
    await store.create(LEAD_B, draft("B"));

    const listed = await store.listForLead(LEAD_A);
    expect(listed).toHaveLength(1);
    expect(listed[0].facts["identity.name"][0].value).toBe("A");
  });

  it("returns the newest profile for a lead", async () => {
    const store = repo();
    await store.create(LEAD_A, draft("Older"));
    const newest = await store.create(LEAD_A, draft("Newer"));

    expect((await store.latestForLead(LEAD_A))?.id).toBe(newest.id);
  });

  it("returns null when a lead has never been researched", async () => {
    expect(await repo().latestForLead(LEAD_A)).toBeNull();
  });

  it("lists recent profiles across every lead, newest first", async () => {
    const store = repo();
    const a = await store.create(LEAD_A, draft("A"));
    const b = await store.create(LEAD_B, draft("B"));

    expect((await store.listRecent(10)).map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await store.listRecent(1)).map((p) => p.id)).toEqual([b.id]);
  });

  it("refuses a nonsensical limit rather than guessing one", async () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(repo().listRecent(bad)).rejects.toBeInstanceOf(BusinessProfileRepositoryError);
    }
  });

  it("rejects a stored row whose facts are no longer attributable", async () => {
    // A row written by an older or broken version must fail loudly on read
    // rather than presenting unsourced values as evidence.
    const corrupted: BusinessProfileRow = {
      id: "id-1",
      lead_id: LEAD_A,
      status: "complete",
      created_at: "2026-09-07T10:00:00.000Z",
      updated_at: "2026-09-07T10:00:00.000Z",
      researcher_name: "mock",
      researcher_version: "v1",
      profile: {
        sources: [],
        facts: { "identity.name": [{ value: "Ghost", sourceId: "gone", kind: "observed" }] },
        coverage: [],
        limitations: [],
      },
    };

    const gateway: BusinessProfileTableGateway = {
      insertRow: async () => undefined,
      findRowById: async () => corrupted,
      listRowsForLead: async () => [corrupted],
      listRecentRows: async () => [corrupted],
    };

    await expect(repo(gateway).findById("id-1")).rejects.toBeInstanceOf(
      BusinessProfileRepositoryError,
    );
    await expect(repo(gateway).listForLead(LEAD_A)).rejects.toBeInstanceOf(
      BusinessProfileRepositoryError,
    );
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
      "listForLead",
      "listRecent",
    ]);
  });

  it("leaves an earlier profile untouched when a newer one is recorded", async () => {
    const store = repo();
    const first = await store.create(LEAD_A, draft("First"));
    await store.create(LEAD_A, draft("Second"));

    // The evidence record for a given date must stay exactly as it was.
    expect(await store.findById(first.id)).toEqual(first);
  });
});
