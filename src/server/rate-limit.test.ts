import { beforeEach, describe, expect, it } from "vitest";

import {
  checkRateLimit,
  clientIdentity,
  RATE_LIMITS,
  resetRateLimits,
  type RateLimitName,
} from "./rate-limit";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const { limit } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) {
      expect(checkRateLimit("search", "operator", NOW).allowed).toBe(true);
    }
  });

  it("blocks the request after the limit", () => {
    const { limit } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    const blocked = checkRateLimit("search", "operator", NOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts down the remaining allowance", () => {
    const { limit } = RATE_LIMITS.search;
    expect(checkRateLimit("search", "operator", NOW).remaining).toBe(limit - 1);
    expect(checkRateLimit("search", "operator", NOW).remaining).toBe(limit - 2);
  });

  it("reports a positive retry delay when blocked", () => {
    const { limit, windowMs } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    const blocked = checkRateLimit("search", "operator", NOW);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(windowMs / 1000);
  });

  it("never reports a zero-second retry, which would invite an instant retry", () => {
    const { limit, windowMs } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    // One millisecond before the window closes: the honest answer rounds up.
    const blocked = checkRateLimit("search", "operator", NOW + windowMs - 1);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it("opens a fresh window once the old one expires", () => {
    const { limit, windowMs } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);
    expect(checkRateLimit("search", "operator", NOW).allowed).toBe(false);

    const after = checkRateLimit("search", "operator", NOW + windowMs);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(limit - 1);
  });

  it("keeps separate counters per identity", () => {
    const { limit } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    expect(checkRateLimit("search", "operator", NOW).allowed).toBe(false);
    expect(checkRateLimit("search", "someone-else", NOW).allowed).toBe(true);
  });

  it("keeps separate counters per rule", () => {
    const { limit } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    // Exhausting search must not spend the analysis allowance.
    expect(checkRateLimit("search", "operator", NOW).allowed).toBe(false);
    expect(checkRateLimit("analysis", "operator", NOW).allowed).toBe(true);
  });

  it("does not let a blocked request extend its own window", () => {
    // A sliding-window bug: counting rejected attempts pushes resetAt out and
    // locks the caller out forever. The window must end when it was going to.
    const { limit, windowMs } = RATE_LIMITS.search;
    for (let i = 0; i < limit; i += 1) checkRateLimit("search", "operator", NOW);

    for (let t = 0; t < windowMs; t += windowMs / 10) {
      expect(checkRateLimit("search", "operator", NOW + t).allowed).toBe(false);
    }
    expect(checkRateLimit("search", "operator", NOW + windowMs).allowed).toBe(true);
  });

  it("forgets expired windows rather than growing without bound", () => {
    const { windowMs } = RATE_LIMITS.search;
    for (let i = 0; i < 500; i += 1) checkRateLimit("search", `caller-${i}`, NOW);

    // A later request sweeps the expired entries. Observable only indirectly:
    // every one of those callers starts clean.
    const fresh = checkRateLimit("search", "caller-0", NOW + windowMs + 1);
    expect(fresh.remaining).toBe(RATE_LIMITS.search.limit - 1);
  });
});

describe("RATE_LIMITS", () => {
  it("covers every route that reaches a third party, spends money, or is public", () => {
    const expected: RateLimitName[] = [
      // Reach a third party or spend money.
      "search",
      "discovery",
      "research",
      "researchBatch",
      "analysis",
      "demo",
      // Unauthenticated surfaces, where the limit guards us rather than them.
      "signIn",
      "sharedDemo",
    ];
    expect(Object.keys(RATE_LIMITS).sort()).toEqual([...expected].sort());
  });

  it("limits every unauthenticated surface", () => {
    // The two routes reachable without a session. A public route added without
    // a limit is the kind of omission this catches.
    expect(RATE_LIMITS.signIn).toBeDefined();
    expect(RATE_LIMITS.sharedDemo).toBeDefined();
  });

  it("lets a real recipient reload a shared demo without being blocked", () => {
    // The limit is there to slow enumeration and replay, not to frustrate the
    // business owner the link was made for.
    expect(RATE_LIMITS.sharedDemo.limit).toBeGreaterThanOrEqual(30);
  });

  it("states every rule as a positive limit over a positive window", () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, name).toBeGreaterThan(0);
      expect(rule.windowMs, name).toBeGreaterThan(0);
    }
  });

  it("keeps the batch research rule the scarcest", () => {
    // A batch touches many businesses' servers in one request, so it must not
    // be as freely available as a single-lead run.
    expect(RATE_LIMITS.researchBatch.limit).toBeLessThan(RATE_LIMITS.research.limit);
  });
});

describe("clientIdentity", () => {
  it("uses the left-most x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIdentity({ headers })).toBe("203.0.113.7");
  });

  it("handles a single address", () => {
    expect(clientIdentity({ headers: new Headers({ "x-forwarded-for": "203.0.113.7" }) }))
      .toBe("203.0.113.7");
  });

  it("falls back when the header is absent or empty", () => {
    expect(clientIdentity({ headers: new Headers() })).toBe("unknown");
    expect(clientIdentity({ headers: new Headers({ "x-forwarded-for": "" }) })).toBe("unknown");
    expect(clientIdentity({ headers: new Headers({ "x-forwarded-for": " , " }) })).toBe("unknown");
  });

  it("groups unidentifiable callers together rather than exempting them", () => {
    // "unknown" is a shared bucket on purpose: callers we cannot tell apart
    // share one allowance instead of each getting an unlimited one.
    const a = clientIdentity({ headers: new Headers() });
    const b = clientIdentity({ headers: new Headers() });
    expect(a).toBe(b);
  });
});
