import { describe, expect, it } from "vitest";

import { findExistingLead } from "./dedupe";
import type { DiscoveredBusiness, Lead } from "./types";

/**
 * Retroactive unit coverage for the Phase 2 deduplication invariants.
 *
 * The costly failure here is a FALSE MERGE: two different businesses collapsing
 * into one silently destroys a real lead. These tests exist mainly to pin down
 * the cases where matching must NOT happen.
 */
function business(overrides: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness {
  return {
    externalId: "ext-1",
    source: "mock",
    name: "Salon Verdurette",
    category: "hair salon",
    city: "Montreal",
    address: "4821 Rue Saint-Denis, Montreal, QC",
    phone: null,
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function lead(provider: Partial<DiscoveredBusiness> = {}, id = "lead-1"): Lead {
  return {
    id,
    status: "new",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: business(provider),
  };
}

describe("primary match: source + externalId", () => {
  it("matches the same provider identifier", () => {
    const match = findExistingLead([lead()], business());
    expect(match?.reason).toBe("provider-id");
    expect(match?.lead.id).toBe("lead-1");
  });

  it("matches on identifier even when every other field changed", () => {
    const match = findExistingLead(
      [lead()],
      business({ name: "Totally Renamed", address: "9 Elsewhere Ave", rating: 4.9 }),
    );
    expect(match?.reason).toBe("provider-id");
  });

  it("does not match the same externalId from a different source", () => {
    const match = findExistingLead(
      [lead()],
      business({ source: "google", name: "Other Co", address: "9 Elsewhere Ave" }),
    );
    expect(match).toBeNull();
  });

  it("prefers an exact identifier match over a weaker name+address match", () => {
    const leads = [
      lead({ externalId: "ext-other" }, "by-name-address"),
      lead({ externalId: "ext-1", name: "Renamed", address: "9 Elsewhere" }, "by-id"),
    ];
    expect(findExistingLead(leads, business())?.lead.id).toBe("by-id");
  });
});

describe("secondary match: normalized name + address", () => {
  it("matches when the provider re-lists a business under a new externalId", () => {
    const match = findExistingLead([lead()], business({ externalId: "ext-RELISTED" }));
    expect(match?.reason).toBe("name-and-address");
    expect(match?.lead.id).toBe("lead-1");
  });

  it("ignores case, accents and extra whitespace", () => {
    const match = findExistingLead(
      [lead({ name: "Salon Verdurette", address: "4821 Rue Saint-Denis, Montreal, QC" })],
      business({
        externalId: "ext-new",
        name: "  SALON   VERDURETTE ",
        address: "4821 RUE SAINT-DENIS, MONTREAL, QC",
      }),
    );
    expect(match?.reason).toBe("name-and-address");
  });

  it("matches across sources at the same name and address", () => {
    const match = findExistingLead(
      [lead()],
      business({ source: "google", externalId: "place-abc" }),
    );
    expect(match?.reason).toBe("name-and-address");
  });
});

describe("must NOT merge", () => {
  it("does not merge on name alone when the candidate has no address", () => {
    expect(findExistingLead([lead()], business({ externalId: "x", address: null }))).toBeNull();
  });

  it("does not merge on name alone when the stored lead has no address", () => {
    expect(
      findExistingLead([lead({ address: null })], business({ externalId: "x" })),
    ).toBeNull();
  });

  it("does not merge two businesses that both lack an address", () => {
    expect(
      findExistingLead([lead({ address: null })], business({ externalId: "x", address: null })),
    ).toBeNull();
  });

  it("does not merge the same name at a different address", () => {
    expect(
      findExistingLead(
        [lead()],
        business({ externalId: "x", address: "999 Other Street, Montreal, QC" }),
      ),
    ).toBeNull();
  });

  it("does not merge different names at the same address", () => {
    expect(
      findExistingLead([lead()], business({ externalId: "x", name: "Coupe et Cie" })),
    ).toBeNull();
  });

  it("does not merge merely similar names", () => {
    expect(
      findExistingLead(
        [lead()],
        business({ externalId: "x", name: "Salon Verdurette Deux" }),
      ),
    ).toBeNull();
  });

  it("does not treat an empty or whitespace address as a wildcard", () => {
    expect(
      findExistingLead([lead({ address: "   " })], business({ externalId: "x", address: "   " })),
    ).toBeNull();
  });

  it("returns null against an empty lead list", () => {
    expect(findExistingLead([], business())).toBeNull();
  });
});
