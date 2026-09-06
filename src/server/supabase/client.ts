import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/server/env";

/**
 * Server-side Supabase client.
 *
 * Guarded with `server-only`: importing this from a Client Component is a build
 * error, which is what keeps the secret key out of the browser bundle. The key
 * is read from SUPABASE_SECRET_KEY, is never prefixed with NEXT_PUBLIC_, and is
 * never logged or placed in an error message.
 *
 * The secret key bypasses Row Level Security, so every query here runs with
 * full table access. That is precisely why the migration enables RLS with no
 * policies: the browser has no path to the table at all, and this module is the
 * single controlled door.
 */

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const { url, secretKey } = supabaseConfig();

  cached = createClient(url, secretKey, {
    auth: {
      // A server process has no user session to persist or refresh, and no
      // browser storage to put one in.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}

/** Test seam: drops the memoized client so configuration changes take effect. */
export function resetSupabaseClient(): void {
  cached = null;
}
