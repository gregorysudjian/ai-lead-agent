import "server-only";

import { crossSourceMatch, type CandidateMatchReason } from "@/lib/discovery/candidates";
import type { ResearchProviderInput } from "@/lib/business-profile";
import { googlePlacesApiKey } from "@/server/env";

/**
 * Find the URL of a business's own website, when our discovery record has none.
 *
 * ── GOOGLE IS A POINTER, NOT A STORE ──────────────────────────────────────
 *
 * The Google Maps Platform terms permit storing the `place_id` indefinitely and
 * latitude/longitude for up to 30 days. Everything else the Places API returns
 * -- display name, formatted address, phone number, website URI, rating, review
 * count, opening hours -- must be requested live and displayed, NOT warehoused.
 *
 * That rules out the obvious design, which was to copy Google's phone numbers
 * and websites into a BusinessProfile. A profile is append-only evidence; it is
 * the exact opposite of a cache that can be expired, and filling it with Places
 * content would be building the database the terms forbid.
 *
 * So this module does the one thing that stays inside the rules and still
 * solves the problem: it uses Google TRANSIENTLY to answer a single question --
 * "where is this business's own website?" -- and returns nothing but that URL.
 * The website is then fetched by our own researcher, and what gets STORED is our
 * own reading of the business's own page, attributed to that page. The evidence
 * is ours. Google is how we found the door, not what is written on it.
 *
 * ENFORCED, not just documented:
 *   - the return type carries a URL and a match reason, and nothing else
 *   - no name, address, phone, rating or review count leaves this function
 *   - nothing here writes to any repository
 *   - a test asserts the boundary on both counts
 *
 * ── AND ONLY WHEN WE ARE SURE IT IS THE SAME BUSINESS ─────────────────────
 *
 * A lookup by name can easily return a different shop. The Google record is
 * matched against the lead with `crossSourceMatch` -- the SAME conservative
 * rule discovery uses, requiring an exact name plus an exact address or an
 * exact phone. No confident match means no URL, and the lead keeps its honest
 * "no website found" rather than acquiring somebody else's homepage.
 */

/** Text Search (New). One request, one page, no pagination. */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * The smallest mask that can answer the question and verify the match.
 *
 * `websiteUri` is the answer. `displayName`, `formattedAddress` and
 * `internationalPhoneNumber` exist only to CONFIRM the record is the right
 * business, and are discarded here. No rating, no review count, no hours, no
 * photos: none of them could change the answer, and each is another SKU.
 *
 * The phone is requested in INTERNATIONAL format because our own records store
 * it that way. Google's national format ("(514) 844-4384") could never match
 * our "+1 514 844 4384" digit-for-digit, and the right fix is to compare like
 * with like -- not to teach the match rule to ignore a country code.
 */
const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.websiteUri",
].join(",");

/** One page, small: we are identifying one known business, not browsing. */
const MAX_RESULTS = 5;

const REQUEST_TIMEOUT_MS = 10_000;

/** All that may leave this module. */
export interface LocatedWebsite {
  /** Absolute http(s) URL of the business's own site. */
  url: string;
  /** Which exact rule confirmed the Google record was this business. */
  matchedBy: Exclude<CandidateMatchReason, "same-source-id">;
}

export type WebsiteLocator = (
  input: ResearchProviderInput,
) => Promise<LocatedWebsite | null>;

/**
 * The default: locate nothing.
 *
 * Website research works exactly as before with this in place, and no request
 * reaches Google unless a locator is deliberately configured.
 */
export const noWebsiteLocator: WebsiteLocator = async () => null;

export type LocatorFetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function readDisplayName(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  return readString((value as { text?: unknown }).text, 200);
}

/** http(s) only, bounded, re-serialized from the parser. */
function readWebsite(value: unknown): string | null {
  const raw = readString(value, 2048);
  if (raw === null) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export interface GoogleWebsiteLocatorOptions {
  fetchImpl?: LocatorFetchLike;
  apiKey?: () => string;
}

export function createGoogleWebsiteLocator(
  options: GoogleWebsiteLocatorOptions = {},
): WebsiteLocator {
  const readKey = options.apiKey ?? googlePlacesApiKey;

  return async (input: ResearchProviderInput): Promise<LocatedWebsite | null> => {
    // Nothing to look up, or nothing to match against. A name is the anchor of
    // every match rule, and without an address or phone no rule can fire, so
    // the request would be spent on a result we could never confirm.
    if (input.businessName.trim().length === 0) return null;
    if (input.address === null && input.phone === null) return null;

    let apiKey: string;
    try {
      apiKey = readKey();
    } catch {
      // Not configured is not an error here: the researcher simply reports that
      // no website was found, which is what it would have said anyway.
      return null;
    }

    const textQuery = [input.businessName, input.address, input.city]
      .filter((part): part is string => part !== null && part.trim().length > 0)
      .join(", ");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Awaited<ReturnType<LocatorFetchLike>>;
    try {
      response = await (options.fetchImpl ??
        (globalThis.fetch as unknown as LocatorFetchLike))(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: MAX_RESULTS,
          languageCode: "en",
        }),
        signal: controller.signal,
      });
    } catch {
      // A lookup failure is not evidence about the business. No retry: this
      // runs on a billable endpoint and a loop is a bill, not a fix.
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return null;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return null;
    }

    if (typeof payload !== "object" || payload === null) return null;
    const places = (payload as { places?: unknown }).places;
    if (!Array.isArray(places)) return null;

    const target = {
      name: input.businessName,
      address: input.address,
      phone: input.phone,
    };

    for (const place of places.slice(0, MAX_RESULTS)) {
      if (typeof place !== "object" || place === null) continue;
      const record = place as Record<string, unknown>;

      const name = readDisplayName(record.displayName);
      if (name === null) continue;

      const matchedBy = crossSourceMatch(target, {
        name,
        address: readString(record.formattedAddress, 300),
        // The INTERNATIONAL format, deliberately. Our discovery records store
        // "+1 514 844 4384"; Google's national format is "(514) 844-4384", and
        // since the match rule never strips a country code, comparing those two
        // could never succeed. Comparing like with like is the fix -- loosening
        // the rule would have been the bug.
        phone: readString(record.internationalPhoneNumber, 50),
      });
      if (matchedBy === null) continue;

      const url = readWebsite(record.websiteUri);
      // A confident match with no website is a real answer -- this business has
      // no site listed there either -- and it stops the loop rather than
      // wandering on to a different shop that happens to have one.
      return url === null ? null : { url, matchedBy };
    }

    return null;
  };
}
