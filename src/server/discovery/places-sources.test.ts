import { describe, expect, it } from "vitest";

import { SUPPORTED_CATEGORIES } from "@/lib/osm/categories";
import { SUPPORTED_CITIES } from "@/lib/osm/cities";
import type { PlacesProvider } from "@/server/places/types";
import { ProviderUnavailableError, ProviderValidationError } from "@/server/places/types";

import { createMockDiscoverySource, createOsmDiscoverySource } from "./places-sources";
import { DiscoverySourceError } from "./types";
import type { DiscoveryRequest } from "./types";

/** The existing providers are stubbed; no Overpass request is made here. */

const REQUEST: DiscoveryRequest = {
  city: SUPPORTED_CITIES.find((c) => c.key === "montreal")!,
  category: SUPPORTED_CATEGORIES.find((c) => c.key === "barber")!,
};

function provider(
  impl: PlacesProvider["search"],
  name = "osm",
): PlacesProvider & { queries: { city: string; category: string }[] } {
  const queries: { city: string; category: string }[] = [];
  return {
    name,
    queries,
    async search(query) {
      queries.push(query);
      return impl(query);
    },
  };
}

const empty = async () => ({ businesses: [], meta: { truncated: false, limit: 60 } });

describe("the existing providers are adapted, not rewritten", () => {
  it("hands the provider the registry's canonical labels", async () => {
    const osm = provider(empty);
    await createOsmDiscoverySource(osm).search(REQUEST);

    // Never the user's raw text: the registry has already resolved it.
    expect(osm.queries).toEqual([{ city: "Montreal", category: "Barber shop" }]);
  });

  it("passes the provider's own truncation metadata through unchanged", async () => {
    const osm = provider(async () => ({
      businesses: [],
      meta: { truncated: true, limit: 60 },
    }));

    const result = await createOsmDiscoverySource(osm).search(REQUEST);
    expect(result.meta).toEqual({ truncated: true, limit: 60 });
  });

  it("marks OpenStreetMap as a source we persist from", () => {
    expect(createOsmDiscoverySource(provider(empty)).persistable).toBe(true);
    expect(createOsmDiscoverySource(provider(empty)).name).toBe("osm");
  });

  it("marks the mock source as persistable, since it feeds the same path", () => {
    expect(createMockDiscoverySource(provider(empty, "mock")).persistable).toBe(true);
  });
});

describe("provider failures become source failures", () => {
  it("maps an unavailable provider without leaking its message", async () => {
    const osm = provider(async () => {
      throw new ProviderUnavailableError("Overpass returned HTTP 429 for key abc");
    });

    const thrown = (await createOsmDiscoverySource(osm)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown).toBeInstanceOf(DiscoverySourceError);
    expect(thrown.reason).toBe("unavailable");
    expect(thrown.message).not.toContain("429");
    expect(thrown.message).not.toContain("abc");
  });

  it("maps a validation error to an unsupported request", async () => {
    const osm = provider(async () => {
      throw new ProviderValidationError("unsupported city");
    });

    const thrown = (await createOsmDiscoverySource(osm)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown.reason).toBe("unsupported-request");
  });

  it("maps an unexpected error rather than letting it escape", async () => {
    const osm = provider(async () => {
      throw new TypeError("undefined is not a function");
    });

    const thrown = (await createOsmDiscoverySource(osm)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown).toBeInstanceOf(DiscoverySourceError);
    expect(thrown.message).not.toContain("undefined is not a function");
  });
});
