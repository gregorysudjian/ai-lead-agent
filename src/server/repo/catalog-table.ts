import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { CatalogTableGateway, GoogleCheckColumns } from "./catalog-gateway";
import type { BusinessRow, IngestRunRow } from "./catalog-mapping";
import { CatalogRepositoryError } from "./catalog-types";

const BUSINESSES = "businesses";
const RUNS = "ingest_runs";

/**
 * Rows per read. PostgREST caps a single response at its configured maximum
 * (1000 by default on Supabase), silently: a larger table simply comes back
 * short. So every "all rows" read here pages explicitly until a short page
 * says there is nothing left -- the lead gateway's unpaged list is exactly the
 * bug this avoids.
 */
const READ_PAGE = 1000;

/** Rows per write. Keeps each request well inside PostgREST's body limit. */
const WRITE_CHUNK = 500;

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours, naming a missing migration outright.
 *
 * The code goes into our message, which only ever reaches server logs; the
 * driver's body travels as `cause` because it can carry quota detail.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  const code = error.code ? ` [${error.code}]` : "";
  const hint =
    error.code === "PGRST205"
      ? " A catalog table is missing -- apply supabase/migrations/20260911000000_create_businesses.sql" +
        " and 20260911000100_create_ingest_runs.sql."
      : "";
  return new CatalogRepositoryError(`Supabase query failed (${context})${code}.${hint}`, {
    cause: error,
  });
}

/** The only module that speaks Supabase for the catalog. */
export class SupabaseCatalogTableGateway implements CatalogTableGateway {
  async listRows(): Promise<BusinessRow[]> {
    const rows: BusinessRow[] = [];
    for (let from = 0; ; from += READ_PAGE) {
      const { data, error } = await getSupabaseClient()
        .from(BUSINESSES)
        .select("*")
        // A stable order is what makes offset paging safe: without it two
        // pages can overlap or skip rows.
        .order("id", { ascending: true })
        .range(from, from + READ_PAGE - 1);

      if (error) throw toRepositoryError(error, "listBusinesses");
      const page = (data ?? []) as BusinessRow[];
      rows.push(...page);
      if (page.length < READ_PAGE) return rows;
    }
  }

  async findRowById(id: string): Promise<BusinessRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(BUSINESSES)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findBusiness");
    return (data as BusinessRow | null) ?? null;
  }

  async upsertRows(rows: readonly BusinessRow[]): Promise<void> {
    for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
      const chunk = rows.slice(i, i + WRITE_CHUNK);
      const { error } = await getSupabaseClient()
        .from(BUSINESSES)
        .upsert(chunk as BusinessRow[], { onConflict: "id" });
      if (error) throw toRepositoryError(error, `upsertBusinesses ${i}-${i + chunk.length}`);
    }
  }

  async setLeadIfUnlinked(id: string, leadId: string): Promise<void> {
    // `is("lead_id", null)` makes "set once" a property of the query: two
    // concurrent adds cannot both win, and neither can repoint the other.
    const { error } = await getSupabaseClient()
      .from(BUSINESSES)
      .update({ lead_id: leadId })
      .eq("id", id)
      .is("lead_id", null);

    if (error) throw toRepositoryError(error, "linkLead");
  }

  async clearLead(leadId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from(BUSINESSES)
      .update({ lead_id: null })
      .eq("lead_id", leadId);

    if (error) throw toRepositoryError(error, "unlinkLead");
  }

  async setGoogleCheck(id: string, patch: GoogleCheckColumns): Promise<void> {
    const { error } = await getSupabaseClient().from(BUSINESSES).update(patch).eq("id", id);
    if (error) throw toRepositoryError(error, "recordGoogleCheck");
  }

  async insertRun(row: IngestRunRow): Promise<void> {
    const { error } = await getSupabaseClient().from(RUNS).insert(row);
    if (error) throw toRepositoryError(error, "openRun");
  }

  async updateRun(id: string, patch: Partial<IngestRunRow>): Promise<void> {
    const { error } = await getSupabaseClient().from(RUNS).update(patch).eq("id", id);
    if (error) throw toRepositoryError(error, "updateRun");
  }

  async listRuns(limit: number): Promise<IngestRunRow[]> {
    const { data, error } = await getSupabaseClient()
      .from(RUNS)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) throw toRepositoryError(error, "recentRuns");
    return (data ?? []) as IngestRunRow[];
  }
}
