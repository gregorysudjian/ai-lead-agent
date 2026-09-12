import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkSharedSignInLimit,
  hashVisitor,
  MAX_FAILURES_PER_VISITOR,
  MAX_FAILURES_SITEWIDE,
  recordSignInOutcome,
  signInDecision,
  type AttemptStore,
} from "./sign-in-attempts";

function memoryStore(): AttemptStore & { rows: { identity: string; at: number }[] } {
  const rows: { identity: string; at: number }[] = [];
  return {
    rows,
    async failuresSince(identity, since) {
      const recent = rows.filter((r) => r.at >= since.getTime());
      return { visitor: recent.filter((r) => r.identity === identity).length, sitewide: recent.length };
    },
    async recordFailure(identity, now) {
      rows.push({ identity, at: now.getTime() });
    },
    async clearFailures(identity) {
      for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].identity === identity) rows.splice(i, 1);
    },
  };
}

const failing: AttemptStore = {
  failuresSince: async () => {
    throw new Error("auth_attempts count failed [PGRST205].");
  },
  recordFailure: async () => {
    throw new Error("insert failed");
  },
  clearFailures: async () => {
    throw new Error("delete failed");
  },
};

afterEach(() => vi.restoreAllMocks());

describe("signInDecision", () => {
  it("allows until a visitor reaches the limit", () => {
    expect(signInDecision({ visitor: MAX_FAILURES_PER_VISITOR - 1, sitewide: 0 })).toEqual({ allowed: true });
    expect(signInDecision({ visitor: MAX_FAILURES_PER_VISITOR, sitewide: 0 })).toMatchObject({ allowed: false, reason: "visitor" });
  });

  it("pauses everyone when failures pile up across many visitors", () => {
    expect(signInDecision({ visitor: 0, sitewide: MAX_FAILURES_SITEWIDE })).toMatchObject({ allowed: false, reason: "sitewide" });
  });
});

describe("hashVisitor", () => {
  it("is stable, keyed, and does not contain the address", () => {
    const a = hashVisitor("203.0.113.7", "s".repeat(32));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(hashVisitor("203.0.113.7", "s".repeat(32)));
    expect(a).not.toBe(hashVisitor("203.0.113.7", "t".repeat(32)));
    expect(a).not.toBe(hashVisitor("203.0.113.8", "s".repeat(32)));
    expect(a).not.toContain("203");
  });
});

describe("the shared limit", () => {
  it("blocks a visitor after repeated failures, and a success clears them", async () => {
    const store = memoryStore();
    const now = new Date("2026-09-13T03:00:00Z");
    for (let i = 0; i < MAX_FAILURES_PER_VISITOR; i += 1) await recordSignInOutcome(store, "v1", false, now);
    expect(await checkSharedSignInLimit(store, "v1", now)).toMatchObject({ allowed: false });
    expect(await checkSharedSignInLimit(store, "v2", now)).toEqual({ allowed: true });

    await recordSignInOutcome(store, "v1", true, now);
    expect(await checkSharedSignInLimit(store, "v1", now)).toEqual({ allowed: true });
  });

  it("forgets failures older than the window", async () => {
    const store = memoryStore();
    const then = new Date("2026-09-13T03:00:00Z");
    for (let i = 0; i < MAX_FAILURES_PER_VISITOR; i += 1) await recordSignInOutcome(store, "v1", false, then);
    const later = new Date(then.getTime() + 16 * 60 * 1000);
    expect(await checkSharedSignInLimit(store, "v1", later)).toEqual({ allowed: true });
  });

  it("never locks anyone out because the store is missing or failing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await checkSharedSignInLimit(null, "v1")).toEqual({ allowed: true });
    expect(await checkSharedSignInLimit(failing, "v1")).toEqual({ allowed: true });
    await expect(recordSignInOutcome(failing, "v1", false)).resolves.toBeUndefined();
    await expect(recordSignInOutcome(failing, "v1", true)).resolves.toBeUndefined();
  });
});
