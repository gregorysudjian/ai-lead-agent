import { describe, expect, it } from "vitest";

import type { BusinessProfile, ProfileFacts, SourceRecord } from "@/lib/business-profile";
import { emptyProfileFacts } from "@/lib/business-profile";

import {
  BusinessProfileRowMappingError,
  assertValidProfileDraft,
  businessProfileToRow,
  rowToBusinessProfile,
  toProfileDocument,
  type BusinessProfileRow,
} from "./profile-mapping";

/**
 * Row mapping and jsonb validation.
 *
 * The rule this layer exists to enforce: a fact whose source is not in the same
 * profile cannot be read back. That makes "where did we learn this?" answerable
 * for every value in the store by construction, rather than by anyone
 * remembering to fill a field in.
 */

const sources: SourceRecord[] = [
  {
    id: "lead-snapshot",
    type: "lead-snapshot",
    reference: "osm:node/1",
    fetchedAt: "2026-09-06T06:00:00.000Z",
    title: "OpenStreetMap",
  },
  {
    id: "site-1",
    type: "website",
    reference: "https://example.test/",
    fetchedAt: "2026-09-07T09:00:00.000Z",
    title: "Salon Milano",
  },
];

const facts = (): ProfileFacts => ({
  ...emptyProfileFacts(),
  "identity.name": [{ value: "Salon Milano", sourceId: "lead-snapshot", kind: "observed" }],
  "contact.phone": [
    { value: "+1 514 271 3898", sourceId: "lead-snapshot", kind: "observed" },
    { value: "+1 514 000 0000", sourceId: "site-1", kind: "stated" },
  ],
  "web.website": [{ value: "https://example.test/", sourceId: "site-1", kind: "observed" }],
  "web.reachable": [{ value: true, sourceId: "site-1", kind: "observed" }],
  "reputation.rating": [{ value: 4.5, sourceId: "site-1", kind: "stated" }],
});

const profile = (): BusinessProfile => ({
  id: "11111111-1111-4111-8111-111111111111",
  leadId: "22222222-2222-4222-8222-222222222222",
  status: "complete",
  createdAt: "2026-09-07T10:00:00.000Z",
  updatedAt: "2026-09-07T10:00:00.000Z",
  researcher: { name: "mock", version: "no-external-sources-v1" },
  sources,
  facts: facts(),
  coverage: [
    { area: "identity", status: "covered", note: "From the stored discovery record." },
    { area: "contact", status: "covered", note: "From the stored discovery record." },
    { area: "web", status: "covered", note: "The website was fetched." },
    { area: "business", status: "not-researched", note: "Nothing was consulted." },
    { area: "reputation", status: "unavailable", note: "No supported review source." },
  ],
  limitations: ["Nothing here was verified by visiting the business."],
});

const row = (over: Partial<BusinessProfileRow> = {}): BusinessProfileRow => ({
  ...businessProfileToRow(profile()),
  ...over,
});

/** Deep-clone the document so a test can corrupt one field of a valid one. */
const doc = (mutate: (d: Record<string, unknown>) => void): unknown => {
  const d = JSON.parse(JSON.stringify(businessProfileToRow(profile()).profile)) as Record<
    string,
    unknown
  >;
  mutate(d);
  return d;
};

describe("round trip", () => {
  it("maps a profile to a row and back unchanged", () => {
    const original = profile();
    expect(rowToBusinessProfile(businessProfileToRow(original))).toEqual(original);
  });

  it("keeps snake_case out of the domain object", () => {
    const mapped = rowToBusinessProfile(row());
    expect(mapped).not.toHaveProperty("lead_id");
    expect(mapped.leadId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("stores identity, the lead reference and timestamps in columns, not the document", () => {
    const stored = businessProfileToRow(profile()).profile as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["coverage", "facts", "limitations", "sources"]);

    const serialised = JSON.stringify(stored);
    expect(serialised).not.toContain("11111111");
    expect(serialised).not.toContain("22222222");
    expect(serialised).not.toContain("2026-09-07T10:00");
  });

  it("keeps the researcher's identity in columns it never wrote", () => {
    const stored = businessProfileToRow(profile());
    expect(stored.researcher_name).toBe("mock");
    expect(stored.researcher_version).toBe("no-external-sources-v1");
    expect(JSON.stringify(stored.profile)).not.toContain("no-external-sources-v1");
  });

  it("preserves conflicting observations on the same field", () => {
    const mapped = rowToBusinessProfile(row());
    expect(mapped.facts["contact.phone"]).toHaveLength(2);
    expect(mapped.facts["contact.phone"].map((o) => o.sourceId)).toEqual([
      "lead-snapshot",
      "site-1",
    ]);
  });
});

describe("every fact must name a source in the same profile", () => {
  it("rejects an observation whose source is not listed", () => {
    expect(() =>
      rowToBusinessProfile(
        row({
          profile: doc((d) => {
            const f = d.facts as Record<string, unknown[]>;
            f["contact.phone"] = [{ value: "x", sourceId: "invented", kind: "observed" }];
          }),
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects an observation with no source at all", () => {
    expect(() =>
      rowToBusinessProfile(
        row({
          profile: doc((d) => {
            const f = d.facts as Record<string, unknown[]>;
            f["contact.phone"] = [{ value: "x", kind: "observed" }];
          }),
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a profile whose sources were removed but whose facts remain", () => {
    expect(() =>
      rowToBusinessProfile(
        row({
          profile: doc((d) => {
            d.sources = [];
          }),
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects duplicate source ids, which would make attribution ambiguous", () => {
    expect(() =>
      rowToBusinessProfile(
        row({
          profile: doc((d) => {
            const s = d.sources as Record<string, unknown>[];
            s[1].id = "lead-snapshot";
          }),
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });
});

describe("sources are validated field by field", () => {
  it("rejects an unknown source type", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          (d.sources as Record<string, unknown>[])[1].type = "psychic";
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a source with no reference or no fetch time", () => {
    for (const key of ["reference", "fetchedAt", "id"]) {
      expect(() =>
        toProfileDocument(
          doc((d) => {
            (d.sources as Record<string, unknown>[])[1][key] = "";
          }),
        ),
      ).toThrow(BusinessProfileRowMappingError);
    }
  });

  it("accepts a source with no title, which many records lack", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          (d.sources as Record<string, unknown>[])[1].title = null;
        }),
      ),
    ).not.toThrow();
  });
});

describe("observation values are checked against the field they claim", () => {
  const withPhone = (value: unknown) =>
    doc((d) => {
      const f = d.facts as Record<string, unknown[]>;
      f["contact.phone"] = [{ value, sourceId: "site-1", kind: "stated" }];
    });

  it("rejects a number where a string belongs", () => {
    expect(() => toProfileDocument(withPhone(5145550100))).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a string where a number belongs", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const f = d.facts as Record<string, unknown[]>;
          f["reputation.rating"] = [{ value: "great", sourceId: "site-1", kind: "stated" }];
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a non-boolean where a boolean belongs", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const f = d.facts as Record<string, unknown[]>;
          f["web.reachable"] = [{ value: "yes", sourceId: "site-1", kind: "observed" }];
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects an observation kind that is not stated or observed", () => {
    // Especially "inferred": a profile records evidence, never a conclusion.
    for (const kind of ["inferred", "guessed", "assumed", ""]) {
      expect(() =>
        toProfileDocument(
          doc((d) => {
            const f = d.facts as Record<string, unknown[]>;
            f["contact.phone"] = [{ value: "x", sourceId: "site-1", kind }];
          }),
        ),
      ).toThrow(BusinessProfileRowMappingError);
    }
  });

  it("rejects a field name we never declared", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const f = d.facts as Record<string, unknown[]>;
          f["business.isPremium"] = [{ value: true, sourceId: "site-1", kind: "stated" }];
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });
});

describe("URL fields only accept absolute http(s) URLs", () => {
  const withWebsite = (value: string) =>
    doc((d) => {
      const f = d.facts as Record<string, unknown[]>;
      f["web.website"] = [{ value, sourceId: "site-1", kind: "observed" }];
    });

  it("accepts http and https", () => {
    expect(() => toProfileDocument(withWebsite("http://example.test/"))).not.toThrow();
    expect(() => toProfileDocument(withWebsite("https://example.test/x"))).not.toThrow();
  });

  it("rejects anything a browser could be tricked by", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "//example.test",
      "example.test",
      "ftp://example.test",
    ]) {
      expect(() => toProfileDocument(withWebsite(bad)), bad).toThrow(BusinessProfileRowMappingError);
    }
  });

  it("applies the same rule to social and booking links", () => {
    for (const field of ["web.socialLink", "web.bookingUrl"]) {
      expect(() =>
        toProfileDocument(
          doc((d) => {
            const f = d.facts as Record<string, unknown[]>;
            f[field] = [{ value: "javascript:alert(1)", sourceId: "site-1", kind: "observed" }];
          }),
        ),
      ).toThrow(BusinessProfileRowMappingError);
    }
  });
});

describe("coverage must be complete", () => {
  it("rejects a profile that does not report every area", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          d.coverage = (d.coverage as unknown[]).slice(0, 3);
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a duplicated area", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const c = d.coverage as Record<string, unknown>[];
          c[1].area = "identity";
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects an unknown coverage status", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          (d.coverage as Record<string, unknown>[])[0].status = "probably";
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("requires a note on every area, covered or not", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          (d.coverage as Record<string, unknown>[])[0].note = "";
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });
});

describe("a draft is validated before it can be persisted", () => {
  it("accepts a well-formed draft", () => {
    const { researcher, sources: s, facts: f, coverage, limitations } = profile();
    expect(() =>
      assertValidProfileDraft({ researcher, sources: s, facts: f, coverage, limitations }),
    ).not.toThrow();
  });

  it("rejects a draft with no researcher identity", () => {
    const { sources: s, facts: f, coverage, limitations } = profile();
    expect(() =>
      assertValidProfileDraft({
        researcher: { name: "", version: "v1" },
        sources: s,
        facts: f,
        coverage,
        limitations,
      }),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("rejects a draft whose facts are not attributable", () => {
    const { researcher, facts: f, coverage, limitations } = profile();
    expect(() =>
      assertValidProfileDraft({ researcher, sources: [], facts: f, coverage, limitations }),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("drops any extra key a researcher tried to add to the document", () => {
    const { researcher, sources: s, facts: f, coverage, limitations } = profile();
    const smuggled = {
      researcher,
      sources: s,
      facts: f,
      coverage,
      limitations,
      leadId: "someone-elses-lead",
      id: "chosen-by-the-researcher",
    } as unknown as Parameters<typeof assertValidProfileDraft>[0];

    const validated = assertValidProfileDraft(smuggled);
    expect(Object.keys(validated).sort()).toEqual([
      "coverage",
      "facts",
      "limitations",
      "researcher",
      "sources",
    ]);
  });
});

describe("stored values are returned verbatim", () => {
  it("does not rewrite a hostile string a source contained", () => {
    const hostile = "<script>alert(1)</script>";
    const mapped = rowToBusinessProfile(
      row({
        profile: doc((d) => {
          const f = d.facts as Record<string, unknown[]>;
          f["web.pageTitle"] = [{ value: hostile, sourceId: "site-1", kind: "observed" }];
        }),
      }),
    );
    // Escaping is the renderer's job. The store must not silently alter what a
    // source actually said, or the record stops being evidence.
    expect(mapped.facts["web.pageTitle"][0].value).toBe(hostile);
  });
});

describe("source records are validated strictly, now that real sources exist", () => {
  const withSource = (mutate: (s: Record<string, unknown>) => void) =>
    doc((d) => mutate((d.sources as Record<string, unknown>[])[1]));

  it("requires a real, normalized ISO timestamp", () => {
    for (const bad of [
      "yesterday",
      "2026-13-45T00:00:00.000Z",
      "not a date",
      "1757239200",
      "2026-09-07",
      "2026-09-07T09:00:00+00:00",
    ]) {
      expect(() => toProfileDocument(withSource((s) => (s.fetchedAt = bad))), bad).toThrow(
        BusinessProfileRowMappingError,
      );
    }
  });

  it("accepts a canonical instant", () => {
    expect(() =>
      toProfileDocument(withSource((s) => (s.fetchedAt = "2026-09-07T09:00:00.000Z"))),
    ).not.toThrow();
  });

  it("requires a website source to name the exact URL fetched", () => {
    for (const bad of [
      "osm:node/1",
      "the homepage",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,x",
      "//example.test",
      "",
    ]) {
      expect(() => toProfileDocument(withSource((s) => (s.reference = bad))), bad).toThrow(
        BusinessProfileRowMappingError,
      );
    }
  });

  it("keeps the provider form for the stored discovery record", () => {
    const leadSource = (reference: string) =>
      doc((d) => ((d.sources as Record<string, unknown>[])[0].reference = reference));

    expect(() => toProfileDocument(leadSource("osm:node/1"))).not.toThrow();
    expect(() => toProfileDocument(leadSource("google:places/abc"))).not.toThrow();
    // A lead added from the business catalog. This once failed research at
    // the moment the profile was saved, because the list predated Overture.
    expect(() => toProfileDocument(leadSource("overture:08f2baa4c2a7ab530310b4cbd6b4e3c4"))).not.toThrow();
    for (const bad of ["https://example.test/", "node/1", "osm:", "osm: node 1"]) {
      expect(() => toProfileDocument(leadSource(bad)), bad).toThrow(BusinessProfileRowMappingError);
    }
  });

  it("bounds the source id and restricts its characters", () => {
    expect(() => toProfileDocument(withSource((s) => (s.id = "a".repeat(200))))).toThrow(
      BusinessProfileRowMappingError,
    );
    for (const bad of ["has space", "../escape", "id/slash", "<script>", ""]) {
      expect(() => toProfileDocument(withSource((s) => (s.id = bad))), bad).toThrow(
        BusinessProfileRowMappingError,
      );
    }
  });

  it("bounds the source title", () => {
    expect(() => toProfileDocument(withSource((s) => (s.title = "t".repeat(5000))))).toThrow(
      BusinessProfileRowMappingError,
    );
  });

  it("bounds how many sources one profile may cite", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const base = (d.sources as Record<string, unknown>[])[1];
          d.sources = Array.from({ length: 25 }, (_, i) => ({ ...base, id: `s${i}` }));
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });
});

describe("extracted values are bounded before they are stored", () => {
  const withValue = (field: string, value: unknown) =>
    doc((d) => {
      const f = d.facts as Record<string, unknown[]>;
      f[field] = [{ value, sourceId: "site-1", kind: "stated" }];
    });

  it("rejects a page title, description or phone beyond its field's limit", () => {
    expect(() => toProfileDocument(withValue("web.pageTitle", "t".repeat(5000)))).toThrow(
      BusinessProfileRowMappingError,
    );
    expect(() => toProfileDocument(withValue("web.description", "d".repeat(20_000)))).toThrow(
      BusinessProfileRowMappingError,
    );
    expect(() => toProfileDocument(withValue("contact.phone", "9".repeat(500)))).toThrow(
      BusinessProfileRowMappingError,
    );
  });

  it("rejects an absurd URL rather than storing a page inside one", () => {
    const huge = `https://example.test/${"a".repeat(5000)}`;
    expect(() => toProfileDocument(withValue("web.website", huge))).toThrow(
      BusinessProfileRowMappingError,
    );
  });

  it("bounds how many observations one field may hold", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => {
          const f = d.facts as Record<string, unknown[]>;
          f["web.socialLink"] = Array.from({ length: 50 }, (_, i) => ({
            value: `https://instagram.com/p/${i}`,
            sourceId: "site-1",
            kind: "observed",
          }));
        }),
      ),
    ).toThrow(BusinessProfileRowMappingError);
  });

  it("bounds coverage notes and limitations", () => {
    expect(() =>
      toProfileDocument(
        doc((d) => ((d.coverage as Record<string, unknown>[])[0].note = "n".repeat(2000))),
      ),
    ).toThrow(BusinessProfileRowMappingError);

    expect(() =>
      toProfileDocument(doc((d) => (d.limitations = ["l".repeat(2000)]))),
    ).toThrow(BusinessProfileRowMappingError);

    expect(() =>
      toProfileDocument(doc((d) => (d.limitations = Array.from({ length: 50 }, () => "x")))),
    ).toThrow(BusinessProfileRowMappingError);
  });
});
