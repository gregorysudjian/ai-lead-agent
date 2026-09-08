import { describe, expect, it } from "vitest";

import type { DemoSite, DemoSiteSpec } from "@/lib/demo-site";

import {
  assertValidDemoDraft,
  demoSiteToRow,
  DemoSiteRowMappingError,
  rowToDemoSite,
  toDemoSiteContent,
  type DemoSiteRow,
} from "./demo-mapping";

/**
 * Row mapping and jsonb validation.
 *
 * `jsonb` guarantees only that a value is JSON. Everything below exists because
 * a stored spec is untrusted input on the way out of the database, exactly like
 * a provider payload is on the way in.
 */

const spec = (): DemoSiteSpec => ({
  business: {
    name: "Salon Test",
    category: "Hair salon",
    city: "Montreal",
    phone: "+1 514 555 0100",
    address: "100 Rue Test",
    websiteListed: false,
    source: "osm",
    snapshotFetchedAt: "2026-09-05T00:00:00.000Z",
    socialLinks: [],
    openingHours: [],
    bookingUrl: null,
    ownDescription: null,
    profileSourced: false,
  },
  content: {
    siteTitle: "Salon Test",
    tagline: "Hair salon · Montreal",
    theme: "fresh-modern",
    layout: "classic",
    navigation: [{ label: "What we do", targetSectionId: "services" }],
    sections: [
      {
        kind: "hero",
        id: "top",
        sample: false,
        eyebrow: "Hair salon · Montreal",
        heading: "A hair salon in Montreal",
        subheading: "Clear on a phone, quick to load.",
        primaryCta: { label: "Call us", action: "call" },
        secondaryCta: { label: "Find us", action: "directions" },
      },
      {
        kind: "offering",
        id: "services",
        sample: false,
        heading: "What we do",
        intro: "Sections a finished site would carry.",
        items: [{ title: "What we do", body: "A plain description." }],
      },
      {
        kind: "contact",
        id: "visit",
        sample: false,
        heading: "Find us",
        body: "Our phone number and address are below.",
        hoursNote: "Opening hours appear here once you confirm them.",
      },
      {
        kind: "cta",
        id: "start",
        sample: false,
        heading: "Ready when you are",
        body: "One clear next step.",
        cta: { label: "Call us", action: "call" },
      },
    ],
    footer: { note: "A proposed website for a hair salon in Montreal." },
  },
});

const demo = (): DemoSite => ({
  id: "11111111-1111-4111-8111-111111111111",
  leadId: "22222222-2222-4222-8222-222222222222",
  analysisId: "33333333-3333-4333-8333-333333333333",
  status: "generated",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  generator: { name: "mock", model: "deterministic-demo-rules-v1" },
  spec: spec(),
});

const row = (over: Partial<DemoSiteRow> = {}): DemoSiteRow => ({
  ...demoSiteToRow(demo()),
  ...over,
});

/** Deep-clone helper so a test can corrupt one field of a valid spec. */
const corrupt = (mutate: (s: Record<string, unknown>) => void): unknown => {
  const s = JSON.parse(JSON.stringify(spec())) as Record<string, unknown>;
  mutate(s);
  return s;
};

describe("round trip", () => {
  it("maps a demo site to a row and back unchanged", () => {
    const original = demo();
    expect(rowToDemoSite(demoSiteToRow(original))).toEqual(original);
  });

  it("keeps snake_case out of the domain object", () => {
    const mapped = rowToDemoSite(row());
    expect(mapped).not.toHaveProperty("lead_id");
    expect(mapped).not.toHaveProperty("analysis_id");
    expect(mapped.leadId).toBe("22222222-2222-4222-8222-222222222222");
    expect(mapped.analysisId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("stores identity and timestamps in columns, not inside the document", () => {
    const stored = demoSiteToRow(demo()).spec as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["business", "content"]);
    expect(JSON.stringify(stored)).not.toContain("11111111");
    expect(JSON.stringify(stored)).not.toContain("2026-09-06T10:00");
  });

  it("keeps the generator's identity in columns the generator never wrote", () => {
    const stored = demoSiteToRow(demo());
    expect(stored.generator_name).toBe("mock");
    expect(stored.generator_model).toBe("deterministic-demo-rules-v1");
    expect(JSON.stringify(stored.spec)).not.toContain("deterministic-demo-rules-v1");
  });
});

describe("the row is validated field by field", () => {
  it("rejects an unknown status", () => {
    expect(() => rowToDemoSite(row({ status: "draft" }))).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a missing generator name or model", () => {
    expect(() => rowToDemoSite(row({ generator_name: "" }))).toThrow(DemoSiteRowMappingError);
    expect(() => rowToDemoSite(row({ generator_model: "  " }))).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a spec that is not an object", () => {
    for (const bad of [null, "spec", 42, []]) {
      expect(() => rowToDemoSite(row({ spec: bad }))).toThrow(DemoSiteRowMappingError);
    }
  });

  it("rejects a missing business subtree", () => {
    expect(() => rowToDemoSite(row({ spec: corrupt((s) => delete s.business) }))).toThrow(
      DemoSiteRowMappingError,
    );
  });

  it("rejects an unknown provider source", () => {
    expect(() =>
      rowToDemoSite(
        row({
          spec: corrupt((s) => {
            (s.business as Record<string, unknown>).source = "yelp";
          }),
        }),
      ),
    ).toThrow(DemoSiteRowMappingError);
  });

  it("accepts a null phone or address, and rejects a non-string one", () => {
    expect(() =>
      rowToDemoSite(
        row({
          spec: corrupt((s) => {
            (s.business as Record<string, unknown>).phone = null;
            (s.business as Record<string, unknown>).address = null;
          }),
        }),
      ),
    ).not.toThrow();

    expect(() =>
      rowToDemoSite(
        row({
          spec: corrupt((s) => {
            (s.business as Record<string, unknown>).phone = 5145550100;
          }),
        }),
      ),
    ).toThrow(DemoSiteRowMappingError);
  });
});

describe("closed enums are enforced on the way out of the database", () => {
  const content = () => JSON.parse(JSON.stringify(spec().content)) as Record<string, unknown>;

  it("rejects a theme we never defined", () => {
    const c = content();
    c.theme = "neon-chaos";
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a section kind we never defined", () => {
    const c = content();
    (c.sections as Record<string, unknown>[])[1].kind = "iframe";
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a CTA action we never defined", () => {
    const c = content();
    const hero = (c.sections as Record<string, unknown>[])[0];
    hero.primaryCta = { label: "Go", action: "navigate" };
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a scroll CTA with no target", () => {
    const c = content();
    const hero = (c.sections as Record<string, unknown>[])[0];
    hero.primaryCta = { label: "Go", action: "scroll" };
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a section id that is not a plain anchor slug", () => {
    for (const bad of ["Top", "top/../x", "top id", "#top", "javascript:x"]) {
      const c = content();
      (c.sections as Record<string, unknown>[])[0].id = bad;
      expect(() => toDemoSiteContent(c), bad).toThrow(DemoSiteRowMappingError);
    }
  });

  it("rejects duplicate section ids", () => {
    const c = content();
    (c.sections as Record<string, unknown>[])[1].id = "top";
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a navigation item pointing at no section", () => {
    const c = content();
    c.navigation = [{ label: "Gone", targetSectionId: "missing" }];
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a CTA pointing at no section", () => {
    const c = content();
    const cta = (c.sections as Record<string, unknown>[])[3];
    cta.cta = { label: "Go", action: "scroll", targetSectionId: "nowhere" };
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });

  it("rejects an empty sections list", () => {
    const c = content();
    c.sections = [];
    expect(() => toDemoSiteContent(c)).toThrow(DemoSiteRowMappingError);
  });
});

describe("hostile strings are preserved as data, not sanitised into something else", () => {
  const hostile = "<script>alert(1)</script>";

  it("stores and returns a hostile business name unchanged", () => {
    const mapped = rowToDemoSite(
      row({
        spec: corrupt((s) => {
          (s.business as Record<string, unknown>).name = hostile;
        }),
      }),
    );
    // Escaping is the renderer's job and is proven there. The store must not
    // silently rewrite provider data.
    expect(mapped.spec.business.name).toBe(hostile);
  });

  it("stores and returns hostile generated copy unchanged", () => {
    const mapped = rowToDemoSite(
      row({
        spec: corrupt((s) => {
          const sections = (s.content as Record<string, unknown>).sections as Record<
            string,
            unknown
          >[];
          sections[0].heading = hostile;
        }),
      }),
    );
    const hero = mapped.spec.content.sections[0];
    if (hero.kind !== "hero") throw new Error("unreachable");
    expect(hero.heading).toBe(hostile);
  });
});

describe("a draft is validated before it can be persisted", () => {
  it("accepts a well-formed draft", () => {
    expect(() =>
      assertValidDemoDraft({
        generator: { name: "mock", model: "deterministic-demo-rules-v1" },
        spec: spec(),
      }),
    ).not.toThrow();
  });

  it("rejects a draft whose generated content is malformed", () => {
    const bad = spec();
    (bad.content as unknown as Record<string, unknown>).theme = "not-a-theme";
    expect(() =>
      assertValidDemoDraft({ generator: { name: "mock", model: "v1" }, spec: bad }),
    ).toThrow(DemoSiteRowMappingError);
  });

  it("rejects a draft with no generator identity", () => {
    expect(() =>
      assertValidDemoDraft({
        generator: { name: "", model: "v1" },
        spec: spec(),
      }),
    ).toThrow(DemoSiteRowMappingError);
  });

  it("drops any extra field a generator tried to add to the spec", () => {
    const smuggled = {
      ...spec(),
      provider: { name: "someone-else" },
      facts: { websiteListed: true },
    } as unknown as DemoSiteSpec;

    const validated = assertValidDemoDraft({
      generator: { name: "mock", model: "v1" },
      spec: smuggled,
    });

    expect(Object.keys(validated.spec).sort()).toEqual(["business", "content"]);
    expect(validated.spec).not.toHaveProperty("provider");
    expect(validated.spec).not.toHaveProperty("facts");
  });
});

describe("demos stored before the sample flag existed", () => {
  /**
   * A real failure: adding a required `sample` field made every previously
   * stored demo unreadable, and the demos index went blank with "could not be
   * loaded". Old rows are read, not rejected -- and they are read
   * conservatively.
   */
  const withoutSampleFlags = () =>
    row({
      spec: corrupt((s) => {
        const content = s.content as { sections: Record<string, unknown>[] };
        for (const section of content.sections) delete section.sample;
      }) as DemoSiteRow["spec"],
    });

  it("reads a section that has no sample flag", () => {
    expect(() => rowToDemoSite(withoutSampleFlags())).not.toThrow();
  });

  it("treats a missing flag as sample, never as confirmed", () => {
    // Unknown provenance reads as "we cannot vouch for this". Defaulting the
    // other way would silently promote old placeholder copy to confirmed,
    // which is the one outcome the flag exists to prevent.
    const demo = rowToDemoSite(withoutSampleFlags());
    for (const section of demo.spec.content.sections) {
      expect(section.sample, section.kind).toBe(true);
    }
  });

  it("still rejects a flag of the wrong type", () => {
    // Absent is age; present-but-wrong is corruption, and corruption fails.
    const corrupted = row({
      spec: corrupt((s) => {
        const content = s.content as { sections: Record<string, unknown>[] };
        content.sections[0].sample = "yes";
      }) as DemoSiteRow["spec"],
    });
    expect(() => rowToDemoSite(corrupted)).toThrow(DemoSiteRowMappingError);
  });
});
