import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUPPORTED_CATEGORIES } from "@/lib/osm/categories";
import { SUPPORTED_CITIES } from "@/lib/osm/cities";

import {
  createGooglePlacesSource,
  GOOGLE_RESULT_LIMIT,
  normalizeGooglePlace,
  type GoogleFetchLike,
} from "./google-source";
import { DiscoverySourceError } from "./types";
import type { DiscoveryRequest } from "./types";

/**
 * NO REQUEST REACHES GOOGLE FROM THIS FILE. Every call goes through an injected
 * stub, and the key is injected too, so the tests need no credential and cannot
 * spend anything.
 */

const AT = new Date("2026-09-07T12:00:00.000Z");
const KEY = "test-key-not-real";

const REQUEST: DiscoveryRequest = {
  city: SUPPORTED_CITIES.find((c) => c.key === "montreal")!,
  category: SUPPORTED_CATEGORIES.find((c) => c.key === "barber")!,
};

interface Call {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Records exactly what would have been sent, and replies with a fixture. */
function stub(
  payload: unknown,
  options: { ok?: boolean; status?: number; throws?: unknown } = {},
) {
  const calls: Call[] = [];
  const fetchImpl: GoogleFetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (options.throws) throw options.throws;
    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      json: async () => payload,
    };
  };
  return { calls, fetchImpl };
}

const source = (fetchImpl: GoogleFetchLike, apiKey: () => string = () => KEY) =>
  createGooglePlacesSource({ fetchImpl, apiKey, now: () => AT });

const PLACE = {
  id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
  displayName: { text: "G&G Barbershop", languageCode: "en" },
  formattedAddress: "28 Av. des Pins E, Montreal, QC H2W 1N3, Canada",
  primaryType: "hair_care",
  primaryTypeDisplayName: { text: "Barber shop", languageCode: "en" },
  nationalPhoneNumber: "(514) 844-4384",
  websiteUri: "https://ggbarbershop.com/",
  rating: 4.6,
  userRatingCount: 312,
};

describe("the request is minimal, and the key never leaves the header", () => {
  it("posts to the official Text Search endpoint", async () => {
    const { calls, fetchImpl } = stub({ places: [PLACE] });
    await source(fetchImpl).search(REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://places.googleapis.com/v1/places:searchText");
  });

  it("sends the key in the documented header and nowhere else", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await source(fetchImpl).search(REQUEST);

    expect(calls[0].headers["X-Goog-Api-Key"]).toBe(KEY);
    // Not in the URL, not in the body, not in any other header.
    expect(calls[0].url).not.toContain(KEY);
    expect(JSON.stringify(calls[0].body)).not.toContain(KEY);
    const otherHeaders = { ...calls[0].headers };
    delete otherHeaders["X-Goog-Api-Key"];
    expect(JSON.stringify(otherHeaders)).not.toContain(KEY);
  });

  it("asks for exactly the fields discovery needs", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await source(fetchImpl).search(REQUEST);

    const mask = calls[0].headers["X-Goog-FieldMask"].split(",");
    expect(mask.sort()).toEqual(
      [
        "places.displayName",
        "places.formattedAddress",
        "places.id",
        "places.nationalPhoneNumber",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.rating",
        "places.userRatingCount",
        "places.websiteUri",
      ].sort(),
    );
  });

  it("requests no field that costs a SKU discovery does not need", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await source(fetchImpl).search(REQUEST);

    const mask = calls[0].headers["X-Goog-FieldMask"];
    for (const field of [
      "photos",
      "reviews",
      "regularOpeningHours",
      "editorialSummary",
      "location",
      "priceLevel",
      "plusCode",
      "*",
    ]) {
      expect(mask, field).not.toContain(field);
    }
  });

  it("builds the query from the registry labels, not from raw user text", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await source(fetchImpl).search(REQUEST);

    expect(calls[0].body).toMatchObject({
      textQuery: "Barber shop in Montreal",
      maxResultCount: GOOGLE_RESULT_LIMIT,
    });
  });

  it("caps the page conservatively and asks for one page only", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await source(fetchImpl).search(REQUEST);

    expect(GOOGLE_RESULT_LIMIT).toBeLessThanOrEqual(20);
    const body = calls[0].body as Record<string, unknown>;
    expect(body.pageToken).toBeUndefined();
    expect(body.pageSize).toBeUndefined();
  });

  it("makes exactly one request and never retries", async () => {
    const { calls, fetchImpl } = stub(null, { ok: false, status: 429 });
    await source(fetchImpl).search(REQUEST).catch(() => undefined);

    // A retry loop on a billable endpoint is a bill, not a fix.
    expect(calls).toHaveLength(1);
  });
});

describe("the payload is normalized, and stops at the boundary", () => {
  it("maps a place into our own shape", async () => {
    const { fetchImpl } = stub({ places: [PLACE] });
    const result = await source(fetchImpl).search(REQUEST);

    expect(result.businesses).toEqual([
      {
        externalId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        source: "google",
        name: "G&G Barbershop",
        category: "Barber shop",
        city: "Montreal",
        address: "28 Av. des Pins E, Montreal, QC H2W 1N3, Canada",
        phone: "(514) 844-4384",
        website: "https://ggbarbershop.com/",
        rating: 4.6,
        reviewCount: 312,
        openingHours: null,
        fetchedAt: AT.toISOString(),
      },
    ]);
  });

  it("returns nothing that carries a Google field name", async () => {
    const { fetchImpl } = stub({ places: [PLACE] });
    const result = await source(fetchImpl).search(REQUEST);

    // No raw payload escapes: if it did, something downstream could persist it.
    const serialized = JSON.stringify(result);
    for (const key of [
      "displayName",
      "formattedAddress",
      "primaryTypeDisplayName",
      "userRatingCount",
      "websiteUri",
      "languageCode",
    ]) {
      expect(serialized, key).not.toContain(key);
    }
  });

  it("labels the category from Google's own classification", () => {
    const normalized = normalizeGooglePlace(
      { ...PLACE, primaryTypeDisplayName: undefined },
      { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" },
    );
    expect(normalized?.category).toBe("Hair care");
  });

  it("falls back to the searched category only when Google names none", () => {
    const normalized = normalizeGooglePlace(
      { id: "x", displayName: { text: "Shop" } },
      { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" },
    );
    expect(normalized?.category).toBe("Barber shop");
  });

  it("drops a record with no id or no name rather than inventing one", () => {
    const context = { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" };
    expect(normalizeGooglePlace({ displayName: { text: "No id" } }, context)).toBeNull();
    expect(normalizeGooglePlace({ id: "x" }, context)).toBeNull();
    expect(normalizeGooglePlace({ id: "x", displayName: {} }, context)).toBeNull();
    expect(normalizeGooglePlace(null, context)).toBeNull();
    expect(normalizeGooglePlace("a string", context)).toBeNull();
  });

  it("refuses a website that is not an http(s) URL", () => {
    const context = { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" };
    for (const websiteUri of ["javascript:alert(1)", "ftp://x.example", "not a url", ""]) {
      const normalized = normalizeGooglePlace({ ...PLACE, websiteUri }, context);
      // Absent, which is NOT the same as the business having no website.
      expect(normalized?.website, websiteUri).toBeNull();
    }
  });

  it("refuses a rating or review count outside a plausible range", () => {
    const context = { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" };
    const normalized = normalizeGooglePlace(
      { ...PLACE, rating: 9.9, userRatingCount: -3 },
      context,
    );
    expect(normalized?.rating).toBeNull();
    expect(normalized?.reviewCount).toBeNull();
  });

  it("does not coerce a string rating into a number", () => {
    const normalized = normalizeGooglePlace(
      { ...PLACE, rating: "4.6", userRatingCount: "312" },
      { cityLabel: "Montreal", categoryLabel: "Barber shop", fetchedAt: "t" },
    );
    expect(normalized?.rating).toBeNull();
    expect(normalized?.reviewCount).toBeNull();
  });

  it("reports unknown opening hours as unknown, because none were requested", () => {
    const normalized = normalizeGooglePlace(PLACE, {
      cityLabel: "Montreal",
      categoryLabel: "Barber shop",
      fetchedAt: "t",
    });
    // null (nobody looked), never [] (known to publish none).
    expect(normalized?.openingHours).toBeNull();
  });

  it("skips unusable records but keeps the rest", async () => {
    const { fetchImpl } = stub({ places: [{ nonsense: true }, PLACE, null] });
    const result = await source(fetchImpl).search(REQUEST);
    expect(result.businesses).toHaveLength(1);
  });
});

describe("failures are surfaced as this source failing", () => {
  it("treats an empty response as a successful empty search", async () => {
    const { fetchImpl } = stub({});
    const result = await source(fetchImpl).search(REQUEST);
    expect(result.businesses).toEqual([]);
  });

  it("rejects a response that is not the documented shape", async () => {
    for (const payload of [null, "text", { places: "not an array" }, 42]) {
      const { fetchImpl } = stub(payload);
      const thrown = await source(fetchImpl).search(REQUEST).catch((e: unknown) => e);
      expect(thrown, JSON.stringify(payload)).toBeInstanceOf(DiscoverySourceError);
      expect((thrown as DiscoverySourceError).reason).toBe("invalid-response");
    }
  });

  it("surfaces a quota or API error without leaking the body or the status", async () => {
    const { fetchImpl } = stub(
      { error: { message: "Quota exceeded for key AIza-SECRET", status: "RESOURCE_EXHAUSTED" } },
      { ok: false, status: 429 },
    );
    const thrown = (await source(fetchImpl)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown.reason).toBe("unavailable");
    expect(thrown.message).not.toContain("AIza-SECRET");
    expect(thrown.message).not.toContain("429");
    expect(thrown.message).not.toContain("Quota");
  });

  it("surfaces a network failure as unavailable", async () => {
    const { fetchImpl } = stub(null, { throws: new Error("ECONNRESET") });
    const thrown = (await source(fetchImpl)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown.reason).toBe("unavailable");
    expect(thrown.message).not.toContain("ECONNRESET");
  });

  it("reports a missing key as a configuration failure, and sends no request", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    const missing = () => {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    };

    const thrown = (await source(fetchImpl, missing)
      .search(REQUEST)
      .catch((e: unknown) => e)) as DiscoverySourceError;

    expect(thrown.reason).toBe("not-configured");
    expect(calls).toHaveLength(0);
    expect(thrown.message).not.toContain("GOOGLE_PLACES_API_KEY is not set");
  });

  it("marks the page truncated when it came back full", async () => {
    const places = Array.from({ length: GOOGLE_RESULT_LIMIT }, (_, i) => ({
      ...PLACE,
      id: `place-${i}`,
    }));
    const { fetchImpl } = stub({ places });
    const result = await source(fetchImpl).search(REQUEST);

    expect(result.meta).toEqual({ truncated: true, limit: GOOGLE_RESULT_LIMIT });
  });
});

describe("Google content is not persisted by this phase", () => {
  it("declares itself non-persistable", () => {
    const { fetchImpl } = stub({ places: [] });
    expect(source(fetchImpl).persistable).toBe(false);
  });

  it("is server-only and touches no repository", () => {
    const file = readFileSync(
      join(process.cwd(), "src", "server", "discovery", "google-source.ts"),
      "utf8",
    );

    // The guard that turns an accidental client import into a build error.
    expect(file).toContain('import "server-only"');
    // The adapter discovers; it does not store. A repository import here would
    // be the shortest path to Google content landing in our database.
    expect(file).not.toContain("@/server/repo");
    expect(file).not.toContain("NEXT_PUBLIC");
  });
});
