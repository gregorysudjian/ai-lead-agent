import { describe, expect, it, vi } from "vitest";

import type { ResearchProviderInput } from "@/lib/business-profile";
import { RESEARCH_AREA_LABELS } from "@/lib/business-profile";

import { mockResearchProvider } from "./mock";
import { ResearchProviderError } from "./types";

/**
 * The offline researcher.
 *
 * The property under test is unusual and deliberate: it must produce NOTHING.
 * A mock analyser may write proposals, because a proposal announces itself as
 * one. A mock researcher may not write facts, because a fabricated fact is
 * indistinguishable from a real one the moment it is stored -- and a profile
 * exists precisely so its contents can be relied on.
 */

const input = (over: Partial<ResearchProviderInput> = {}): ResearchProviderInput => ({
  businessName: "Salon Milano",
  category: "Barber shop",
  city: "Montreal",
  sourceLabel: "OpenStreetMap",
  phone: "+1 514 271 3898",
  address: "151 Rue Beaubien Est",
  website: null,
  ...over,
});

describe("it is deterministic and offline", () => {
  it("produces an identical result for identical input", async () => {
    const first = await mockResearchProvider.research(input());
    const second = await mockResearchProvider.research(input());
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("identifies itself by a version that says what it does", () => {
    expect(mockResearchProvider.name).toBe("mock");
    expect(mockResearchProvider.version).toBe("no-external-sources-v1");
  });

  it("makes no network request of any kind", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await mockResearchProvider.research(input({ website: "https://example.test" }));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects a business with no usable name rather than storing an empty run", async () => {
    await expect(mockResearchProvider.research(input({ businessName: "   " }))).rejects.toBeInstanceOf(
      ResearchProviderError,
    );
  });
});

describe("it fabricates nothing", () => {
  it("returns no sources, because it consulted none", async () => {
    const result = await mockResearchProvider.research(input());
    expect(result.sources).toEqual([]);
  });

  it("returns no observations, because it has nothing to attribute them to", async () => {
    const result = await mockResearchProvider.research(
      input({ website: "https://example.test", phone: "+1 514 271 3898" }),
    );
    expect(result.observations).toEqual([]);
  });

  it("does not echo the input back as though it had discovered it", async () => {
    // The lead's own values reach the profile through application code, cited
    // to the stored record. A researcher re-reporting them would attribute our
    // own data to a source that never existed.
    const result = await mockResearchProvider.research(input());
    const serialised = JSON.stringify({
      sources: result.sources,
      observations: result.observations,
    });

    expect(serialised).not.toContain("Salon Milano");
    expect(serialised).not.toContain("271 3898");
    expect(serialised).not.toContain("Beaubien");
  });

  it("returns only the four permitted keys", async () => {
    const result = await mockResearchProvider.research(input());
    expect(Object.keys(result).sort()).toEqual([
      "coverage",
      "limitations",
      "observations",
      "sources",
    ]);
  });
});

describe("it reports honestly on what it did not do", () => {
  it("marks every area it is responsible for as not researched", async () => {
    const result = await mockResearchProvider.research(input());
    const byArea = new Map(result.coverage.map((c) => [c.area, c]));

    for (const area of ["web", "business", "reputation"] as const) {
      expect(byArea.get(area)?.status, area).toBe("not-researched");
      expect(byArea.get(area)?.note.length).toBeGreaterThan(0);
    }
  });

  it("never claims to have covered an area", async () => {
    const result = await mockResearchProvider.research(input());
    expect(result.coverage.every((c) => c.status !== "covered")).toBe(true);
  });

  it("reports only areas it owns, leaving the rest to application code", async () => {
    const result = await mockResearchProvider.research(input());
    const areas = result.coverage.map((c) => c.area);
    expect(areas).not.toContain("identity");
    expect(areas).not.toContain("contact");
    expect(new Set(areas).size).toBe(areas.length);
    for (const area of areas) expect(Object.keys(RESEARCH_AREA_LABELS)).toContain(area);
  });

  it("distinguishes a listed website it did not fetch from no website at all", async () => {
    const withSite = await mockResearchProvider.research(input({ website: "https://example.test" }));
    const withoutSite = await mockResearchProvider.research(input({ website: null }));

    const note = (r: typeof withSite) =>
      r.coverage.find((c) => c.area === "web")?.note.toLowerCase() ?? "";

    expect(note(withSite)).toContain("not been fetched");
    expect(note(withoutSite)).toContain("listed no website");
  });

  it("states plainly that an absent value means nobody looked", async () => {
    const result = await mockResearchProvider.research(input());
    const text = result.limitations.join(" ").toLowerCase();

    expect(text).toContain("no external source was consulted");
    expect(text).toContain("nobody looked");
  });

  it("does not present a missing website as proof there is none", async () => {
    const result = await mockResearchProvider.research(input({ website: null }));
    const text = result.limitations.join(" ").toLowerCase();
    expect(text).toContain("not proof");
  });
});
