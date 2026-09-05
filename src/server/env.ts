import "server-only";

/**
 * Single, validated entry point for environment configuration.
 *
 * Guarded with server-only so a Client Component importing it fails at build
 * time rather than shipping configuration logic (and one day secrets) to the
 * browser.
 */

export type PlacesProviderName = "mock" | "google";

const VALID_PLACES_PROVIDERS: readonly PlacesProviderName[] = ["mock", "google"];

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
