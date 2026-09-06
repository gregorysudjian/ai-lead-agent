import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import {
  UniqueViolationError,
  type LeadStatusPatch,
  type LeadTableGateway,
} from "./supabase-gateway";
import type { DedupeColumns, LeadRefreshPatch, LeadRow } from "./supabase-mapping";
import { LeadRepositoryError } from "./types";

const TABLE = "leads";

/** Postgres SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = "23505";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours.
 *
 * Only the SQLSTATE code is used to classify. The message is passed to the
 * cause for server logs, never surfaced to a client -- route handlers already
 * substitute a generic message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  if (error.code === UNIQUE_VIOLATION) {
    return new UniqueViolationError(`Unique index rejected the write (${context}).`, {
      cause: error,
    });
  }
  return new LeadRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/**
 * The real gateway: the only place that speaks Supabase.
 *
 * Server-only, because it reaches the client that holds the secret key.
 */
export class SupabaseLeadTableGateway implements LeadTableGateway {
  async listRows(): Promise<LeadRow[]> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "list");
    return (data ?? []) as LeadRow[];
  }

  async findRowById(id: string): Promise<LeadRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as LeadRow | null) ?? null;
  }

  async findMatchingRow(dedupe: DedupeColumns): Promise<LeadRow | null> {
    const client = getSupabaseClient();

    // PRIMARY: same provider, same external id.
    const primary = await client
      .from(TABLE)
      .select("*")
      .eq("provider_source", dedupe.provider_source)
      .eq("provider_external_id", dedupe.provider_external_id)
      .maybeSingle();

    if (primary.error) throw toRepositoryError(primary.error, "findMatching/primary");
    if (primary.data) return primary.data as LeadRow;

    // SECONDARY: exact normalized name + address. Skipped entirely when the
    // address is null -- a missing address must never match anything.
    if (dedupe.normalized_address === null) return null;

    const secondary = await client
      .from(TABLE)
      .select("*")
      .eq("normalized_name", dedupe.normalized_name)
      .eq("normalized_address", dedupe.normalized_address)
      .maybeSingle();

    if (secondary.error) throw toRepositoryError(secondary.error, "findMatching/secondary");
    return (secondary.data as LeadRow | null) ?? null;
  }

  async insertRow(row: LeadRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async updateRow(
    id: string,
    patch: LeadRefreshPatch | LeadStatusPatch,
  ): Promise<LeadRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw toRepositoryError(error, "update");
    return (data as LeadRow | null) ?? null;
  }
}
