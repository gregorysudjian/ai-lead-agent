import { describe, expect, it } from "vitest";

import type { DiscoveredBusiness } from "../types";
import {
  compareCandidates,
  groupIntoCandidates,
  matchReasonFor,
  phoneDigits,
  type CandidateObservation,
  type DiscoveryCandidate,
  type DiscoverySourceName,
} from "./candidates";

/** Pure module: no network, no clock, no store. */

const AT = "2026-09-07T12:00:00.000Z";

function business(
  source: DiscoverySourceName,
  externalId: string,
  over: Partial<DiscoveredBusiness> = {},
): DiscoveredBusiness {
  return {
    externalId,
    source,
    name: "G&G Barbershop",
    category: "Barber shop",
    city: "Montreal",
    address: "28 Avenue des Pins Est",
    phone: "+1 514 844 4384",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
    ...over,
  };
}

const observe = (b: DiscoveredBusiness): CandidateObservation => ({
  source: b.source as DiscoverySourceName,
  externalId: b.externalId,
  business: b,
});

const group = (...businesses: DiscoveredBusiness[]) =>
  groupIntoCandidates(businesses.map(observe));

describe("phone digits are compared, never reformatted", () => {
  it("keeps only digits", () => {
    expect(phoneDigits("+1 (514) 844-4384")).toBe("15148444384");
  });

  it("refuses a string too short to be a number", () => {
    expect(phoneDigits("911")).toBeNull();
    expect(phoneDigits("1234567")).toBeNull();
  });

  it("does not strip a country code", () => {
    // Stripping it would make +1 514 844 4384 and 514 844 4384 look equal, and
    // in the general case that is a different number, not the same one.
    expect(phoneDigits("+15148444384")).not.toBe(phoneDigits("5148444384"));
  });

  it("treats a missing number as missing", () => {
    expect(phoneDigits(null)).toBeNull();
  });
});

describe("matching is exact, and refuses to guess", () => {
  it("matches the same record from the same source", () => {
    expect(matchReasonFor(business("osm", "node/1"), business("osm", "node/1"))).toBe(
      "same-source-id",
    );
  });

  it("matches across sources on exact name and address", () => {
    expect(
      matchReasonFor(business("osm", "node/1"), business("google", "ChIJabc")),
    ).toBe("name-and-address");
  });

  it("matches across sources on exact name and phone when addresses are written differently", () => {
    const osm = business("osm", "node/1", { address: "28 Avenue des Pins Est" });
    const google = business("google", "ChIJabc", { address: "28 Av. des Pins E, Montreal" });
    expect(matchReasonFor(osm, google)).toBe("name-and-phone");
  });

  it("ignores accent, case and spacing differences in the name", () => {
    const a = business("osm", "node/1", { name: "Salon Beauté  Milano" });
    const b = business("google", "ChIJabc", { name: "salon beaute milano" });
    expect(matchReasonFor(a, b)).toBe("name-and-address");
  });

  it("keeps the same name at different addresses separate", () => {
    const a = business("osm", "node/1", { address: "28 Avenue des Pins Est", phone: null });
    const b = business("google", "ChIJabc", { address: "900 Rue Sainte-Catherine", phone: null });
    expect(matchReasonFor(a, b)).toBeNull();
  });

  it("keeps similar but not identical names separate", () => {
    // No edit distance, no token overlap, no threshold. "Looks close" is not
    // evidence, and a false merge destroys a real lead silently.
    for (const name of [
      "G&G Barbershop Inc",
      "GG Barbershop",
      "G&G Barber shop",
      "G&G Barbershop 2",
    ]) {
      const other = business("google", "ChIJabc", { name });
      expect(matchReasonFor(business("osm", "node/1"), other), name).toBeNull();
    }
  });

  it("never matches on phone alone", () => {
    // A mall reception or a chain gives several distinct businesses one number.
    const a = business("osm", "node/1", { name: "Salon A", address: null });
    const b = business("google", "ChIJabc", { name: "Salon B", address: null });
    expect(matchReasonFor(a, b)).toBeNull();
  });

  it("never matches on address alone", () => {
    const a = business("osm", "node/1", { name: "Salon A", phone: null });
    const b = business("google", "ChIJabc", { name: "Salon B", phone: null });
    expect(matchReasonFor(a, b)).toBeNull();
  });

  it("treats a missing address or phone as unknown, not as a wildcard", () => {
    const a = business("osm", "node/1", { address: null, phone: null });
    const b = business("google", "ChIJabc", { address: null, phone: null });
    expect(matchReasonFor(a, b)).toBeNull();
  });

  it("does not match on an empty or whitespace name", () => {
    const a = business("osm", "node/1", { name: "   " });
    const b = business("google", "ChIJabc", { name: "" });
    expect(matchReasonFor(a, b)).toBeNull();
  });

  it("does not treat different sources sharing an external id as the same record", () => {
    const a = business("osm", "same-id", { name: "Salon A", address: "1 A St", phone: null });
    const b = business("google", "same-id", { name: "Salon B", address: "2 B St", phone: null });
    expect(matchReasonFor(a, b)).toBeNull();
  });
});

describe("grouping preserves every source identity", () => {
  it("groups an OSM and a Google record into one candidate", () => {
    const [candidate] = group(business("osm", "node/1"), business("google", "ChIJabc"));

    expect(candidate.foundBy).toEqual(["osm", "google"]);
    expect(candidate.observations).toHaveLength(2);
    expect(candidate.matchedBy).toEqual(["name-and-address"]);
  });

  it("keeps both provider identities rather than erasing one", () => {
    const [candidate] = group(business("osm", "node/1"), business("google", "ChIJabc"));

    expect(candidate.observations.map((o) => `${o.source}:${o.externalId}`)).toEqual([
      "osm:node/1",
      "google:ChIJabc",
    ]);
    expect(candidate.candidateId).toBe("google:ChIJabc|osm:node/1");
  });

  it("collapses a duplicate from one source", () => {
    const candidates = group(business("osm", "node/1"), business("osm", "node/1"));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].matchedBy).toEqual(["same-source-id"]);
  });

  it("leaves two different businesses as two candidates", () => {
    const candidates = group(
      business("osm", "node/1", { name: "Salon A", address: "1 A St", phone: null }),
      business("google", "ChIJabc", { name: "Salon B", address: "2 B St", phone: null }),
    );
    expect(candidates).toHaveLength(2);
  });

  it("produces the same grouping whatever order the sources answered in", () => {
    const osm = business("osm", "node/1");
    const google = business("google", "ChIJabc");

    const forward = groupIntoCandidates([observe(osm), observe(google)]);
    const backward = groupIntoCandidates([observe(google), observe(osm)]);

    expect(forward).toEqual(backward);
  });

  it("matches against every member of a group, not only the first", () => {
    // The first member has the address, the second has the phone: a third
    // record sharing only the phone still belongs to the same business.
    const first = business("osm", "node/1", { phone: null });
    const second = business("google", "ChIJabc");
    const third = business("mock", "m-1", { address: "written differently" });

    const candidates = groupIntoCandidates([observe(first), observe(second), observe(third)]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].foundBy).toEqual(["osm", "google", "mock"]);
  });
});

describe("display values are resolved, and attributed", () => {
  it("prefers OpenStreetMap and names the source of each field", () => {
    const [candidate] = group(
      business("osm", "node/1", { category: "Barber shop" }),
      business("google", "ChIJabc", { category: "Barber" }),
    );

    expect(candidate.display.category).toEqual({ value: "Barber shop", source: "osm" });
  });

  it("falls back to another source for a field the preferred one lacks", () => {
    const [candidate] = group(
      business("osm", "node/1", { website: null }),
      business("google", "ChIJabc", { website: "https://ggbarbershop.com/" }),
    );

    expect(candidate.display.website).toEqual({
      value: "https://ggbarbershop.com/",
      source: "google",
    });
  });

  it("records which sources listed a website, not whether one exists", () => {
    const [none] = group(business("osm", "node/1", { website: null }));
    expect(none.display.websiteListedBy).toEqual([]);

    const [some] = group(
      business("osm", "node/1", { website: null }),
      business("google", "ChIJabc", { website: "https://x.example/" }),
    );
    expect(some.display.websiteListedBy).toEqual(["google"]);
  });

  it("treats a whitespace-only value as absent", () => {
    const [candidate] = group(business("osm", "node/1", { address: "   ", phone: "  " }));
    expect(candidate.display.address).toBeNull();
    expect(candidate.display.phone).toBeNull();
  });
});

describe("ordering is deterministic and is not a ranking", () => {
  const withState = (c: ReturnType<typeof group>[number]): DiscoveryCandidate => ({
    ...c,
    state: "can-add",
    existingLeadId: null,
  });

  it("orders by display name, then candidate id", () => {
    const a = withState(group(business("osm", "node/1", { name: "Alpha" }))[0]);
    const b = withState(group(business("osm", "node/2", { name: "Beta" }))[0]);

    expect([b, a].sort(compareCandidates).map((c) => c.display.name.value)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("does not order by rating, review count or number of sources", () => {
    const popular = withState(
      group(business("osm", "node/1", { name: "Zeta", rating: 5, reviewCount: 900 }))[0],
    );
    const obscure = withState(
      group(business("osm", "node/2", { name: "Alpha", rating: null, reviewCount: null }))[0],
    );

    expect([popular, obscure].sort(compareCandidates)[0].display.name.value).toBe("Alpha");
  });
});
