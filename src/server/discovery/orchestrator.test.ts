import { describe, expect, it } from "vitest";

import type { DiscoverySourceName } from "@/lib/discovery/candidates";
import { SUPPORTED_CATEGORIES } from "@/lib/osm/categories";
import { SUPPORTED_CITIES } from "@/lib/osm/cities";
import type { DiscoveredBusiness, Lead } from "@/lib/types";

import { runDiscovery } from "./orchestrator";
import { DiscoveryFailedError, DiscoverySourceError } from "./types";
import type { DiscoveryRequest, DiscoverySource } from "./types";

/**
 * NO NETWORK ANYWHERE IN THIS FILE. Every source is a stub, so the orchestrator
 * is exercised as what it is: a pure function of the answers it is handed.
 */

const AT = "2026-09-07T12:00:00.000Z";

const REQUEST: DiscoveryRequest = {
  city: SUPPORTED_CITIES.find((c) => c.key === "montreal")!,
  category: SUPPORTED_CATEGORIES.find((c) => c.key === "barber")!,
};

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

/** A source that answers, recording that it was asked. */
function stub(
  name: DiscoverySourceName,
  businesses: DiscoveredBusiness[],
  options: { persistable?: boolean; truncated?: boolean; limit?: number | null } = {},
): DiscoverySource & { asked: number } {
  const source = {
    name,
    persistable: options.persistable ?? name !== "google",
    asked: 0,
    async search() {
      source.asked += 1;
      return {
        businesses,
        meta: { truncated: options.truncated ?? false, limit: options.limit ?? null },
      };
    },
  };
  return source;
}

/** A source that fails. */
function broken(
  name: DiscoverySourceName,
  error: unknown = new DiscoverySourceError("The source could not be reached.", "unavailable"),
): DiscoverySource {
  return {
    name,
    persistable: name !== "google",
    async search(): Promise<never> {
      throw error;
    },
  };
}

function lead(over: Partial<DiscoveredBusiness> = {}, id = "lead-1"): Lead {
  return {
    id,
    status: "new",
    createdAt: AT,
    updatedAt: AT,
    provider: business("osm", "node/1", over),
  };
}

const statusFor = (
  result: Awaited<ReturnType<typeof runDiscovery>>,
  source: DiscoverySourceName,
) => result.statuses.find((s) => s.source === source);

describe("a run asks every configured source", () => {
  it("runs OSM only", async () => {
    const osm = stub("osm", [business("osm", "node/1")]);
    const result = await runDiscovery(REQUEST, [osm], []);

    expect(osm.asked).toBe(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].foundBy).toEqual(["osm"]);
    expect(result.statuses).toHaveLength(1);
  });

  it("runs Google only", async () => {
    const google = stub("google", [business("google", "ChIJabc")]);
    const result = await runDiscovery(REQUEST, [google], []);

    expect(result.candidates[0].foundBy).toEqual(["google"]);
    expect(statusFor(result, "google")).toMatchObject({ status: "ok", count: 1 });
  });

  it("runs OSM and Google together and groups the same business once", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")]), stub("google", [business("google", "ChIJabc")])],
      [],
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].foundBy).toEqual(["osm", "google"]);
    expect(result.candidates[0].observations).toHaveLength(2);
  });

  it("asks each source exactly once", async () => {
    const osm = stub("osm", []);
    const google = stub("google", []);
    await runDiscovery(REQUEST, [osm, google], []);

    // No retry loop, no second page, no fan-out. One run is one request each.
    expect(osm.asked).toBe(1);
    expect(google.asked).toBe(1);
  });

  it("refuses a run with no sources at all", async () => {
    await expect(runDiscovery(REQUEST, [], [])).rejects.toBeInstanceOf(DiscoveryFailedError);
  });
});

describe("failure is reported as failure, never as zero results", () => {
  it("keeps the successful source when the other fails", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")]), broken("google")],
      [],
    );

    expect(result.candidates).toHaveLength(1);
    expect(statusFor(result, "osm")).toMatchObject({ status: "ok", count: 1 });
    expect(statusFor(result, "google")).toMatchObject({
      status: "failed",
      reason: "unavailable",
    });
  });

  it("keeps Google when OSM fails", async () => {
    const result = await runDiscovery(
      REQUEST,
      [broken("osm"), stub("google", [business("google", "ChIJabc")])],
      [],
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].foundBy).toEqual(["google"]);
    expect(statusFor(result, "osm")).toMatchObject({ status: "failed" });
  });

  it("distinguishes a source that failed from one that legitimately found nothing", async () => {
    const result = await runDiscovery(REQUEST, [stub("osm", []), broken("google")], []);

    expect(statusFor(result, "osm")).toMatchObject({ status: "ok", count: 0 });
    expect(statusFor(result, "google")).toMatchObject({ status: "failed" });
  });

  it("fails the whole run when every source fails", async () => {
    const thrown = await runDiscovery(REQUEST, [broken("osm"), broken("google")], []).catch(
      (e: unknown) => e,
    );

    expect(thrown).toBeInstanceOf(DiscoveryFailedError);
    // The statuses survive, so the caller can say WHICH sources failed rather
    // than implying the city has no businesses in it.
    expect((thrown as DiscoveryFailedError).statuses).toHaveLength(2);
  });

  it("reports a non-DiscoverySourceError without leaking its message", async () => {
    const secret = new Error("api key sk-live-123 rejected by upstream");
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")]), broken("google", secret)],
      [],
    );

    const status = statusFor(result, "google");
    expect(status).toMatchObject({ status: "failed", reason: "unavailable" });
    expect(JSON.stringify(status)).not.toContain("sk-live-123");
  });

  it("carries a source's own reason through", async () => {
    const result = await runDiscovery(
      REQUEST,
      [
        stub("osm", [business("osm", "node/1")]),
        broken("google", new DiscoverySourceError("not configured", "not-configured")),
      ],
      [],
    );

    expect(statusFor(result, "google")).toMatchObject({ reason: "not-configured" });
  });
});

describe("truncation is reported, never hidden", () => {
  it("marks the run truncated when any source was capped", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")], { truncated: true, limit: 60 }), stub("google", [])],
      [],
    );

    expect(result.truncated).toBe(true);
    expect(statusFor(result, "osm")).toMatchObject({ truncated: true, limit: 60 });
  });

  it("is not truncated when no source was capped", async () => {
    const result = await runDiscovery(REQUEST, [stub("osm", [business("osm", "node/1")])], []);
    expect(result.truncated).toBe(false);
  });
});

describe("candidates are checked against the leads we already hold", () => {
  it("marks a candidate that matches an existing lead", async () => {
    const existing = lead({}, "lead-42");
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")])],
      [existing],
    );

    expect(result.candidates[0].state).toBe("in-leads");
    expect(result.candidates[0].existingLeadId).toBe("lead-42");
  });

  it("matches an existing lead through any observation in the group", async () => {
    // The lead was stored from OSM; the Google record in the same group is what
    // the display shows, and it still resolves to the same lead.
    const result = await runDiscovery(
      REQUEST,
      [stub("google", [business("google", "ChIJabc")]), stub("osm", [business("osm", "node/1")])],
      [lead({}, "lead-7")],
    );

    expect(result.candidates[0].state).toBe("in-leads");
    expect(result.candidates[0].existingLeadId).toBe("lead-7");
  });

  it("marks an unknown OSM business as addable", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/999", { name: "Nobody's Salon" })])],
      [],
    );

    expect(result.candidates[0].state).toBe("can-add");
    expect(result.candidates[0].existingLeadId).toBeNull();
  });

  it("leaves a Google-only business as a candidate that is not a lead", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("google", [business("google", "ChIJabc")])],
      [],
    );

    expect(result.candidates[0].state).toBe("candidate-only");
    expect(result.candidates[0].existingLeadId).toBeNull();
  });

  it("treats a business found by both as addable when it is not a lead yet", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/1")]), stub("google", [business("google", "ChIJabc")])],
      [],
    );

    expect(result.candidates[0].state).toBe("can-add");
  });

  it("uses the existing dedupe rules, including name and address", async () => {
    // A different place id for the same business at the same address: the
    // repository would refresh that lead, not create a second one, and the
    // candidate view must say the same thing.
    const result = await runDiscovery(
      REQUEST,
      [stub("osm", [business("osm", "node/RENUMBERED")])],
      [lead({}, "lead-9")],
    );

    expect(result.candidates[0].state).toBe("in-leads");
    expect(result.candidates[0].existingLeadId).toBe("lead-9");
  });
});

describe("the run writes nothing", () => {
  it("produces candidates that are not leads", async () => {
    const result = await runDiscovery(
      REQUEST,
      [stub("google", [business("google", "ChIJabc")])],
      [],
    );

    const candidate = result.candidates[0] as unknown as Record<string, unknown>;
    // A candidate has no lead identity, no status and no createdAt. If one ever
    // gains them, it has stopped being a transient search result.
    expect(candidate.id).toBeUndefined();
    expect(candidate.status).toBeUndefined();
    expect(candidate.createdAt).toBeUndefined();
    expect(candidate.provider).toBeUndefined();
  });

  it("does not mutate the leads it was given", async () => {
    const leads = [lead({}, "lead-1")];
    const snapshot = JSON.stringify(leads);

    await runDiscovery(REQUEST, [stub("osm", [business("osm", "node/1")])], leads);

    expect(JSON.stringify(leads)).toBe(snapshot);
  });
});

describe("results are ordered deterministically", () => {
  it("orders candidates by name regardless of which source answered first", async () => {
    const names = ["Zed Cuts", "Alpha Cuts", "Mid Cuts"];
    const sources = [
      stub(
        "osm",
        names.map((name, i) =>
          business("osm", `node/${i}`, { name, address: `${i} Street`, phone: null }),
        ),
      ),
    ];

    const result = await runDiscovery(REQUEST, sources, []);
    expect(result.candidates.map((c) => c.display.name.value)).toEqual([
      "Alpha Cuts",
      "Mid Cuts",
      "Zed Cuts",
    ]);
  });
});
