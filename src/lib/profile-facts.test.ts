import { describe, expect, it } from "vitest";

import { LEAD_SNAPSHOT_SOURCE_ID } from "./business-profile";
import {
  deriveLeadObservations,
  deriveLeadSnapshotSource,
  toResearchInput,
} from "./profile-facts";
import type { Lead } from "./types";

/**
 * What application code contributes to a profile, and what a researcher is
 * allowed to see. Both are pure, deterministic and owned by us.
 */

const lead = (over: Partial<Lead["provider"]> = {}): Lead => ({
  id: "lead-1",
  status: "new",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  provider: {
    externalId: "node/11973226348",
    source: "osm",
    name: "Salon Milano",
    category: "Barber shop",
    city: "Montreal",
    address: "151 Rue Beaubien Est",
    phone: "+1 514 271 3898",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: "2026-09-06T06:03:33.000Z",
    ...over,
  },
});

const valuesFor = (l: Lead, field: string) =>
  deriveLeadObservations(l)
    .filter((o) => o.field === field)
    .map((o) => o.value);

describe("the stored discovery record becomes one cited source", () => {
  it("uses the reserved id and the snapshot's own fetch time", () => {
    const source = deriveLeadSnapshotSource(lead());

    expect(source.id).toBe(LEAD_SNAPSHOT_SOURCE_ID);
    expect(source.type).toBe("lead-snapshot");
    expect(source.reference).toBe("osm:node/11973226348");
    // Not "now": the claim is what the provider said when we fetched it.
    expect(source.fetchedAt).toBe("2026-09-06T06:03:33.000Z");
    expect(source.title).toBe("OpenStreetMap");
  });

  it("is deterministic", () => {
    expect(deriveLeadSnapshotSource(lead())).toEqual(deriveLeadSnapshotSource(lead()));
  });
});

describe("lead-derived observations", () => {
  it("attributes every observation to the stored record, as observed", () => {
    for (const observation of deriveLeadObservations(lead())) {
      expect(observation.sourceId).toBe(LEAD_SNAPSHOT_SOURCE_ID);
      // A directory entry is not the business speaking, so never "stated".
      expect(observation.kind).toBe("observed");
    }
  });

  it("records exactly what the provider held, and nothing else", () => {
    expect(deriveLeadObservations(lead())).toEqual([
      { field: "identity.name", value: "Salon Milano", sourceId: "lead-snapshot", kind: "observed" },
      { field: "identity.category", value: "Barber shop", sourceId: "lead-snapshot", kind: "observed" },
      { field: "identity.city", value: "Montreal", sourceId: "lead-snapshot", kind: "observed" },
      { field: "contact.phone", value: "+1 514 271 3898", sourceId: "lead-snapshot", kind: "observed" },
      { field: "contact.address", value: "151 Rue Beaubien Est", sourceId: "lead-snapshot", kind: "observed" },
    ]);
  });

  it("emits no observation for a field the provider left empty", () => {
    // Silence is not evidence of absence. `coverage` reports what was looked
    // at; an empty field never means "the business does not have one".
    const observations = deriveLeadObservations(lead({ phone: null, address: null }));
    expect(observations.map((o) => o.field)).toEqual([
      "identity.name",
      "identity.category",
      "identity.city",
    ]);
  });

  it("treats whitespace-only values as nothing recorded", () => {
    const observations = deriveLeadObservations(lead({ phone: "   ", address: "" }));
    expect(observations.some((o) => o.field === "contact.phone")).toBe(false);
    expect(observations.some((o) => o.field === "contact.address")).toBe(false);
  });

  it("trims a recorded value rather than storing padding", () => {
    expect(valuesFor(lead({ phone: "  514 555 0100  " }), "contact.phone")).toEqual(["514 555 0100"]);
  });

  it("records a listed website but never claims it responds", () => {
    const observations = deriveLeadObservations(lead({ website: "https://example.test" }));
    expect(observations.some((o) => o.field === "web.website")).toBe(true);
    // Nothing has fetched it, so `web.reachable` stays empty.
    expect(observations.some((o) => o.field === "web.reachable")).toBe(false);
  });

  it("records reputation only when the provider carried usable values", () => {
    expect(valuesFor(lead({ rating: 4.5, reviewCount: 12 }), "reputation.rating")).toEqual([4.5]);
    expect(valuesFor(lead({ rating: 4.5, reviewCount: 12 }), "reputation.reviewCount")).toEqual([12]);

    // The same validity predicates the scoring rubric uses: a rating that
    // scores zero cannot enter a profile as a fact.
    expect(valuesFor(lead({ rating: 9.9 }), "reputation.rating")).toEqual([]);
    expect(valuesFor(lead({ rating: -1 }), "reputation.rating")).toEqual([]);
    expect(valuesFor(lead({ reviewCount: -3 }), "reputation.reviewCount")).toEqual([]);
    expect(valuesFor(lead({ reviewCount: Number.NaN }), "reputation.reviewCount")).toEqual([]);
  });

  it("uses the SAME validity predicates as scoring, not its own", () => {
    // Deliberate: a value the rubric counts must be a value the profile can
    // record, or the two would disagree about what the provider supplied.
    // `isUsableReviewCount` accepts any finite non-negative number, so a
    // fractional count is recorded rather than silently dropped here.
    expect(valuesFor(lead({ reviewCount: 1.5 }), "reputation.reviewCount")).toEqual([1.5]);
  });

  it("invents nothing: every value appears in the lead", () => {
    const l = lead({ website: "https://example.test", rating: 4.2, reviewCount: 7 });
    const source = JSON.stringify(l.provider);

    for (const observation of deriveLeadObservations(l)) {
      expect(source).toContain(String(observation.value).trim());
    }
  });

  it("is deterministic", () => {
    expect(deriveLeadObservations(lead())).toEqual(deriveLeadObservations(lead()));
  });
});

describe("what a researcher is allowed to see", () => {
  const input = toResearchInput(lead({ website: "https://example.test" }));

  it("exposes exactly the permitted field set", () => {
    expect(Object.keys(input).sort()).toEqual([
      "address",
      "businessName",
      "category",
      "city",
      "phone",
      "sourceLabel",
      "website",
    ]);
  });

  it("includes contact values, which a researcher legitimately needs", () => {
    // Unlike the analysis input: a researcher matches directory records on a
    // phone number and fetches the website it was given.
    expect(input.phone).toBe("+1 514 271 3898");
    expect(input.website).toBe("https://example.test");
  });

  it("carries no internal id, external id or application timestamp", () => {
    const serialised = JSON.stringify(input);
    expect(serialised).not.toContain("lead-1");
    expect(serialised).not.toContain("node/11973226348");
    expect(serialised).not.toContain("2026-09-06T06:03");
    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("status");
  });

  it("sends a source label rather than the internal source enum", () => {
    expect(input.sourceLabel).toBe("OpenStreetMap");
  });

  it("reports a missing value as null rather than omitting it", () => {
    const sparse = toResearchInput(lead({ phone: null, address: "  ", website: null }));
    expect(sparse.phone).toBeNull();
    expect(sparse.address).toBeNull();
    expect(sparse.website).toBeNull();
  });

  it("keeps a hostile business name verbatim, as data", () => {
    const hostile = "<script>alert(1)</script>";
    expect(toResearchInput(lead({ name: hostile })).businessName).toBe(hostile);
  });
});
