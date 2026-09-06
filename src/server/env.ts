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
 */
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
