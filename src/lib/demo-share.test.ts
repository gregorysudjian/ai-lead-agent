import { describe, expect, it } from "vitest";

import {
  DEFAULT_SHARE_DAYS,
  MAX_SHARE_DAYS,
  MIN_SHARE_DAYS,
  isShareViewable,
  shareExpiry,
  sharePath,
  shareState,
  type DemoShare,
} from "./demo-share";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function share(over: Partial<DemoShare> = {}): DemoShare {
  return {
    id: "share-1",
    demoId: "demo-1",
    token: "a".repeat(43),
    createdAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-07-01T00:00:00.000Z",
    revokedAt: null,
    note: null,
    ...over,
  };
}

describe("shareState", () => {
  it("is active for a live share", () => {
    expect(shareState(share(), NOW)).toBe("active");
    expect(isShareViewable(share(), NOW)).toBe(true);
  });

  it("is expired once the instant has passed", () => {
    expect(shareState(share({ expiresAt: "2026-05-01T00:00:00.000Z" }), NOW)).toBe("expired");
    expect(isShareViewable(share({ expiresAt: "2026-05-01T00:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is expired at the exact instant it expires", () => {
    // Inclusive, matching how the session token treats its own expiry.
    expect(shareState(share({ expiresAt: NOW.toISOString() }), NOW)).toBe("expired");
  });

  it("is active one millisecond before expiry", () => {
    const expiresAt = new Date(NOW.getTime() + 1).toISOString();
    expect(shareState(share({ expiresAt }), NOW)).toBe("active");
  });

  it("is revoked once withdrawn", () => {
    expect(shareState(share({ revokedAt: "2026-06-01T09:00:00.000Z" }), NOW)).toBe("revoked");
    expect(isShareViewable(share({ revokedAt: "2026-06-01T09:00:00.000Z" }), NOW)).toBe(false);
  });

  it("reports revoked ahead of expired when both are true", () => {
    // A link that was deliberately withdrawn is revoked, whatever the calendar
    // says. The visitor is told neither, but the record should be precise.
    const both = share({ expiresAt: "2026-05-01T00:00:00.000Z", revokedAt: "2026-04-01T00:00:00.000Z" });
    expect(shareState(both, NOW)).toBe("revoked");
  });

  it("treats an unparseable expiry as expired rather than as usable", () => {
    // Fails closed. A corrupt row must not become a permanently open link.
    expect(shareState(share({ expiresAt: "not a date" }), NOW)).toBe("expired");
  });
});

describe("shareExpiry", () => {
  it("adds the requested number of days", () => {
    expect(shareExpiry(7, NOW)).toBe("2026-06-08T12:00:00.000Z");
  });

  it("clamps below the minimum and above the maximum", () => {
    // Total rather than throwing: no path may produce a share with an absurd
    // expiry, whatever a caller passes.
    expect(shareExpiry(0, NOW)).toBe(shareExpiry(MIN_SHARE_DAYS, NOW));
    expect(shareExpiry(-30, NOW)).toBe(shareExpiry(MIN_SHARE_DAYS, NOW));
    expect(shareExpiry(9999, NOW)).toBe(shareExpiry(MAX_SHARE_DAYS, NOW));
  });

  it("falls back to the default for a value that is not a number", () => {
    // Including Infinity, which reads as "forever". Falling back to the
    // default rather than clamping to the maximum is the conservative answer:
    // a caller who asked for nonsense gets the ordinary 30 days, not the
    // longest link the system will issue.
    expect(shareExpiry(Number.NaN, NOW)).toBe(shareExpiry(DEFAULT_SHARE_DAYS, NOW));
    expect(shareExpiry(Number.POSITIVE_INFINITY, NOW)).toBe(shareExpiry(DEFAULT_SHARE_DAYS, NOW));
    expect(shareExpiry(Number.NEGATIVE_INFINITY, NOW)).toBe(shareExpiry(DEFAULT_SHARE_DAYS, NOW));
  });

  it("never produces a share that is already expired", () => {
    for (const days of [-100, 0, 0.4, 1, 30, 90, 1000]) {
      const expiresAt = shareExpiry(days, NOW);
      expect(shareState(share({ expiresAt }), NOW), String(days)).toBe("active");
    }
  });

  it("never produces one lasting longer than the maximum", () => {
    const latest = new Date(NOW.getTime() + MAX_SHARE_DAYS * 24 * 60 * 60 * 1000).getTime();
    for (const days of [1, 30, 90, 500]) {
      expect(Date.parse(shareExpiry(days, NOW))).toBeLessThanOrEqual(latest);
    }
  });
});

describe("sharePath", () => {
  it("serves a token from a short prefix", () => {
    // Read aloud, typed from a card, put in a text message. Every character of
    // the prefix is one the recipient has to get right.
    expect(sharePath("abc123")).toBe("/s/abc123");
  });
});
