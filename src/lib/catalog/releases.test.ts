import { describe, expect, it } from "vitest";

import { assessRefresh, compareReleases, nextReleaseToLoad, parseReleaseListing } from "./releases";

const listing = (...prefixes: string[]) =>
  `<?xml version="1.0"?><ListBucketResult>${prefixes
    .map((p) => `<CommonPrefixes><Prefix>${p}</Prefix></CommonPrefixes>`)
    .join("")}</ListBucketResult>`;

describe("parseReleaseListing", () => {
  it("reads release names from the bucket listing, oldest first", () => {
    expect(
      parseReleaseListing(listing("release/2026-08-19.0/", "release/2026-07-22.0/", "release/2026-09-16.1/")),
    ).toEqual(["2026-07-22.0", "2026-08-19.0", "2026-09-16.1"]);
  });

  it("ignores anything that is not a well-formed release name", () => {
    expect(
      parseReleaseListing(
        listing("release/latest/", "release/2026-08-19.0/", "release/2026-08-19.0/", "release/../x/", "release/2026-8-1.0/"),
      ),
    ).toEqual(["2026-08-19.0"]);
    expect(parseReleaseListing("not xml at all")).toEqual([]);
  });
});

describe("compareReleases", () => {
  it("orders by date, then by revision as a number", () => {
    expect(compareReleases("2026-08-19.0", "2026-09-16.0")).toBeLessThan(0);
    expect(compareReleases("2026-09-16.10", "2026-09-16.2")).toBeGreaterThan(0);
    expect(compareReleases("2026-09-16.0", "2026-09-16.0")).toBe(0);
  });
});

describe("nextReleaseToLoad", () => {
  const available = ["2026-07-22.0", "2026-08-19.0", "2026-09-16.0"];

  it("picks the newest release when it is newer than the one loaded", () => {
    expect(nextReleaseToLoad(available, "2026-08-19.0")).toBe("2026-09-16.0");
  });

  it("is null when the catalog already has the newest", () => {
    expect(nextReleaseToLoad(available, "2026-09-16.0")).toBeNull();
    expect(nextReleaseToLoad(["2026-08-19.0"], "2026-08-19.0")).toBeNull();
  });

  it("never goes backwards", () => {
    expect(nextReleaseToLoad(["2026-07-22.0"], "2026-08-19.0")).toBeNull();
  });

  it("loads the newest when nothing is loaded yet, and nothing when nothing is published", () => {
    expect(nextReleaseToLoad(available, null)).toBe("2026-09-16.0");
    expect(nextReleaseToLoad([], null)).toBeNull();
  });
});

describe("assessRefresh (the circuit breaker)", () => {
  it("lets a normal month through", () => {
    expect(assessRefresh({ listedNow: 2821, incoming: 2790 })).toEqual({ ok: true });
    expect(assessRefresh({ listedNow: 2821, incoming: 3100 })).toEqual({ ok: true });
  });

  it("stops a release far smaller than today's list", () => {
    const result = assessRefresh({ listedNow: 2821, incoming: 1400 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/50% of the 2821/);
  });

  it("stops an empty release, and allows the very first load", () => {
    expect(assessRefresh({ listedNow: 2821, incoming: 0 }).ok).toBe(false);
    expect(assessRefresh({ listedNow: 0, incoming: 2800 })).toEqual({ ok: true });
  });
});
