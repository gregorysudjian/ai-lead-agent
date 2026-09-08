import { describe, expect, it } from "vitest";

import {
  formatOpeningHours,
  formatOpeningHoursLines,
  hasProviderReputation,
} from "./format";
import type { Weekday } from "./types";

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

describe("formatOpeningHoursLines", () => {
  const window = (day: Weekday, opens: string, closes: string) => ({ day, opens, closes });

  it("groups consecutive days that share hours", () => {
    // How a real site writes them. Five identical rows reads as a database
    // dump; "Monday to Friday" reads as a page someone wrote.
    expect(
      formatOpeningHoursLines([
        window("monday", "09:00", "18:00"),
        window("tuesday", "09:00", "18:00"),
        window("wednesday", "09:00", "18:00"),
        window("thursday", "09:00", "18:00"),
        window("friday", "09:00", "18:00"),
        window("saturday", "09:00", "17:00"),
      ]),
    ).toEqual(["Monday to Friday   09:00 - 18:00", "Saturday   09:00 - 17:00"]);
  });

  it("never renders a day as Closed", () => {
    // The property this function exists for. Our type treats an omitted day as
    // closed and the internal record view may say so, but a demo is shown to
    // the OWNER, and OSM tagging is often incomplete. "Saturday: Closed" under
    // the name of a shop that opens on Saturday is the checkable wrong
    // specific that costs the conversation.
    const lines = formatOpeningHoursLines([window("monday", "09:00", "17:00")]);
    expect(lines).toEqual(["Monday   09:00 - 17:00"]);
    expect(lines.join(" ")).not.toContain("Closed");
  });

  it("does not let a run span a day it holds nothing for", () => {
    // "Monday to Friday" across a missing Wednesday would assert hours we do
    // not have. The gap breaks the run instead.
    expect(
      formatOpeningHoursLines([
        window("monday", "09:00", "17:00"),
        window("tuesday", "09:00", "17:00"),
        window("thursday", "09:00", "17:00"),
        window("friday", "09:00", "17:00"),
      ]),
    ).toEqual(["Monday to Tuesday   09:00 - 17:00", "Thursday to Friday   09:00 - 17:00"]);
  });

  it("keeps both windows of a split day", () => {
    expect(
      formatOpeningHoursLines([
        window("tuesday", "11:00", "14:30"),
        window("tuesday", "17:00", "22:00"),
      ]),
    ).toEqual(["Tuesday   11:00 - 14:30, 17:00 - 22:00"]);
  });

  it("does not group days whose hours differ", () => {
    expect(
      formatOpeningHoursLines([
        window("monday", "09:00", "17:00"),
        window("tuesday", "10:00", "18:00"),
      ]),
    ).toEqual(["Monday   09:00 - 17:00", "Tuesday   10:00 - 18:00"]);
  });

  it("returns nothing for an empty schedule, so a caller can fall back", () => {
    expect(formatOpeningHoursLines([])).toEqual([]);
  });

  it("orders lines Monday first regardless of input order", () => {
    expect(
      formatOpeningHoursLines([
        window("sunday", "11:00", "16:00"),
        window("monday", "09:00", "17:00"),
      ]),
    ).toEqual(["Monday   09:00 - 17:00", "Sunday   11:00 - 16:00"]);
  });
});

describe("formatOpeningHours keeps every window", () => {
  it("joins both windows of a split day instead of dropping the second", () => {
    // `find` used to take only the first, silently losing a restaurant's
    // evening service on its own lead record.
    const rows = formatOpeningHours([
      { day: "tuesday", opens: "11:00", closes: "14:30" },
      { day: "tuesday", opens: "17:00", closes: "22:00" },
    ]);
    expect(rows.find((r) => r.day === "Tuesday")?.hours).toBe("11:00 - 14:30, 17:00 - 22:00");
  });
});
