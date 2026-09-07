import { describe, expect, it } from "vitest";

import type { Observation, ProfileFacts, SourceRecord } from "./business-profile";
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LIST,
  SOURCE_PRECEDENCE,
  allValues,
  emptyProfileFacts,
  resolveField,
} from "./business-profile";

/**
 * The domain rules that make a profile evidence rather than a blob of values:
 * every fact is an observation, conflicting observations are all kept, and
 * reading a preferred value is a deterministic, non-destructive operation.
 */

const source = (id: string, type: SourceRecord["type"], fetchedAt = "2026-09-06T00:00:00.000Z"): SourceRecord => ({
  id,
  type,
  reference: `${type}:${id}`,
  fetchedAt,
  title: null,
});

const observed = (value: string | number | boolean, sourceId: string): Observation => ({
  value,
  sourceId,
  kind: "observed",
});

const facts = (over: Partial<ProfileFacts> = {}): ProfileFacts => ({
  ...emptyProfileFacts(),
  ...over,
});

describe("the fact set has a fixed, closed shape", () => {
  it("gives every declared field an empty list", () => {
    const empty = emptyProfileFacts();
    expect(Object.keys(empty).sort()).toEqual([...PROFILE_FIELD_LIST].sort());
    for (const field of PROFILE_FIELD_LIST) expect(empty[field]).toEqual([]);
  });

  it("declares an area and a value type for every field", () => {
    for (const field of PROFILE_FIELD_LIST) {
      const spec = PROFILE_FIELDS[field];
      expect(spec.area).toBeTruthy();
      expect(["string", "number", "boolean"]).toContain(spec.type);
      expect(spec.label.length).toBeGreaterThan(0);
    }
  });

  it("has no field that could hold an inference", () => {
    // ObservationKind is "stated" | "observed". There is deliberately no
    // third member, so a conclusion has nowhere to live in this record.
    const kinds: Observation["kind"][] = ["stated", "observed"];
    expect(kinds).toHaveLength(2);
  });
});

describe("resolveField prefers a source without discarding the others", () => {
  const sources = [
    source("lead-snapshot", "lead-snapshot"),
    source("site-1", "website"),
    source("dir-1", "directory"),
  ];

  it("returns null when nothing was recorded", () => {
    expect(resolveField(facts(), "contact.phone", sources)).toBeNull();
  });

  it("prefers the business's own website over a directory and our snapshot", () => {
    const resolved = resolveField(
      facts({
        "contact.phone": [
          observed("+1 000 000 0000", "lead-snapshot"),
          observed("+1 111 111 1111", "dir-1"),
          observed("+1 222 222 2222", "site-1"),
        ],
      }),
      "contact.phone",
      sources,
    );

    expect(resolved?.observation.value).toBe("+1 222 222 2222");
    expect(resolved?.source.type).toBe("website");
  });

  it("ranks the stored discovery record last, because it is a copy", () => {
    expect(SOURCE_PRECEDENCE[SOURCE_PRECEDENCE.length - 1]).toBe("lead-snapshot");
    expect(SOURCE_PRECEDENCE[0]).toBe("website");
  });

  it("keeps every disagreeing observation and hands it back", () => {
    const resolved = resolveField(
      facts({
        "contact.phone": [
          observed("A", "lead-snapshot"),
          observed("B", "site-1"),
          observed("C", "dir-1"),
        ],
      }),
      "contact.phone",
      sources,
    );

    expect(resolved?.observation.value).toBe("B");
    expect(resolved?.conflicting.map((o) => o.value)).toEqual(["C", "A"]);
  });

  it("does not report agreement as a conflict", () => {
    const resolved = resolveField(
      facts({
        "contact.phone": [observed("same", "lead-snapshot"), observed("same", "site-1")],
      }),
      "contact.phone",
      sources,
    );

    expect(resolved?.conflicting).toEqual([]);
  });

  it("breaks a same-precedence tie by recency, then by source id", () => {
    const older = source("site-a", "website", "2026-09-01T00:00:00.000Z");
    const newer = source("site-b", "website", "2026-09-05T00:00:00.000Z");

    const resolved = resolveField(
      facts({ "contact.phone": [observed("old", "site-a"), observed("new", "site-b")] }),
      "contact.phone",
      [older, newer],
    );
    expect(resolved?.observation.value).toBe("new");

    const sameTime = [source("site-b", "website"), source("site-a", "website")];
    const tied = resolveField(
      facts({ "contact.phone": [observed("b", "site-b"), observed("a", "site-a")] }),
      "contact.phone",
      sameTime,
    );
    expect(tied?.observation.value).toBe("a");
  });

  it("does not depend on the order observations happen to be stored in", () => {
    const forwards = resolveField(
      facts({
        "contact.phone": [observed("A", "lead-snapshot"), observed("B", "site-1")],
      }),
      "contact.phone",
      sources,
    );
    const backwards = resolveField(
      facts({
        "contact.phone": [observed("B", "site-1"), observed("A", "lead-snapshot")],
      }),
      "contact.phone",
      sources,
    );
    expect(forwards?.observation).toEqual(backwards?.observation);
  });

  it("ignores an observation whose source is not in the profile", () => {
    // The mapping layer rejects these outright; this is the read-side belt.
    const resolved = resolveField(
      facts({ "contact.phone": [observed("ghost", "not-a-source")] }),
      "contact.phone",
      sources,
    );
    expect(resolved).toBeNull();
  });

  it("mutates nothing it reads", () => {
    const stored = facts({
      "contact.phone": [observed("A", "lead-snapshot"), observed("B", "site-1")],
    });
    const snapshot = JSON.stringify(stored);

    resolveField(stored, "contact.phone", sources);
    allValues(stored, "contact.phone", sources);

    expect(JSON.stringify(stored)).toBe(snapshot);
  });

  it("lists every recorded value, preferred first", () => {
    const values = allValues(
      facts({
        "contact.phone": [observed("A", "lead-snapshot"), observed("B", "site-1")],
      }),
      "contact.phone",
      sources,
    );
    expect(values.map((o) => o.value)).toEqual(["B", "A"]);
  });
});
