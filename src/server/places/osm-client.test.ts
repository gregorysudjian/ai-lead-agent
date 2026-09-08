import { describe, expect, it } from "vitest";

import { createOpenStreetMapProvider, type FetchLike } from "./osm";
import { ProviderUnavailableError, ProviderValidationError } from "./types";

/**
 * The HTTP seam is injected, so these tests exercise request shape and error
 * mapping with NO real network access and no mocking framework.
 */
const ENDPOINT = "https://overpass.test/api/interpreter";

interface Call {
  url: string;
  init: Parameters<FetchLike>[1];
}

function stubFetch(
  handler: (call: Call) => Awaited<ReturnType<FetchLike>> | Promise<Awaited<ReturnType<FetchLike>>>,
) {
  const calls: Call[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return handler({ url, init });
  };
  return { impl, calls };
}

const ok = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

const provider = (impl: FetchLike) =>
  createOpenStreetMapProvider({
    fetchImpl: impl,
    endpoint: ENDPOINT,
    now: () => new Date("2026-09-05T12:00:00.000Z"),
    // Disabled so each test is independent of process-level cache state.
    useCache: false,
  });

const QUERY = { category: "hair salons", city: "Montreal" };

describe("O. request shape", () => {
  it("POSTs the query to the configured endpoint", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await provider(impl).search(QUERY);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].init.method).toBe("POST");
  });

  it("sends an identifying User-Agent, as the OSM usage policy requires", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await provider(impl).search(QUERY);
    const ua = calls[0].init.headers["User-Agent"];
    expect(ua).toContain("business-lead-finder");
    expect(ua).toContain("OpenStreetMap");
  });

  it("carries the query in the body, not a giant URL", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await provider(impl).search(QUERY);

    const body = decodeURIComponent(calls[0].init.body);
    expect(calls[0].url).not.toContain("shop");
    expect(body).toContain('["wikidata"="Q340"]');
    expect(body).toContain('["shop"="hairdresser"]');
    expect(body).toContain("[out:json]");
  });

  it("passes an abort signal so the request cannot hang forever", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await provider(impl).search(QUERY);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].init.signal.aborted).toBe(false);
  });
});

describe("O. validation happens before any network call", () => {
  it("rejects an unsupported city without contacting the provider", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await expect(provider(impl).search({ ...QUERY, city: "Toronto" })).rejects.toBeInstanceOf(
      ProviderValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  it("rejects an unsupported category without contacting the provider", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await expect(
      provider(impl).search({ ...QUERY, category: "tattoo parlour" }),
    ).rejects.toBeInstanceOf(ProviderValidationError);
    expect(calls).toHaveLength(0);
  });

  it("names supported values in the client-safe message", async () => {
    const { impl } = stubFetch(() => ok({ elements: [] }));
    const error = await provider(impl)
      .search({ ...QUERY, city: "Toronto" })
      .then(() => null)
      .catch((e: ProviderValidationError) => e);
    expect(error?.message).toContain("Montreal");
    expect(error?.supported?.cities).toEqual(["Montreal"]);
  });
});

describe("O. upstream error mapping", () => {
  it.each([[429], [500], [502], [503], [504], [400]])(
    "maps HTTP %i to ProviderUnavailableError without leaking the body",
    async (status) => {
      const { impl } = stubFetch(() => ({
        ok: false,
        status,
        json: async () => ({}),
        text: async () => "<html>Overpass internal error: /srv/secret/path</html>",
      }));

      const error = await provider(impl)
        .search(QUERY)
        .then(() => null)
        .catch((e: Error) => e);

      expect(error).toBeInstanceOf(ProviderUnavailableError);
      expect(error?.message).toBe(`Overpass returned HTTP ${status}.`);
      expect(error?.message).not.toContain("html");
      expect(error?.message).not.toContain("/srv/");
    },
  );

  it("does not retry a failed request", async () => {
    const { impl, calls } = stubFetch(() => ({
      ok: false, status: 429, json: async () => ({}), text: async () => "rate limited",
    }));
    await provider(impl).search(QUERY).catch(() => undefined);
    expect(calls).toHaveLength(1);
  });

  it("maps a network error to ProviderUnavailableError", async () => {
    const { impl } = stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(provider(impl).search(QUERY)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("maps an aborted (timed out) request to a timeout error", async () => {
    const { impl } = stubFetch(() => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      throw error;
    });
    const error = await provider(impl).search(QUERY).then(() => null).catch((e: Error) => e);
    expect(error).toBeInstanceOf(ProviderUnavailableError);
    expect(error?.message).toBe("Overpass request timed out.");
  });

  it("maps invalid JSON to ProviderUnavailableError", async () => {
    const { impl } = stubFetch(() => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
      text: async () => "<html>",
    }));
    await expect(provider(impl).search(QUERY)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it.each([[{}], [{ elements: null }], [{ elements: "nope" }], [null], ["string"], [42]])(
    "rejects a structurally malformed response: %j",
    async (payload) => {
      const { impl } = stubFetch(() => ok(payload));
      await expect(provider(impl).search(QUERY)).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    },
  );

  it("never falls back to mock data when the provider fails", async () => {
    const { impl } = stubFetch(() => ({
      ok: false, status: 503, json: async () => ({}), text: async () => "down",
    }));
    await expect(provider(impl).search(QUERY)).rejects.toThrow();
    // i.e. it rejects rather than resolving with substitute fixtures.
  });
});

describe("O. response handling", () => {
  it("normalizes elements into DiscoveredBusiness records", async () => {
    const { impl } = stubFetch(() =>
      ok({
        elements: [
          {
            type: "node",
            id: 42,
            tags: {
              name: "Salon Réel",
              "addr:housenumber": "100",
              "addr:street": "Rue Test",
              phone: "+1 514 555 0100",
              website: "https://real.example.com",
              opening_hours: "Mo-Fr 09:00-17:00",
              wheelchair: "yes",
            },
          },
          { type: "way", id: 42, tags: { name: "Salon Deux" } },
          { type: "node", id: 43 },
        ],
      }),
    );

    const { businesses } = await provider(impl).search(QUERY);
    expect(businesses).toHaveLength(2);
    expect(businesses[0]).toEqual({
      externalId: "node/42",
      source: "osm",
      name: "Salon Réel",
      category: "Hair salon",
      city: "Montreal",
      address: "100 Rue Test",
      phone: "+1 514 555 0100",
      website: "https://real.example.com",
      rating: null,
      reviewCount: null,
      // Parsed now: the fixture tags "Mo-Fr 09:00-17:00", which is inside the
      // subset `parseOsmOpeningHours` fully understands.
      openingHours: [
        { day: "monday", opens: "09:00", closes: "17:00" },
        { day: "tuesday", opens: "09:00", closes: "17:00" },
        { day: "wednesday", opens: "09:00", closes: "17:00" },
        { day: "thursday", opens: "09:00", closes: "17:00" },
        { day: "friday", opens: "09:00", closes: "17:00" },
      ],
      fetchedAt: "2026-09-05T12:00:00.000Z",
    });
    // Same numeric id, different element type -> distinct leads.
    expect(businesses[1].externalId).toBe("way/42");
    // Raw tags never reach the domain object.
    expect(JSON.stringify(businesses)).not.toContain("wheelchair");
  });

  it("returns an empty array when the area has no matches", async () => {
    const { impl } = stubFetch(() => ok({ elements: [] }));
    const result = await provider(impl).search(QUERY);
    expect(result.businesses).toEqual([]);
    expect(result.meta).toEqual({ truncated: false, limit: 60 });
  });

  it("caps the number of businesses returned", async () => {
    const { impl } = stubFetch(() =>
      ok({
        elements: Array.from({ length: 500 }, (_, i) => ({
          type: "node",
          id: i + 1,
          tags: { name: `Salon ${i}` },
        })),
      }),
    );
    const { businesses } = await provider(impl).search(QUERY);
    expect(businesses.length).toBeLessThanOrEqual(60);
  });

  it("issues one request per search - no crawling of other categories", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    const p = provider(impl);
    await p.search(QUERY);
    await p.search({ category: "cafe", city: "Montreal" });
    expect(calls).toHaveLength(2);
  });

  it("reports its provider name as osm", () => {
    const { impl } = stubFetch(() => ok({ elements: [] }));
    expect(provider(impl).name).toBe("osm");
  });
});

describe("in-memory cache", () => {
  it("serves a repeated identical search without a second upstream request", async () => {
    const { impl, calls } = stubFetch(() =>
      ok({ elements: [{ type: "node", id: 1, tags: { name: "Cached Salon" } }] }),
    );
    const cached = createOpenStreetMapProvider({
      fetchImpl: impl,
      endpoint: ENDPOINT,
      now: () => new Date("2026-09-05T12:00:00.000Z"),
      useCache: true,
    });

    const first = await cached.search({ category: "florist", city: "Montreal" });
    const second = await cached.search({ category: "florist", city: "Montreal" });

    expect(calls).toHaveLength(1);
    expect(second).toEqual(first);
    expect(second.meta).toEqual(first.meta);
  });

  it("collapses concurrent identical searches into one upstream request", async () => {
    let resolveResponse: (v: Awaited<ReturnType<FetchLike>>) => void = () => {};
    const pending = new Promise<Awaited<ReturnType<FetchLike>>>((r) => {
      resolveResponse = r;
    });
    const { impl, calls } = stubFetch(() => pending);
    const cached = createOpenStreetMapProvider({
      fetchImpl: impl, endpoint: ENDPOINT, useCache: true,
    });

    const a = cached.search({ category: "bakery", city: "Montreal" });
    const b = cached.search({ category: "bakery", city: "Montreal" });
    resolveResponse(ok({ elements: [{ type: "node", id: 9, tags: { name: "One" } }] }));

    const [ra, rb] = await Promise.all([a, b]);
    expect(calls).toHaveLength(1);
    expect(ra).toEqual(rb);
  });
});

describe("truncation sentinel", () => {
  const elements = (n: number, opts: { unusable?: number } = {}) => {
    const usable = Array.from({ length: n - (opts.unusable ?? 0) }, (_, i) => ({
      type: "node", id: i + 1, tags: { name: `Salon ${i + 1}` },
    }));
    const junk = Array.from({ length: opts.unusable ?? 0 }, (_, i) => ({
      type: "node", id: 100000 + i, // no name tag -> skipped by normalization
    }));
    return [...usable, ...junk];
  };

  it("requests 61 elements while showing at most 60", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: [] }));
    await provider(impl).search(QUERY);
    // Parse the form body properly: URLSearchParams encodes spaces as "+".
    const sent = new URLSearchParams(calls[0].init.body).get("data") ?? "";
    expect(sent).toContain("out center tags 61;");
    expect(sent).not.toContain("out center tags 60;");
  });

  it.each([
    [0, false], [1, false], [59, false], [60, false],
  ])("%i upstream elements -> truncated %s", async (n, truncated) => {
    const { impl } = stubFetch(() => ok({ elements: elements(n) }));
    const result = await provider(impl).search(QUERY);
    expect(result.businesses).toHaveLength(n);
    expect(result.meta.truncated).toBe(truncated);
    expect(result.meta.limit).toBe(60);
  });

  it("61 upstream elements -> truncated true, at most 60 returned", async () => {
    const { impl } = stubFetch(() => ok({ elements: elements(61) }));
    const result = await provider(impl).search(QUERY);
    expect(result.meta.truncated).toBe(true);
    expect(result.businesses).toHaveLength(60);
    expect(result.businesses.length).toBeLessThanOrEqual(60);
    expect(result.meta.limit).toBe(60);
  });

  it("stays truncated when some of the 61 are unusable (conservative)", async () => {
    // 61 upstream elements, 10 nameless. Only 51 normalize -- but the PROVIDER
    // query still hit its cap, so more matching records may exist upstream.
    const { impl } = stubFetch(() => ok({ elements: elements(61, { unusable: 10 }) }));
    const result = await provider(impl).search(QUERY);
    expect(result.businesses).toHaveLength(51);
    expect(result.meta.truncated).toBe(true);
  });

  it("does not fetch again to backfill skipped records", async () => {
    const { impl, calls } = stubFetch(() => ok({ elements: elements(61, { unusable: 30 }) }));
    await provider(impl).search(QUERY);
    expect(calls).toHaveLength(1);
  });

  it("never reports truncated for an under-cap result even with unusable records", async () => {
    const { impl } = stubFetch(() => ok({ elements: elements(40, { unusable: 15 }) }));
    const result = await provider(impl).search(QUERY);
    expect(result.businesses).toHaveLength(25);
    expect(result.meta.truncated).toBe(false);
  });
});

describe("cache preserves search metadata", () => {
  it("a cache hit reports the same businesses AND the same truncation flag", async () => {
    const many = Array.from({ length: 61 }, (_, i) => ({
      type: "node", id: i + 1, tags: { name: `Cached ${i + 1}` },
    }));
    const { impl, calls } = stubFetch(() => ok({ elements: many }));
    const cached = createOpenStreetMapProvider({
      fetchImpl: impl, endpoint: ENDPOINT,
      now: () => new Date("2026-09-05T12:00:00.000Z"), useCache: true,
    });

    const first = await cached.search({ category: "gym", city: "Montreal" });
    const second = await cached.search({ category: "gym", city: "Montreal" });

    expect(calls).toHaveLength(1);
    expect(first.meta).toEqual({ truncated: true, limit: 60 });
    expect(second.meta).toEqual(first.meta);
    expect(second.businesses).toEqual(first.businesses);
    expect(second).toEqual(first);
  });

  it("concurrent identical searches share one upstream call and one result", async () => {
    let resolveResponse: (v: Awaited<ReturnType<FetchLike>>) => void = () => {};
    const pending = new Promise<Awaited<ReturnType<FetchLike>>>((r) => {
      resolveResponse = r;
    });
    const { impl, calls } = stubFetch(() => pending);
    const cached = createOpenStreetMapProvider({
      fetchImpl: impl, endpoint: ENDPOINT, useCache: true,
    });

    // A category no other test caches: the in-memory cache is module-level and
    // shared across the file, so reusing a key would silently skip the fetch.
    const a = cached.search({ category: "car repair", city: "Montreal" });
    const b = cached.search({ category: "car repair", city: "Montreal" });
    resolveResponse(
      ok({ elements: Array.from({ length: 61 }, (_, i) => ({
        type: "node", id: i + 1, tags: { name: `X${i}` } })) }),
    );

    const [ra, rb] = await Promise.all([a, b]);
    expect(calls).toHaveLength(1);
    expect(ra.meta.truncated).toBe(true);
    expect(rb.meta).toEqual(ra.meta);
  });
});
