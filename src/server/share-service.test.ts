import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DemoShare } from "@/lib/demo-share";
import type { DemoSite } from "@/lib/demo-site";

/**
 * Resolving a share token.
 *
 * The property under test is the FLATTENING: unknown, expired, revoked and
 * "demo has since been deleted" must all produce exactly the same answer.
 * Anything that distinguishes them confirms to a stranger holding a guess that
 * their token was once real, which is more than they are entitled to learn.
 *
 * Both stores are fakes, so nothing touches a database.
 */

const state = vi.hoisted(() => ({
  shares: new Map<string, unknown>(),
  demos: new Map<string, unknown>(),
  /** Every write the service attempted. Must stay empty for a public read. */
  writes: [] as string[],
}));

vi.mock("@/server/repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/repo")>();
  return {
    ...actual,
    getDemoShareRepository: () => ({
      async create() {
        state.writes.push("create");
        throw new Error("not used");
      },
      async findByToken(token: string) {
        return (state.shares.get(token) as DemoShare | undefined) ?? null;
      },
      async listForDemo() {
        return [];
      },
      async revoke() {
        state.writes.push("revoke");
        return null;
      },
    }),
    getDemoSiteRepository: () => ({
      async findById(id: string) {
        return (state.demos.get(id) as DemoSite | undefined) ?? null;
      },
      async create() {
        state.writes.push("demo.create");
        throw new Error("not used");
      },
      async listForLead() {
        return [];
      },
      async listForAnalysis() {
        return [];
      },
      async latestForLead() {
        return null;
      },
      async listRecent() {
        return [];
      },
    }),
  };
});

const { resolveSharedDemo } = await import("./share-service");

const TOKEN = "t".repeat(43);

function share(over: Partial<DemoShare> = {}): DemoShare {
  return {
    id: "share-1",
    demoId: "demo-1",
    token: TOKEN,
    createdAt: "2026-01-01T00:00:00.000Z",
    // Far enough out that the real clock cannot expire it mid-suite.
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
    note: null,
    ...over,
  };
}

const demo = { id: "demo-1", leadId: "lead-1" } as unknown as DemoSite;

beforeEach(() => {
  state.shares.clear();
  state.demos.clear();
  state.writes = [];
  state.demos.set("demo-1", demo);
});

describe("a usable token resolves", () => {
  it("returns the demo the share points at", async () => {
    state.shares.set(TOKEN, share());
    expect(await resolveSharedDemo(TOKEN)).toBe(demo);
  });
});

describe("every unusable state looks identical", () => {
  it("returns null for a token that was never issued", async () => {
    expect(await resolveSharedDemo(TOKEN)).toBeNull();
  });

  it("returns null for an expired share", async () => {
    state.shares.set(TOKEN, share({ expiresAt: "2020-01-01T00:00:00.000Z" }));
    expect(await resolveSharedDemo(TOKEN)).toBeNull();
  });

  it("returns null for a revoked share", async () => {
    state.shares.set(TOKEN, share({ revokedAt: "2026-01-02T00:00:00.000Z" }));
    expect(await resolveSharedDemo(TOKEN)).toBeNull();
  });

  it("returns null when the demo behind a live share is gone", async () => {
    state.shares.set(TOKEN, share());
    state.demos.clear();
    expect(await resolveSharedDemo(TOKEN)).toBeNull();
  });

  it("gives the same answer for all four, so none can be told apart", async () => {
    const answers: unknown[] = [];

    answers.push(await resolveSharedDemo(TOKEN));

    state.shares.set(TOKEN, share({ expiresAt: "2020-01-01T00:00:00.000Z" }));
    answers.push(await resolveSharedDemo(TOKEN));

    state.shares.set(TOKEN, share({ revokedAt: "2026-01-02T00:00:00.000Z" }));
    answers.push(await resolveSharedDemo(TOKEN));

    state.shares.set(TOKEN, share());
    state.demos.clear();
    answers.push(await resolveSharedDemo(TOKEN));

    expect(answers).toEqual([null, null, null, null]);
  });
});

describe("a malformed token never reaches the store", () => {
  it("rejects lengths outside what is ever issued", async () => {
    // Cheap guard against someone hammering the endpoint with junk: a value
    // that could not be a token is not worth a database round trip.
    for (const token of ["", "short", "x".repeat(31), "x".repeat(129)]) {
      expect(await resolveSharedDemo(token)).toBeNull();
    }
  });

  it("rejects a non-string without throwing", async () => {
    expect(await resolveSharedDemo(undefined as unknown as string)).toBeNull();
    expect(await resolveSharedDemo(null as unknown as string)).toBeNull();
  });
});

describe("resolving is a read", () => {
  it("writes nothing, however the token resolves", async () => {
    // A public page that recorded a view would be a write driven by an
    // unauthenticated request, and anyone holding the token could drive it.
    state.shares.set(TOKEN, share());
    await resolveSharedDemo(TOKEN);
    await resolveSharedDemo("x".repeat(43));

    state.shares.set(TOKEN, share({ revokedAt: "2026-01-02T00:00:00.000Z" }));
    await resolveSharedDemo(TOKEN);

    expect(state.writes).toEqual([]);
  });
});
