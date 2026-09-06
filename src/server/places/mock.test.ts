import { describe, expect, it } from "vitest";

import { mockPlacesProvider } from "./mock";

/**
 * The mock provider searches a finite in-memory fixture set exhaustively, so a
 * result is never capped and `truncated` must always be false. This matters
 * because the dashboard shows a truncation notice purely from provider metadata.
 */
describe("mock provider search metadata", () => {
  it("reports truncated false and no limit", async () => {
    const result = await mockPlacesProvider.search({
      category: "hair salons",
      city: "Montreal",
    });
    expect(result.meta).toEqual({ truncated: false, limit: null });
    expect(result.businesses.length).toBe(14);
  });

  it("reports truncated false for an empty result too", async () => {
    const result = await mockPlacesProvider.search({
      category: "hair salons",
      city: "Atlantis",
    });
    expect(result.businesses).toEqual([]);
    expect(result.meta.truncated).toBe(false);
  });

  it("still returns fixture businesses with mock provenance", async () => {
    const { businesses } = await mockPlacesProvider.search({
      category: "hair salons",
      city: "Montreal",
    });
    expect(businesses.every((b) => b.source === "mock")).toBe(true);
  });
});
