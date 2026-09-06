import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { DemoSiteTableGateway } from "./demo-gateway";
import type { DemoSiteRow } from "./demo-mapping";
import { DemoSiteRepositoryError } from "./demo-types";

const TABLE = "demo_sites";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours. The upstream message goes to `cause` for
 * server logs only -- route handlers substitute a generic client message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  return new DemoSiteRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/** The only module that speaks Supabase for demo sites. */
export class SupabaseDemoSiteTableGateway implements DemoSiteTableGateway {
  async insertRow(row: DemoSiteRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async findRowById(id: string): Promise<DemoSiteRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as DemoSiteRow | null) ?? null;
  }

  async listRowsForLead(leadId: string): Promise<DemoSiteRow[]> {
    // Newest first, matching demo_sites_lead_id_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForLead");
    return (data ?? []) as DemoSiteRow[];
  }

  async listRowsForAnalysis(analysisId: string): Promise<DemoSiteRow[]> {
    // Newest first, matching demo_sites_analysis_id_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForAnalysis");
    return (data ?? []) as DemoSiteRow[];
  }

  async listRecentRows(limit: number): Promise<DemoSiteRow[]> {
    // Newest first, matching demo_sites_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw toRepositoryError(error, "listRecent");
    return (data ?? []) as DemoSiteRow[];
  }
}

/**
 * In-memory gateway.
 *
 * Used by tests and by the local JSON configuration, where a real demo store
 * would be out of scope. Explicitly NOT durable -- a restart loses everything.
 */
export class InMemoryDemoSiteTableGateway implements DemoSiteTableGateway {
  private rows: DemoSiteRow[] = [];

  async insertRow(row: DemoSiteRow): Promise<void> {
    if (this.rows.some((r) => r.id === row.id)) {
      throw new DemoSiteRepositoryError("Duplicate demo site id.");
    }
    this.rows.push({ ...row });
  }

  async findRowById(id: string): Promise<DemoSiteRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  private newestFirst(rows: DemoSiteRow[]): DemoSiteRow[] {
    return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listRowsForLead(leadId: string): Promise<DemoSiteRow[]> {
    return this.newestFirst(this.rows.filter((r) => r.lead_id === leadId));
  }

  async listRowsForAnalysis(analysisId: string): Promise<DemoSiteRow[]> {
    return this.newestFirst(this.rows.filter((r) => r.analysis_id === analysisId));
  }

  async listRecentRows(limit: number): Promise<DemoSiteRow[]> {
    return this.newestFirst(this.rows).slice(0, limit);
  }
}
