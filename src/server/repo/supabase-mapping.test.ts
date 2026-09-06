import { describe, expect, it } from "vitest";

import type { DiscoveredBusiness, Lead } from "@/lib/types";

import {
  dedupeColumnsFor,
  isValidLeadStatus,
  leadToRow,
  LeadRowMappingError,
  refreshPatchFor,
  rowToLead,
  type LeadRow,
} from "./supabase-mapping";

const provider = (over: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness => ({
  externalId: "node/123",
  source: "osm",
  name: "Salon Réel",
  category: "Hair salon",
  city: "Montreal",
  address: "100 Rue Test, Montreal, QC",
  phone: "+1 514 555 0100",
  website: null,
  rating: null,
  reviewCount: null,
  openingHours: null,
  fetchedAt: "2026-09-06T00:00:00.000Z",
  ...over,
});

const row = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  status: "new",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-02T00:00:00.000Z",
  provider: provider(),
  provider_source: "osm",
  provider_external_id: "node/123",
  normalized_name: "salon reel",
  normalized_address: "100 rue test, montreal, qc",
  ...over,
});

describe("row -> Lead", () => {
  it("maps a well-formed row, keeping provider nested", () => {
    const lead = rowToLead(row());
    expect(lead).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      status: "new",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
      provider: provider(),
    });
  });

  it("never leaks snake_case columns into the Lead", () => {
    const lead = rowToLead(row()) as unknown as Record<string, unknown>;
    for (const column of [
      "created_at", "updated_at", "provider_source", "provider_external_id",
      "normalized_name", "normalized_address",
    ]) {
      expect(lead[column]).toBeUndefined();
    }
    expect(Object.keys(lead).sort()).toEqual([
      "createdAt", "id", "provider", "status", "updatedAt",
    ]);
  });

  it("preserves a null provider address (with a consistent null helper column)", () => {
    const lead = rowToLead(
      row({ provider: provider({ address: null }), normalized_address: null }),
    );
    expect(lead.provider.address).toBeNull();
  });

  it.each([["new"], ["reviewed"]])("accepts status %s", (status) => {
    expect(rowToLead(row({ status })).status).toBe(status);
  });

  it.each([["archived"], ["NEW"], [""], ["deleted"]])(
    "rejects invalid status %j rather than producing a bad Lead",
    (status) => {
      expect(() => rowToLead(row({ status }))).toThrow(LeadRowMappingError);
    },
  );

  it.each([
    ["provider is not an object", { provider: "nope" }],
    ["provider is null", { provider: null }],
    ["provider is an array", { provider: [] }],
    ["missing id", { id: "" }],
    ["missing created_at", { created_at: "" }],
  ])("rejects a malformed row: %s", (_label, patch) => {
    expect(() => rowToLead(row(patch as Partial<LeadRow>))).toThrow(LeadRowMappingError);
  });

  it.each([
    ["missing externalId", { externalId: "" }],
    ["missing name", { name: "" }],
    ["unknown source", { source: "yelp" as never }],
    ["rating is a string", { rating: "4.5" as never }],
    ["openingHours is an object", { openingHours: {} as never }],
  ])("rejects a malformed provider snapshot: %s", (_label, patch) => {
    expect(() => rowToLead(row({ provider: provider(patch) }))).toThrow(LeadRowMappingError);
  });

  it("validates status through the exported guard too", () => {
    expect(isValidLeadStatus("new")).toBe(true);
    expect(isValidLeadStatus("reviewed")).toBe(true);
    expect(isValidLeadStatus("archived")).toBe(false);
    expect(isValidLeadStatus(null)).toBe(false);
  });
});

describe("Lead -> row and dedupe helper columns", () => {
  const lead: Lead = {
    id: "22222222-2222-4222-8222-222222222222",
    status: "reviewed",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    provider: provider(),
  };

  it("writes every column, with provider stored whole", () => {
    expect(leadToRow(lead)).toEqual({
      id: lead.id,
      status: "reviewed",
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
      provider: lead.provider,
      provider_source: "osm",
      provider_external_id: "node/123",
      normalized_name: "salon reel",
      normalized_address: "100 rue test, montreal, qc",
    });
  });

  it("normalizes name and address the same way dedupe.ts does", () => {
    const columns = dedupeColumnsFor(
      provider({ name: "  SALON   RÉEL ", address: "100 RUE TEST, MONTRÉAL, QC" }),
    );
    expect(columns.normalized_name).toBe("salon reel");
    expect(columns.normalized_address).toBe("100 rue test, montreal, qc");
  });

  it("keeps a null address NULL so the partial index skips the row", () => {
    expect(dedupeColumnsFor(provider({ address: null })).normalized_address).toBeNull();
  });

  it.each([[""], ["   "], ["\t\n"]])(
    "treats a blank address %j as NULL rather than indexing an empty string",
    (address) => {
      // Otherwise every address-less business would share the key "" and the
      // unique index would merge unrelated leads.
      expect(dedupeColumnsFor(provider({ address })).normalized_address).toBeNull();
    },
  );

  it("carries the provider source so the primary index is source-scoped", () => {
    expect(dedupeColumnsFor(provider({ source: "mock" })).provider_source).toBe("mock");
    expect(dedupeColumnsFor(provider({ source: "google" })).provider_source).toBe("google");
  });

  it("distinguishes node/123 from way/123", () => {
    expect(dedupeColumnsFor(provider({ externalId: "node/123" })).provider_external_id)
      .not.toBe(dedupeColumnsFor(provider({ externalId: "way/123" })).provider_external_id);
  });
});

describe("refresh patch", () => {
  const business = provider({ name: "Renamed Salon", address: "9 New Street" });

  it("writes only updated_at, provider and the recomputed helper columns", () => {
    const patch = refreshPatchFor(business, "2026-09-06T12:00:00.000Z");
    expect(Object.keys(patch).sort()).toEqual([
      "normalized_address", "normalized_name", "provider",
      "provider_external_id", "provider_source", "updated_at",
    ]);
  });

  it("cannot overwrite id, status or created_at - they are absent by construction", () => {
    const patch = refreshPatchFor(business, "2026-09-06T12:00:00.000Z") as unknown as Record<
      string,
      unknown
    >;
    expect(patch.id).toBeUndefined();
    expect(patch.status).toBeUndefined();
    expect(patch.created_at).toBeUndefined();
  });

  it("replaces the provider snapshot wholesale", () => {
    const patch = refreshPatchFor(business, "2026-09-06T12:00:00.000Z");
    expect(patch.provider).toEqual(business);
  });

  it("recomputes dedupe identity so a re-listed business updates its own key", () => {
    const patch = refreshPatchFor(
      provider({ externalId: "way/999", address: null }),
      "2026-09-06T12:00:00.000Z",
    );
    expect(patch.provider_external_id).toBe("way/999");
    expect(patch.normalized_address).toBeNull();
  });
});

describe("helper columns must agree with the provider snapshot", () => {
  it.each([
    ["provider_source", { provider_source: "mock" }],
    ["provider_external_id", { provider_external_id: "way/999" }],
    ["normalized_name", { normalized_name: "some other salon" }],
    ["normalized_address", { normalized_address: "9 different street" }],
  ])("rejects a row whose %s disagrees with provider", (column, patch) => {
    expect(() => rowToLead(row(patch as Partial<LeadRow>))).toThrow(LeadRowMappingError);
    expect(() => rowToLead(row(patch as Partial<LeadRow>))).toThrow(
      new RegExp(`dedupe columns disagree.*${column}`),
    );
  });

  it("rejects a NULL helper address when the provider HAS an address", () => {
    // Dangerous in the other direction too: the row would be excluded from the
    // partial unique index and could duplicate an addressed business.
    expect(() => rowToLead(row({ normalized_address: null }))).toThrow(LeadRowMappingError);
  });

  it("rejects a populated helper address when the provider address is NULL", () => {
    expect(() =>
      rowToLead(row({ provider: provider({ address: null }) })),
    ).toThrow(LeadRowMappingError);
  });

  it("accepts a consistent null address on both sides", () => {
    expect(() =>
      rowToLead(row({ provider: provider({ address: null }), normalized_address: null })),
    ).not.toThrow();
  });

  it("accepts helper columns derived from an accented / uppercase snapshot", () => {
    // The stored columns are normalized; the snapshot is not. They agree only
    // because both go through the same normalizeTerm.
    expect(() =>
      rowToLead(
        row({
          provider: provider({ name: "SALON  RÉEL", address: "100 RUE TEST, MONTRÉAL, QC" }),
          normalized_name: "salon reel",
          normalized_address: "100 rue test, montreal, qc",
        }),
      ),
    ).not.toThrow();
  });

  it("names the disagreeing columns without echoing row values", () => {
    try {
      rowToLead(row({ provider_external_id: "way/secret-value-999" }));
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("provider_external_id");
      expect(message).not.toContain("way/secret-value-999");
    }
  });
});

describe("openingHours entries are validated, not just the array", () => {
  const withHours = (openingHours: unknown) =>
    row({ provider: { ...provider(), openingHours } as never });

  it("accepts a well-formed entry list", () => {
    const lead = rowToLead(
      withHours([{ day: "monday", opens: "09:00", closes: "17:00" }]),
    );
    expect(lead.provider.openingHours).toEqual([
      { day: "monday", opens: "09:00", closes: "17:00" },
    ]);
  });

  it("accepts null and an empty array as distinct values", () => {
    expect(rowToLead(withHours(null)).provider.openingHours).toBeNull();
    expect(rowToLead(withHours([])).provider.openingHours).toEqual([]);
  });

  it.each([
    ["a bare string", ["monday 09:00-17:00"]],
    ["a number", [42]],
    ["null entry", [null]],
    ["a nested array", [[]]],
    ["an unknown weekday", [{ day: "funday", opens: "09:00", closes: "17:00" }]],
    ["a missing day", [{ opens: "09:00", closes: "17:00" }]],
    ["a numeric opens", [{ day: "monday", opens: 900, closes: "17:00" }]],
    ["a missing closes", [{ day: "monday", opens: "09:00" }]],
  ])("rejects %s", (_label, openingHours) => {
    expect(() => rowToLead(withHours(openingHours))).toThrow(LeadRowMappingError);
  });

  it("rejects a non-array value", () => {
    expect(() => rowToLead(withHours("Mo-Fr 09:00-17:00"))).toThrow(LeadRowMappingError);
    expect(() => rowToLead(withHours({ monday: "09:00" }))).toThrow(LeadRowMappingError);
  });
});
