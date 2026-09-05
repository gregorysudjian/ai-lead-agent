import "server-only";

/**
 * Single, validated entry point for environment configuration.
 *
 * Guarded with server-only so a Client Component importing it fails at build
 * time rather than shipping configuration logic (and one day secrets) to the
 * browser.
 */

export type PlacesProviderName = "mock" | "osm" | "google";

const VALID_PLACES_PROVIDERS: readonly PlacesProviderName[] = ["mock", "osm", "google"];

/**
 * Which discovery provider to use. Defaults to "mock".
 *
 * Defaulting to the mock is a safety property, not a convenience: a missing or
 * empty variable can never cause an accidental call to a paid API. Enabling a
 * real provider has to be a deliberate act.
 *
 * An unrecognised value throws rather than silently falling back, so a typo
 * like PLACES_PROVIDER=googel is loud instead of invisible.
 */
export function placesProviderName(): PlacesProviderName {
  const raw = process.env.PLACES_PROVIDER?.trim().toLowerCase();
  if (!raw) return "mock";

  const match = VALID_PLACES_PROVIDERS.find((name) => name === raw);
  if (!match) {
    throw new Error(
      `Invalid PLACES_PROVIDER: expected one of ${VALID_PLACES_PROVIDERS.join(", ")}.`,
    );
  }
  return match;
}

/**
 * Overpass endpoint for the OpenStreetMap provider.
 *
 * Configurable so the public community instance is never a hardcoded
 * dependency: it is shared infrastructure, not production capacity, and a
 * self-hosted or paid instance can be substituted without a code change.
 */
export const DEFAULT_OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

export function overpassApiUrl(): string {
  const raw = process.env.OVERPASS_API_URL?.trim();
  if (!raw) return DEFAULT_OVERPASS_API_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid OVERPASS_API_URL: must be an absolute http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid OVERPASS_API_URL: must use http or https.");
  }
  return parsed.href;
}
