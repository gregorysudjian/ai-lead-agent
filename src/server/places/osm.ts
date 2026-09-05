import "server-only";

import { resolveSupportedCategory, supportedCategoryLabels } from "@/lib/osm/categories";
import { resolveSupportedCity, supportedCityLabels } from "@/lib/osm/cities";
import { normalizeOsmElements } from "@/lib/osm/normalize";
import {
  buildOverpassQuery,
  DEFAULT_QUERY_TIMEOUT_SECONDS,
  DEFAULT_RESULT_LIMIT,
} from "@/lib/osm/query";
import type { BusinessSearchQuery, DiscoveredBusiness } from "@/lib/types";
import { overpassApiUrl } from "@/server/env";

import type { PlacesProvider } from "./types";
import { ProviderUnavailableError, ProviderValidationError } from "./types";

/**
 * Business discovery backed by OpenStreetMap data via the Overpass API.
 *
 * RESPECTFUL USE. The public Overpass instance is volunteer-run community
 * infrastructure, not production capacity we are entitled to. This provider
 * therefore:
 *   - issues a request ONLY in response to an explicit user search
 *   - never crawls, pre-fetches, polls or refreshes in the background
 *   - queries one bounded administrative area for one category at a time
 *   - caps the elements it will accept
 *   - caches identical searches briefly in memory
 *   - collapses concurrent identical searches into one upstream request
 *   - does NOT retry; a failure is reported, not hammered
 * Endpoint is configurable via OVERPASS_API_URL so the shared instance can be
 * replaced by a self-hosted one.
 *
 * Data is © OpenStreetMap contributors, ODbL 1.0. Provenance is preserved by
 * stamping every record with source "osm"; attribution is rendered in the UI.
 */

/** Client timeout, slightly above the server-side budget we ask Overpass for. */
const REQUEST_TIMEOUT_MS = (DEFAULT_QUERY_TIMEOUT_SECONDS + 5) * 1000;

/** Identifies this application, as the OSM/Overpass usage policies require. */
const USER_AGENT =
  "business-lead-finder/0.1 (development prototype; OpenStreetMap via Overpass)";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

interface CacheEntry {
  expiresAt: number;
  businesses: DiscoveredBusiness[];
}

/** Process-memory only. Never persisted, never written into a Lead. */
const cache = new Map<string, CacheEntry>();
/** Collapses identical concurrent searches into a single upstream request. */
const inFlight = new Map<string, Promise<DiscoveredBusiness[]>>();

function readCache(key: string): DiscoveredBusiness[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.businesses;
}

function writeCache(key: string, businesses: DiscoveredBusiness[]): void {
  // Bounded: drop the oldest entry rather than growing without limit.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, businesses });
}

/**
 * Minimal HTTP seam.
 *
 * Injectable so tests can exercise POST shape, timeout and error mapping
 * against a stub without touching the network or installing a mock framework.
 */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

/** Structural check before any upstream data is trusted. */
function extractElements(payload: unknown): unknown[] {
  if (typeof payload !== "object" || payload === null) {
    throw new ProviderUnavailableError("Overpass response was not an object.");
  }
  const elements = (payload as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) {
    throw new ProviderUnavailableError("Overpass response had no elements array.");
  }
  return elements;
}

async function runOverpassQuery(
  query: string,
  fetchImpl: FetchLike,
  endpoint: string,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    // POST, not GET: the query goes in the body rather than a long URL.
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });
  } catch (error) {
    // Includes the AbortError raised by our own timeout.
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ProviderUnavailableError(
      aborted ? "Overpass request timed out." : "Overpass request failed.",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Status only. Overpass error bodies are HTML and are never surfaced.
    // Deliberately no retry: 429 in particular means back off, not try again.
    throw new ProviderUnavailableError(
      `Overpass returned HTTP ${response.status}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ProviderUnavailableError("Overpass returned invalid JSON.", { cause: error });
  }

  return extractElements(payload);
}

export interface OsmProviderOptions {
  fetchImpl?: FetchLike;
  endpoint?: string;
  /** Injected clock keeps `fetchedAt` deterministic under test. */
  now?: () => Date;
  useCache?: boolean;
}

export function createOpenStreetMapProvider(
  options: OsmProviderOptions = {},
): PlacesProvider {
  const now = options.now ?? (() => new Date());
  const useCache = options.useCache ?? true;

  return {
    name: "osm",

    async search(query: BusinessSearchQuery): Promise<DiscoveredBusiness[]> {
      // Resolve against the curated registries BEFORE any network activity, so
      // unsupported input never reaches shared infrastructure and free text
      // never becomes Overpass QL.
      const city = resolveSupportedCity(query.city);
      if (!city) {
        throw new ProviderValidationError(
          `Real-data search does not support that city yet. Supported: ${supportedCityLabels().join(", ")}.`,
          { cities: supportedCityLabels() },
        );
      }

      const category = resolveSupportedCategory(query.category);
      if (!category) {
        throw new ProviderValidationError(
          `Real-data search does not support that category yet. Supported: ${supportedCategoryLabels().join(", ")}.`,
          { categories: supportedCategoryLabels() },
        );
      }

      const cacheKey = `${city.key}|${category.key}`;
      if (useCache) {
        const cached = readCache(cacheKey);
        if (cached) return cached;

        const pending = inFlight.get(cacheKey);
        if (pending) return pending;
      }

      const run = (async () => {
        const overpassQuery = buildOverpassQuery(city, category, {
          timeoutSeconds: DEFAULT_QUERY_TIMEOUT_SECONDS,
          limit: DEFAULT_RESULT_LIMIT,
        });

        const elements = await runOverpassQuery(
          overpassQuery,
          options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike),
          options.endpoint ?? overpassApiUrl(),
        );

        const businesses = normalizeOsmElements(elements, {
          categoryLabel: category.label,
          cityLabel: city.label,
          fetchedAt: now().toISOString(),
        }).slice(0, DEFAULT_RESULT_LIMIT);

        if (useCache) writeCache(cacheKey, businesses);
        return businesses;
      })();

      if (useCache) inFlight.set(cacheKey, run);
      try {
        return await run;
      } finally {
        inFlight.delete(cacheKey);
      }
    },
  };
}

export const openStreetMapPlacesProvider: PlacesProvider = createOpenStreetMapProvider();
