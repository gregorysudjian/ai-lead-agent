import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ResearchProviderInput } from "@/lib/business-profile";

import {
  createGoogleWebsiteLocator,
  noWebsiteLocator,
  type LocatorFetchLike,
} from "./website-locator";

/** No request reaches Google from this file: the fetch and key are injected. */

const KEY = "test-key-not-real";

const input = (over: Partial<ResearchProviderInput> = {}): ResearchProviderInput => ({
  businessName: "G&G Barbershop",
  category: "Barber shop",
  city: "Montreal",
  sourceLabel: "OpenStreetMap",
  phone: "+1 514 844 4384",
  address: "28 Avenue des Pins Est",
  website: null,
  ...over,
});

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function stub(
  payload: unknown,
  options: { ok?: boolean; status?: number; throws?: unknown } = {},
) {
  const calls: Call[] = [];
  const fetchImpl: LocatorFetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (options.throws) throw options.throws;
    return { ok: options.ok ?? true, status: options.status ?? 200, json: async () => payload };
  };
  return { calls, fetchImpl };
}

const locator = (fetchImpl: LocatorFetchLike, apiKey: () => string = () => KEY) =>
  createGoogleWebsiteLocator({ fetchImpl, apiKey });

/** The same business, as Google would describe it. */
const MATCHING = {
  displayName: { text: "G&G Barbershop" },
  formattedAddress: "28 Av. des Pins E, Montreal, QC",
  internationalPhoneNumber: "+1 514-844-4384",
  websiteUri: "https://ggbarbershop.com/",
};

describe("the locator returns a URL, and nothing else", () => {
  it("returns the website of a confidently matched business", async () => {
    const { fetchImpl } = stub({ places: [MATCHING] });
    const found = await locator(fetchImpl)(input());

    // Exactly two keys. Every other Places field stops in this module.
    expect(found).toEqual({ url: "https://ggbarbershop.com/", matchedBy: "name-and-phone" });
    expect(Object.keys(found!)).toEqual(["url", "matchedBy"]);
  });

  it("leaks no name, address, phone, rating or review count", async () => {
    const { fetchImpl } = stub({
      places: [{ ...MATCHING, rating: 4.6, userRatingCount: 312 }],
    });
    const found = await locator(fetchImpl)(input());

    const serialized = JSON.stringify(found);
    for (const leak of ["G&G", "Pins", "844", "4.6", "312", "displayName"]) {
      expect(serialized, leak).not.toContain(leak);
    }
  });

  it("matches on name and address when the phone is missing", async () => {
    const { fetchImpl } = stub({
      places: [
        {
          displayName: { text: "G&G Barbershop" },
          formattedAddress: "28 Avenue des Pins Est",
          websiteUri: "https://ggbarbershop.com/",
        },
      ],
    });

    const found = await locator(fetchImpl)(input({ phone: null }));
    expect(found?.matchedBy).toBe("name-and-address");
  });
});

describe("it refuses to hand back somebody else's homepage", () => {
  it("rejects a different business with a similar name", async () => {
    const { fetchImpl } = stub({
      places: [
        {
          displayName: { text: "GG Barbershop" },
          formattedAddress: "900 Rue Sainte-Catherine",
          internationalPhoneNumber: "+1 514-000-0000",
          websiteUri: "https://not-them.example/",
        },
      ],
    });

    expect(await locator(fetchImpl)(input())).toBeNull();
  });

  it("rejects the same name at a different address with a different phone", async () => {
    const { fetchImpl } = stub({
      places: [
        {
          displayName: { text: "G&G Barbershop" },
          formattedAddress: "900 Rue Sainte-Catherine",
          internationalPhoneNumber: "+1 514-000-0000",
          websiteUri: "https://not-them.example/",
        },
      ],
    });

    expect(await locator(fetchImpl)(input())).toBeNull();
  });

  it("returns nothing when the matched business has no website either", async () => {
    const { fetchImpl } = stub({ places: [{ ...MATCHING, websiteUri: undefined }] });
    expect(await locator(fetchImpl)(input())).toBeNull();
  });

  it("refuses a website that is not an http(s) URL", async () => {
    for (const websiteUri of ["javascript:alert(1)", "ftp://x.example", "nonsense"]) {
      const { fetchImpl } = stub({ places: [{ ...MATCHING, websiteUri }] });
      expect(await locator(fetchImpl)(input()), websiteUri).toBeNull();
    }
  });

  it("stops at the first confident match rather than wandering on", async () => {
    // The right business has no site; a later, different shop does. Taking that
    // one would attach a stranger's homepage to this lead.
    const { fetchImpl } = stub({
      places: [
        { ...MATCHING, websiteUri: undefined },
        {
          displayName: { text: "Someone Else" },
          formattedAddress: "1 Elsewhere",
          websiteUri: "https://someone-else.example/",
        },
      ],
    });

    expect(await locator(fetchImpl)(input())).toBeNull();
  });
});

describe("the request is minimal and never repeated", () => {
  it("asks only for the fields needed to answer and to verify", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await locator(fetchImpl)(input());

    expect(calls[0].headers["X-Goog-FieldMask"].split(",").sort()).toEqual([
      "places.displayName",
      "places.formattedAddress",
      "places.internationalPhoneNumber",
      "places.websiteUri",
    ]);
    // Nothing that could not change the answer.
    for (const field of ["rating", "userRatingCount", "photos", "reviews", "id"]) {
      expect(calls[0].headers["X-Goog-FieldMask"], field).not.toContain(field);
    }
  });

  it("sends the key only in the documented header", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await locator(fetchImpl)(input());

    expect(calls[0].headers["X-Goog-Api-Key"]).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
    expect(JSON.stringify(calls[0].body)).not.toContain(KEY);
  });

  it("identifies the business in the query rather than browsing a category", async () => {
    const { calls, fetchImpl } = stub({ places: [] });
    await locator(fetchImpl)(input());

    expect(calls[0].body.textQuery).toBe(
      "G&G Barbershop, 28 Avenue des Pins Est, Montreal",
    );
    expect(calls[0].body.maxResultCount).toBe(5);
  });

  it("makes no request when there is nothing to match against", async () => {
    const { calls, fetchImpl } = stub({ places: [MATCHING] });

    // No address and no phone means no rule could ever fire, so the billable
    // request would buy a result we could not confirm.
    expect(await locator(fetchImpl)(input({ address: null, phone: null }))).toBeNull();
    expect(await locator(fetchImpl)(input({ businessName: "  " }))).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("makes no request when no key is configured", async () => {
    const { calls, fetchImpl } = stub({ places: [MATCHING] });
    const missing = () => {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    };

    expect(await locator(fetchImpl, missing)(input())).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("never retries a failure", async () => {
    for (const options of [
      { ok: false, status: 429 },
      { ok: false, status: 500 },
      { throws: new Error("ECONNRESET") },
    ]) {
      const { calls, fetchImpl } = stub(null, options);
      expect(await locator(fetchImpl)(input())).toBeNull();
      expect(calls, JSON.stringify(options)).toHaveLength(1);
    }
  });

  it("treats a malformed response as nothing found", async () => {
    for (const payload of [null, "text", {}, { places: "nope" }, { places: [null, 42] }]) {
      const { fetchImpl } = stub(payload);
      expect(await locator(fetchImpl)(input()), JSON.stringify(payload)).toBeNull();
    }
  });
});

describe("the default locates nothing", () => {
  it("returns null without being configured", async () => {
    expect(await noWebsiteLocator(input())).toBeNull();
  });
});

describe("the Google data boundary is structural", () => {
  const file = readFileSync(
    join(process.cwd(), "src", "server", "research", "website-locator.ts"),
    "utf8",
  );

  it("writes to no repository", () => {
    // The whole point: Places content is used and discarded. A repository
    // import here would be the shortest path to warehousing it.
    expect(file).not.toContain("@/server/repo");
    // A type import from the domain module is fine; a repository call is not.
    expect(file).not.toContain("getBusinessProfileRepository");
    expect(file).not.toContain(".create(");
  });

  it("is server-only", () => {
    expect(file).toContain('import "server-only"');
  });

  it("requests no field the Maps terms would let us keep", () => {
    // place_id is storable indefinitely, so it is the one field we could have
    // kept -- and we do not even ask for it, because this module stores
    // nothing at all.
    expect(file).not.toContain("places.id");
    expect(file).not.toContain("places.rating");
    expect(file).not.toContain("places.userRatingCount");
  });
});
