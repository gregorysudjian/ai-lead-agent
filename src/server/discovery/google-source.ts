import "server-only";

import type { DiscoveredBusiness } from "@/lib/types";
import { googlePlacesApiKey } from "@/server/env";

import type {
  DiscoveryRequest,
  DiscoverySource,
  DiscoverySourceResult,
} from "./types";
import { DiscoverySourceError } from "./types";

/**
 * Discovery via the OFFICIAL Google Places API (New), Text Search endpoint.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * There is no browser here, no Maps page being driven, no HTML being parsed,
 * and nothing that works around a technical restriction. One documented POST to
 * `places.googleapis.com`, authenticated with a server-side key, is the entire
 * integration. If the API says no, that is the answer.
 *
 * ── THE KEY ───────────────────────────────────────────────────────────────
 *
 * Read here, used here, and never anywhere else. It goes in a request header to
 * Google and nowhere near a response, a log line, an error message or the
 * browser. This module imports `server-only`, so a Client Component that
 * imported it -- directly or through a barrel -- would fail the build rather
 * than ship the key in a bundle.
 *
 * ── COST ──────────────────────────────────────────────────────────────────
 *
 * Every call is billable and the FIELD MASK decides the SKU, so the mask below
 * is a cost decision, not a convenience. One request per search, one page, no
 * pagination, no retry, no background refresh, no prefetch. `maxResultCount` is
 * held well under the API's ceiling because a bigger page costs the same per
 * call but tempts the UI into treating discovery as free.
 */

/** Text Search (New). The only endpoint this adapter calls. */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Exactly the fields discovery needs, and nothing else.
 *
 *   id                  the Place ID -- the only Google value we would ever
 *                       retain, and only as an external reference
 *   displayName         transient display, and the anchor for candidate
 *                       matching
 *   formattedAddress    display, and the strongest cross-source match signal
 *   primaryTypeDisplayName / primaryType
 *                       category, so a candidate is labelled by Google's own
 *                       classification rather than our search term
 *   nationalPhoneNumber the second exact match signal, when addresses are
 *                       written differently by the two sources
 *   websiteUri          the website-presence signal, which is the single
 *                       largest factor in lead scoring
 *   rating / userRatingCount
 *                       reputation, carried as candidate display only
 *
 * Not requested, deliberately: photos, reviews, opening hours, editorial
 * summaries, geometry, plus codes, price levels, accessibility. Each is another
 * SKU and none of them changes a discovery decision.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
].join(",");

/** One page, deliberately small. There is no second page in this phase. */
export const GOOGLE_RESULT_LIMIT = 20;

const REQUEST_TIMEOUT_MS = 10_000;

/** Minimal HTTP seam, so every test runs against a stub and never the network. */
export type GoogleFetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// ---------------------------------------------------------------------------
// Normalization: the boundary
// ---------------------------------------------------------------------------

/**
 * The Google payload stops HERE.
 *
 * Nothing above this function ever sees a Google response object. What comes
 * out is a `DiscoveredBusiness` -- our own shape, the same one OpenStreetMap
 * produces -- so no downstream code can grow a dependency on Google's field
 * names, and no raw payload can be persisted by accident because none is ever
 * returned.
 */
function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function readDisplayName(value: unknown): string | null {
  // { text, languageCode } in the New API; a bare string in nothing we support.
  if (typeof value !== "object" || value === null) return null;
  return readString((value as { text?: unknown }).text, 200);
}

/** Finite numbers inside a plausible range, or null. Never coerced. */
function readNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

/**
 * A website URL we are willing to record.
 *
 * http(s) only and bounded. Anything else is treated as no website listed --
 * which is NOT the same as the business having none, and is never reported as
 * such anywhere downstream.
 */
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

/**
 * Google's own category label, falling back to the machine type.
 *
 * The search term is deliberately NOT used: labelling a result by what we
 * asked for would make the category depend on which overlapping search found
 * it, the same failure the OSM subtype rules exist to prevent.
 */
function readCategory(record: Record<string, unknown>, fallback: string): string {
  const display = readDisplayName(record.primaryTypeDisplayName);
  if (display !== null) return display;

  const primary = readString(record.primaryType, 100);
  // "hair_care" -> "Hair care". Cosmetic only; no meaning is inferred.
  if (primary !== null) {
    const words = primary.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return fallback;
}

export function normalizeGooglePlace(
  value: unknown,
  context: { cityLabel: string; categoryLabel: string; fetchedAt: string },
): DiscoveredBusiness | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  // Without an id and a name there is nothing to identify or display, so the
  // record is dropped rather than filled in with a guess.
  const externalId = readString(record.id, 300);
  const name = readDisplayName(record.displayName);
  if (externalId === null || name === null) return null;

  return {
    externalId,
    source: "google",
    name,
    category: readCategory(record, context.categoryLabel),
    // Google's formattedAddress is one line including the city; the city label
    // comes from our own registry so it matches what OSM records store.
    city: context.cityLabel,
    address: readString(record.formattedAddress, 300),
    phone: readString(record.nationalPhoneNumber, 50),
    website: readWebsite(record.websiteUri),
    rating: readNumber(record.rating, 0, 5),
    reviewCount: readNumber(record.userRatingCount, 0, Number.MAX_SAFE_INTEGER),
    // Not requested in the field mask, so genuinely unknown rather than empty.
    openingHours: null,
    fetchedAt: context.fetchedAt,
  };
}

/** Structural check before any upstream data is trusted. */
function extractPlaces(payload: unknown): unknown[] {
  if (typeof payload !== "object" || payload === null) {
    throw new DiscoverySourceError(
      "Google Places returned an unexpected response.",
      "invalid-response",
    );
  }
  const places = (payload as { places?: unknown }).places;
  // An empty result omits `places` entirely, which is a successful empty
  // search and not a malformed response.
  if (places === undefined) return [];
  if (!Array.isArray(places)) {
    throw new DiscoverySourceError(
      "Google Places returned an unexpected response.",
      "invalid-response",
    );
  }
  return places;
}

export interface GoogleSourceOptions {
  fetchImpl?: GoogleFetchLike;
  /** Injected so a test never reads the environment or needs a key. */
  apiKey?: () => string;
  now?: () => Date;
}

export function createGooglePlacesSource(
  options: GoogleSourceOptions = {},
): DiscoverySource {
  const now = options.now ?? (() => new Date());
  const readKey = options.apiKey ?? googlePlacesApiKey;

  return {
    name: "google",
    // Google content is not persisted in this phase. See the data boundary note
    // in the orchestrator: candidates found only here stay candidates.
    persistable: false,

    async search(request: DiscoveryRequest): Promise<DiscoverySourceResult> {
      let apiKey: string;
      try {
        apiKey = readKey();
      } catch (error) {
        // A missing key is a configuration fact, not an outage. Reported as
        // this source failing so the run continues on whatever else is on.
        throw new DiscoverySourceError(
          "Google Places is selected but not configured.",
          "not-configured",
          { cause: error },
        );
      }

      // Built from the REGISTRY labels, never from the user's raw text.
      const textQuery = `${request.category.label} in ${request.city.label}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Awaited<ReturnType<GoogleFetchLike>>;
      try {
        response = await (options.fetchImpl ?? (globalThis.fetch as unknown as GoogleFetchLike))(
          ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // The key travels in a header to Google and nowhere else.
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": FIELD_MASK,
            },
            body: JSON.stringify({
              textQuery,
              maxResultCount: GOOGLE_RESULT_LIMIT,
              languageCode: "en",
            }),
            signal: controller.signal,
          },
        );
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new DiscoverySourceError(
          aborted
            ? "Google Places did not respond in time."
            : "Google Places could not be reached.",
          "unavailable",
          { cause: error },
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Status is not included in the client-safe message: a Google error
        // body carries quota figures and can echo the key back. There is
        // deliberately NO retry -- 429 means back off, not try again, and a
        // retry loop on a billable endpoint is a bill, not a fix.
        throw new DiscoverySourceError(
          "Google Places rejected the request or is unavailable.",
          "unavailable",
          { cause: new Error(`Google Places HTTP ${response.status}`) },
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new DiscoverySourceError(
          "Google Places returned an unexpected response.",
          "invalid-response",
          { cause: error },
        );
      }

      const places = extractPlaces(payload);
      const fetchedAt = now().toISOString();

      const businesses = places
        .slice(0, GOOGLE_RESULT_LIMIT)
        .map((place) =>
          normalizeGooglePlace(place, {
            cityLabel: request.city.label,
            categoryLabel: request.category.label,
            fetchedAt,
          }),
        )
        .filter((business): business is DiscoveredBusiness => business !== null);

      return {
        businesses,
        meta: {
          // Judged on the RAW count, before unusable records are dropped: the
          // page was full, so more may exist upstream even if some of these
          // could not be read.
          truncated: places.length >= GOOGLE_RESULT_LIMIT,
          limit: GOOGLE_RESULT_LIMIT,
        },
      };
    },
  };
}

export const googlePlacesSource: DiscoverySource = createGooglePlacesSource();
