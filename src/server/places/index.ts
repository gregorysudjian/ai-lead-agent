import "server-only";

import { placesProviderName } from "@/server/env";
import { mockPlacesProvider } from "./mock";
import { openStreetMapPlacesProvider } from "./osm";
import type { PlacesProvider } from "./types";

/**
 * Resolve the configured discovery provider.
 *
 * The single place that knows which implementation exists. Callers receive a
 * PlacesProvider and cannot tell -- or care -- which one they got.
 */
export function getPlacesProvider(): PlacesProvider {
  const name = placesProviderName();

  switch (name) {
    case "mock":
      return mockPlacesProvider;
    case "osm":
      return openStreetMapPlacesProvider;
    case "google":
      // Phase 5. Deliberately unimplemented: this throws rather than quietly
      // falling back to mock data, which would look like a working integration.
      throw new Error(
        "GooglePlacesProvider is not implemented yet. Unset PLACES_PROVIDER to use the mock provider.",
      );
  }
}

export type { PlacesProvider } from "./types";
export { ProviderUnavailableError, ProviderValidationError } from "./types";
