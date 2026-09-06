import { describe, expect, it } from "vitest";

import { hasProviderReputation } from "./format";

/**
 * Regression coverage for a real-data presentation bug: with 95 live OSM leads,
 * every single row rendered an identical "Unrated - Reviews unknown" line,
 * because OpenStreetMap supplies neither field. Dense views now omit the line
 * when there is nothing to say.
 */
describe("hasProviderReputation", () => {
  it("is false when the provider supplied neither rating nor review count", () => {
    // This is every OSM lead.
    expect(hasProviderReputation({ rating: null, reviewCount: null })).toBe(false);
  });

  it.each([
    ["a rating only", { rating: 4.5, reviewCount: null }],
    ["a review count only", { rating: null, reviewCount: 128 }],
    ["both", { rating: 4.5, reviewCount: 128 }],
    ["zero reviews, which is a fact worth showing", { rating: null, reviewCount: 0 }],
  ])("is true with %s", (_label, provider) => {
    expect(hasProviderReputation(provider)).toBe(true);
  });

  it.each([
    ["an out-of-range rating", { rating: 9.9, reviewCount: null }],
    ["a negative review count", { rating: null, reviewCount: -5 }],
    ["NaN values", { rating: Number.NaN, reviewCount: Number.NaN }],
    ["infinite values", { rating: Number.POSITIVE_INFINITY, reviewCount: Number.POSITIVE_INFINITY }],
  ])("is false for unusable data: %s", (_label, provider) => {
    // Unusable values must not cause a reputation line that says nothing real.
    expect(hasProviderReputation(provider)).toBe(false);
  });
});
