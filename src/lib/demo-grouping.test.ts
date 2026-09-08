import { describe, expect, it } from "vitest";

import { groupDemosByLead } from "./demo-grouping";
import type { DemoSite } from "./demo-site";

/**
 * The bug this fixes: generating twice for one salon put two cards on the
 * index, as though there were two prospects. The append-only store is right;
 * a flat listing of it is not.
 */

function demo(over: Partial<DemoSite> & Pick<DemoSite, "id" | "leadId">): DemoSite {
  return {
    analysisId: "analysis-1",
    status: "generated",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    generator: { name: "mock", model: "deterministic-demo-rules-v2" },
    spec: {
      business: {
        name: "Salon Bella",
        category: "Hair salon",
        city: "Montreal",
        phone: null,
        address: null,
        websiteListed: false,
        source: "osm",
        snapshotFetchedAt: "2026-01-01T00:00:00.000Z",
        socialLinks: [],
        openingHours: [],
        bookingUrl: null,
        ownDescription: null,
        profileSourced: false,
      },
      content: {
        siteTitle: "Salon Bella",
        tagline: "Hair salon in Montreal",
        theme: "calm-minimal",
        navigation: [],
        sections: [],
        footer: { note: "n" },
      },
    },
    ...over,
  };
}

describe("groupDemosByLead", () => {
  it("returns one group per lead, not one per demo", () => {
    const groups = groupDemosByLead([
      demo({ id: "d1", leadId: "lead-a" }),
      demo({ id: "d2", leadId: "lead-a" }),
      demo({ id: "d3", leadId: "lead-b" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.leadId).sort()).toEqual(["lead-a", "lead-b"]);
  });

  it("picks the newest demo as the one shown", () => {
    const groups = groupDemosByLead([
      demo({ id: "old", leadId: "lead-a", createdAt: "2026-01-01T00:00:00.000Z" }),
      demo({ id: "new", leadId: "lead-a", createdAt: "2026-03-01T00:00:00.000Z" }),
    ]);

    expect(groups[0].latest.id).toBe("new");
  });

  it("keeps every version, newest first, with the latest at index 0", () => {
    const groups = groupDemosByLead([
      demo({ id: "b", leadId: "lead-a", createdAt: "2026-02-01T00:00:00.000Z" }),
      demo({ id: "c", leadId: "lead-a", createdAt: "2026-03-01T00:00:00.000Z" }),
      demo({ id: "a", leadId: "lead-a", createdAt: "2026-01-01T00:00:00.000Z" }),
    ]);

    expect(groups[0].versions.map((v) => v.id)).toEqual(["c", "b", "a"]);
    expect(groups[0].versions[0]).toBe(groups[0].latest);
  });

  it("orders groups by their newest demo", () => {
    const groups = groupDemosByLead([
      demo({ id: "a1", leadId: "lead-a", createdAt: "2026-01-01T00:00:00.000Z" }),
      demo({ id: "b1", leadId: "lead-b", createdAt: "2026-05-01T00:00:00.000Z" }),
      demo({ id: "c1", leadId: "lead-c", createdAt: "2026-03-01T00:00:00.000Z" }),
    ]);

    expect(groups.map((g) => g.leadId)).toEqual(["lead-b", "lead-c", "lead-a"]);
  });

  it("breaks a createdAt tie deterministically rather than by input order", () => {
    // Generation is fast and timestamps are whole milliseconds, so ties are
    // real. Without a tiebreak the page reshuffles between renders.
    const same = "2026-01-01T00:00:00.000Z";
    const one = groupDemosByLead([
      demo({ id: "aaa", leadId: "lead-a", createdAt: same }),
      demo({ id: "zzz", leadId: "lead-a", createdAt: same }),
    ]);
    const other = groupDemosByLead([
      demo({ id: "zzz", leadId: "lead-a", createdAt: same }),
      demo({ id: "aaa", leadId: "lead-a", createdAt: same }),
    ]);

    expect(one[0].latest.id).toBe(other[0].latest.id);
    expect(one[0].versions.map((v) => v.id)).toEqual(other[0].versions.map((v) => v.id));
  });

  it("handles an empty list", () => {
    expect(groupDemosByLead([])).toEqual([]);
  });

  it("does not mutate the array it was given", () => {
    const input = [
      demo({ id: "b", leadId: "lead-a", createdAt: "2026-02-01T00:00:00.000Z" }),
      demo({ id: "a", leadId: "lead-a", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const before = input.map((d) => d.id);
    groupDemosByLead(input);
    expect(input.map((d) => d.id)).toEqual(before);
  });
});
