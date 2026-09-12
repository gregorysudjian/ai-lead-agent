import "server-only";

import type { GoogleCandidate } from "@/lib/catalog/google-match";
import type { Coordinates } from "@/lib/catalog/types";

/**
 * One Google Places text search, for the Google Maps check.
 *
 * Asks for the business by name and address near where we have it, and
 * returns the places Google offers as candidates for `judgeGoogleMatch`.
 * Nothing is stored here: the caller keeps only the matched place id.
 *
 * ── COST ──────────────────────────────────────────────────────────────────
 *
 * The field mask decides the price. Name, position, status and address are
 * the smallest set that can tell our business from the one next door, and all
 * sit in Google's "Text Search Pro" tier. Nothing from the Enterprise tier
 * (phone, rating, hours, website) is requested: none of it changes the answer.
 * Every call is counted BEFORE it is made (see `usage.ts`).
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** The billed tier this mask falls in. Keep the two in step. */
export const LOOKUP_SKU = "text_search_pro" as const;
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.businessStatus",
  "places.formattedAddress",
].join(",");

/** Candidates to consider. The page size does not change the price. */
const PAGE_SIZE = 5;
const TIMEOUT_MS = 15_000;

/** Search around our own position; the island's centre when we have none. */
const BIAS_RADIUS_METRES = 1_000;
const ISLAND_CENTRE: Coordinates = { latitude: 45.5089, longitude: -73.6618 };
const ISLAND_RADIUS_METRES = 25_000;

export interface LookupInput {
  name: string;
  address: string | null;
  city: string;
  location: Coordinates | null;
}

export type LookupResult =
  | { ok: true; candidates: GoogleCandidate[] }
  /** `retryable` for a rate limit or a server error, never for a refusal. */
  | { ok: false; status: number | null; retryable: boolean; message: string };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function lookUpOnGoogle(
  apiKey: string,
  input: LookupInput,
  fetchImpl: FetchLike = fetch,
): Promise<LookupResult> {
  const textQuery = [input.name, input.address, input.city]
    .filter((part): part is string => part !== null && part.trim().length > 0)
    .join(", ");

  const circle = input.location
    ? { center: input.location, radius: BIAS_RADIUS_METRES }
    : { center: ISLAND_CENTRE, radius: ISLAND_RADIUS_METRES };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: PAGE_SIZE,
        languageCode: "fr",
        regionCode: "CA",
        locationBias: { circle },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    return { ok: false, status: null, retryable: true, message: `request failed: ${String(error).slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Google's error body can name the project and quota; only its status
    // word is kept.
    const body = (await response.json().catch(() => null)) as { error?: { status?: string } } | null;
    return {
      ok: false,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      message: `HTTP ${response.status} ${body?.error?.status ?? ""}`.trim(),
    };
  }

  const payload = (await response.json().catch(() => null)) as { places?: unknown } | null;
  const places = Array.isArray(payload?.places) ? payload.places : [];
  return { ok: true, candidates: places.flatMap(toCandidate) };
}

/** One Google place -> a candidate, or nothing when it lacks an id or a name. */
function toCandidate(value: unknown): GoogleCandidate[] {
  if (typeof value !== "object" || value === null) return [];
  const place = value as {
    id?: unknown;
    displayName?: { text?: unknown };
    location?: { latitude?: unknown; longitude?: unknown };
    businessStatus?: unknown;
    formattedAddress?: unknown;
  };
  if (typeof place.id !== "string" || typeof place.displayName?.text !== "string") return [];
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;
  return [
    {
      placeId: place.id,
      name: place.displayName.text,
      location: typeof lat === "number" && typeof lon === "number" ? { latitude: lat, longitude: lon } : null,
      businessStatus: typeof place.businessStatus === "string" ? place.businessStatus : null,
      formattedAddress: typeof place.formattedAddress === "string" ? place.formattedAddress : null,
    },
  ];
}
