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

// ---------------------------------------------------------------------------
// Multi-source discovery
// ---------------------------------------------------------------------------

/** Sources a discovery run may use. Anything else is a configuration error. */
const VALID_DISCOVERY_SOURCES = ["mock", "osm", "google"] as const;
export type DiscoverySourceConfigName = (typeof VALID_DISCOVERY_SOURCES)[number];

/**
 * Which sources a discovery run may ask, in the order given.
 *
 * `DISCOVERY_SOURCES=osm,google` -- a comma-separated list, not a single value,
 * because discovery is now a set of sources rather than a choice between them.
 *
 * COMPATIBILITY. When unset it falls back to `PLACES_PROVIDER`, which is the
 * variable this deployment already sets and which still governs the
 * search-and-save path. So an existing configuration keeps working unchanged and
 * means exactly what it meant before -- `PLACES_PROVIDER=osm` gives a run that
 * asks OpenStreetMap and nothing else. Nothing is silently added: turning Google
 * on requires naming it.
 *
 * That also preserves the safety property both variables were built around. The
 * fallback ends at `placesProviderName()`, which defaults to "mock", so a
 * missing value can never cause a call to a paid API.
 *
 * A typo throws rather than being skipped: `DISCOVERY_SOURCES=osm,googel` must
 * be loud, not a silently OSM-only run that looks like Google returned nothing.
 */
export function discoverySourceNames(): DiscoverySourceConfigName[] {
  const raw = process.env.DISCOVERY_SOURCES?.trim();
  if (!raw) return [placesProviderName()];

  const requested = raw
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);

  if (requested.length === 0) {
    throw new Error(
      `Invalid DISCOVERY_SOURCES: expected a comma-separated list of ${VALID_DISCOVERY_SOURCES.join(", ")}.`,
    );
  }

  const names: DiscoverySourceConfigName[] = [];
  for (const name of requested) {
    const match = VALID_DISCOVERY_SOURCES.find((valid) => valid === name);
    if (!match) {
      throw new Error(
        `Invalid DISCOVERY_SOURCES: expected a comma-separated list of ${VALID_DISCOVERY_SOURCES.join(", ")}.`,
      );
    }
    // Duplicates collapse: asking one source twice is a typo, not two searches.
    if (!names.includes(match)) names.push(match);
  }
  return names;
}

/**
 * The Google Places API key.
 *
 * Returned for immediate use by the server-side adapter and nothing else. The
 * key is never logged, echoed, or included in an error: the message below names
 * the VARIABLE, never any value. It must never be prefixed `NEXT_PUBLIC_`,
 * which would publish it in the browser bundle.
 */
export function googlePlacesApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Google Places is a selected discovery source but GOOGLE_PLACES_API_KEY is not set. " +
        "Remove google from DISCOVERY_SOURCES to run without it.",
    );
  }
  return key;
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

// ---------------------------------------------------------------------------
// Lead storage
// ---------------------------------------------------------------------------

export type LeadRepositoryName = "json" | "supabase";

const VALID_LEAD_REPOSITORIES: readonly LeadRepositoryName[] = ["json", "supabase"];

/**
 * Which lead store to use. Defaults to "json".
 *
 * Defaulting to the local JSON store is a safety property, not a convenience: a
 * missing or empty variable can never cause an accidental connection to a real
 * database. Enabling Supabase has to be a deliberate act.
 *
 * An unrecognised value throws rather than silently falling back.
 */
export function leadRepositoryName(): LeadRepositoryName {
  const raw = process.env.LEAD_REPOSITORY?.trim().toLowerCase();
  if (!raw) return "json";

  const match = VALID_LEAD_REPOSITORIES.find((name) => name === raw);
  if (!match) {
    throw new Error(
      `Invalid LEAD_REPOSITORY: expected one of ${VALID_LEAD_REPOSITORIES.join(", ")}.`,
    );
  }
  return match;
}

/**
 * Supabase connection settings.
 *
 * Returns the values for immediate use by the server-side client and nothing
 * else. The secret key is never logged, echoed, or included in an error: the
 * messages below name the missing VARIABLE, never any value, so a
 * misconfiguration is diagnosable without leaking anything.
 */
export interface SupabaseConfig {
  url: string;
  secretKey: string;
}

export function supabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!secretKey) missing.push("SUPABASE_SECRET_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Supabase is selected but ${missing.join(" and ")} ${
        missing.length === 1 ? "is" : "are"
      } not set. Set LEAD_REPOSITORY=json to use the local store instead.`,
    );
  }

  // Validate the URL shape without ever including it in a thrown message.
  try {
    const parsed = new URL(url!);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new Error("Invalid SUPABASE_URL: must be an absolute http(s) URL.");
  }

  return { url: url!, secretKey: secretKey! };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export type AnalysisProviderName = "mock" | "anthropic";

const VALID_ANALYSIS_PROVIDERS: readonly AnalysisProviderName[] = ["mock", "anthropic"];

/**
 * Which analyser to use. Defaults to "mock".
 *
 * Defaulting to the mock is a safety property: a missing or empty variable can
 * never cause an accidental paid API call. Enabling Claude is a deliberate act.
 *
 * An unrecognised value throws rather than silently falling back -- and there is
 * deliberately NO fallback from "anthropic" to "mock" on failure either. If the
 * app is configured for Claude and Claude fails, that is reported, not papered
 * over with fixture-quality output presented as a real analysis.
 *
 * (The definition follows the research block below; this comment documents
 * `analysisProviderName`.)
 */

/** The research modes. Anything else is a configuration error. */
const VALID_RESEARCH_PROVIDERS = ["mock", "website"] as const;
export type ResearchProviderName = (typeof VALID_RESEARCH_PROVIDERS)[number];

/**
 * Which researcher runs.
 *
 * Defaults to "mock", which makes no network request at all. Real website
 * research reaches out to a third party's server on behalf of a business that
 * never asked us to, so it has to be switched on deliberately -- a missing or
 * empty variable can never cause an outbound request.
 *
 * Needs no secret: website mode reads public pages and sends no credential.
 */
export function researchProviderName(): ResearchProviderName {
  const raw = process.env.RESEARCH_PROVIDER?.trim().toLowerCase();
  if (!raw) return "mock";

  const match = VALID_RESEARCH_PROVIDERS.find((name) => name === raw);
  if (!match) {
    throw new Error(
      `Invalid RESEARCH_PROVIDER: expected one of ${VALID_RESEARCH_PROVIDERS.join(", ")}.`,
    );
  }
  return match;
}

export function analysisProviderName(): AnalysisProviderName {
  const raw = process.env.ANALYSIS_PROVIDER?.trim().toLowerCase();
  if (!raw) return "mock";

  const match = VALID_ANALYSIS_PROVIDERS.find((name) => name === raw);
  if (!match) {
    throw new Error(
      `Invalid ANALYSIS_PROVIDER: expected one of ${VALID_ANALYSIS_PROVIDERS.join(", ")}.`,
    );
  }
  return match;
}

/**
 * The Anthropic API key.
 *
 * Returns the value for immediate use by the server-side client and nothing
 * else. The key is never logged, echoed, or included in an error: the message
 * below names the VARIABLE, never any value.
 */
export function anthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ANALYSIS_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. " +
        "Set ANALYSIS_PROVIDER=mock to use the offline analyser instead.",
    );
  }
  return key;
}
