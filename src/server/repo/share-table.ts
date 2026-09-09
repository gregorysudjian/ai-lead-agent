import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { DemoShareTableGateway } from "./share-gateway";
import type { DemoShareRow } from "./share-mapping";
import { DemoShareRepositoryError } from "./share-types";

const TABLE = "demo_shares";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours. The upstream message goes to `cause` for
 * server logs only -- route handlers substitute a generic client message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  return new DemoShareRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/** The only module that speaks Supabase for demo shares. */
export class SupabaseDemoShareTableGateway implements DemoShareTableGateway {
  async insertRow(row: DemoShareRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async findRowByToken(token: string): Promise<DemoShareRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findByToken");
    return (data as DemoShareRow | null) ?? null;
  }

  async findRowById(id: string): Promise<DemoShareRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as DemoShareRow | null) ?? null;
  }

  async listRowsForDemo(demoId: string): Promise<DemoShareRow[]> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("demo_id", demoId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForDemo");
    return (data as DemoShareRow[] | null) ?? [];
  }

  async markRevoked(id: string, revokedAt: string): Promise<void> {
    // One column, and only when it is still null. `is("revoked_at", null)`
    // makes "already revoked keeps its original timestamp" a property of the
    // query rather than of a read-then-write the database cannot see, so two
    // concurrent revokes cannot move the moment the link stopped working.
    const { error } = await getSupabaseClient()
      .from(TABLE)
      .update({ revoked_at: revokedAt })
      .eq("id", id)
      .is("revoked_at", null);

    if (error) throw toRepositoryError(error, "revoke");
  }
}
