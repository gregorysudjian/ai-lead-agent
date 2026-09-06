import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { AnalysisTableGateway } from "./analysis-gateway";
import type { AnalysisRow } from "./analysis-mapping";
import { AnalysisRepositoryError } from "./analysis-types";

const TABLE = "lead_analyses";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours. The upstream message goes to `cause` for
 * server logs only -- route handlers substitute a generic client message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  return new AnalysisRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/** The only module that speaks Supabase for analyses. */
export class SupabaseAnalysisTableGateway implements AnalysisTableGateway {
  async insertRow(row: AnalysisRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async findRowById(id: string): Promise<AnalysisRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as AnalysisRow | null) ?? null;
  }

  async listRowsForLead(leadId: string): Promise<AnalysisRow[]> {
    // Newest first, matching lead_analyses_lead_id_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForLead");
    return (data ?? []) as AnalysisRow[];
  }
}

/**
 * In-memory gateway.
 *
 * Used by tests and by the local JSON configuration, where a real analysis
 * store would be out of scope. It is explicitly NOT durable -- a restart loses
 * everything -- which is acceptable for the non-Supabase development path.
 */
export class InMemoryAnalysisTableGateway implements AnalysisTableGateway {
  private rows: AnalysisRow[] = [];

  async insertRow(row: AnalysisRow): Promise<void> {
    if (this.rows.some((r) => r.id === row.id)) {
      throw new AnalysisRepositoryError("Duplicate analysis id.");
    }
    this.rows.push({ ...row });
  }

  async findRowById(id: string): Promise<AnalysisRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async listRowsForLead(leadId: string): Promise<AnalysisRow[]> {
    return this.rows
      .filter((r) => r.lead_id === leadId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}
