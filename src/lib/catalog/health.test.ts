import { describe, expect, it } from "vitest";

import { refreshLooksStalled, STALLED_AFTER_DAYS } from "./health";

const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe("refreshLooksStalled", () => {
  it("stays quiet through a normal gap between monthly releases", () => {
    expect(refreshLooksStalled(daysAgo(6), NOW)).toBe(false);
    expect(refreshLooksStalled(daysAgo(40), NOW)).toBe(false);
    expect(refreshLooksStalled(daysAgo(STALLED_AFTER_DAYS - 1), NOW)).toBe(false);
  });

  it("speaks up past any normal gap", () => {
    expect(refreshLooksStalled(daysAgo(STALLED_AFTER_DAYS + 1), NOW)).toBe(true);
    // The autumn 2026 failure: last success 2026-09-21, unnoticed until 2026-11-15.
    expect(refreshLooksStalled("2026-09-21T16:00:00.000Z", NOW)).toBe(true);
  });

  it("says nothing it cannot back", () => {
    expect(refreshLooksStalled(null, NOW)).toBe(false);
    expect(refreshLooksStalled("not a date", NOW)).toBe(false);
  });
});
