import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { BusinessProfileTableGateway } from "./profile-gateway";
import type { BusinessProfileRow } from "./profile-mapping";
import { BusinessProfileRepositoryError } from "./profile-types";

const TABLE = "business_profiles";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours. The upstream message goes to `cause` for
 * server logs only -- route handlers substitute a generic client message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  return new BusinessProfileRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/** The only module that speaks Supabase for business profiles. */
export class SupabaseBusinessProfileTableGateway implements BusinessProfileTableGateway {
  async insertRow(row: BusinessProfileRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async findRowById(id: string): Promise<BusinessProfileRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as BusinessProfileRow | null) ?? null;
  }

  async listRowsForLead(leadId: string): Promise<BusinessProfileRow[]> {
    // Newest first, matching business_profiles_lead_id_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForLead");
    return (data ?? []) as BusinessProfileRow[];
  }

  async listRecentRows(limit: number): Promise<BusinessProfileRow[]> {
    // Newest first, matching business_profiles_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw toRepositoryError(error, "listRecent");
    return (data ?? []) as BusinessProfileRow[];
  }
}

/**
 * In-memory gateway.
 *
 * Used by tests and by the local JSON configuration. Explicitly NOT durable --
 * a restart loses everything.
 */
export class InMemoryBusinessProfileTableGateway implements BusinessProfileTableGateway {
  private rows: BusinessProfileRow[] = [];

  async insertRow(row: BusinessProfileRow): Promise<void> {
    if (this.rows.some((r) => r.id === row.id)) {
      throw new BusinessProfileRepositoryError("Duplicate business profile id.");
    }
    this.rows.push({ ...row });
  }

  async findRowById(id: string): Promise<BusinessProfileRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  private newestFirst(rows: BusinessProfileRow[]): BusinessProfileRow[] {
    return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listRowsForLead(leadId: string): Promise<BusinessProfileRow[]> {
    return this.newestFirst(this.rows.filter((r) => r.lead_id === leadId));
  }

  async listRecentRows(limit: number): Promise<BusinessProfileRow[]> {
    return this.newestFirst(this.rows).slice(0, limit);
  }
}
