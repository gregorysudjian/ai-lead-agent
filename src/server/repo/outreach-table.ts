import "server-only";

import { getSupabaseClient } from "@/server/supabase/client";

import type { OutreachTableGateway } from "./outreach-gateway";
import type { OutreachRow } from "./outreach-mapping";
import { OutreachRepositoryError } from "./outreach-types";

const TABLE = "outreach_records";

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

/**
 * Convert a driver error into ours. The upstream message goes to `cause` for
 * server logs only -- route handlers substitute a generic client message.
 */
function toRepositoryError(error: PostgrestErrorLike, context: string): Error {
  return new OutreachRepositoryError(`Supabase query failed (${context}).`, { cause: error });
}

/** The only module that speaks Supabase for outreach records. */
export class SupabaseOutreachTableGateway implements OutreachTableGateway {
  async insertRow(row: OutreachRow): Promise<void> {
    const { error } = await getSupabaseClient().from(TABLE).insert(row);
    if (error) throw toRepositoryError(error, "insert");
  }

  async findRowById(id: string): Promise<OutreachRow | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError(error, "findById");
    return (data as OutreachRow | null) ?? null;
  }

  async listRowsForLead(leadId: string): Promise<OutreachRow[]> {
    // Newest first, matching outreach_records_lead_id_created_at_idx.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError(error, "listForLead");
    return (data ?? []) as OutreachRow[];
  }

  async listRecentRows(limit: number): Promise<OutreachRow[]> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw toRepositoryError(error, "listRecent");
    return (data ?? []) as OutreachRow[];
  }

  async updateRow(row: OutreachRow): Promise<OutreachRow | null> {
    // Never touches lead_id, channel, id or created_at: a record must keep
    // naming the business and the channel it was written for.
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .update({
        status: row.status,
        subject: row.subject,
        body: row.body,
        outcome: row.outcome,
        sent_at: row.sent_at,
        updated_at: row.updated_at,
      })
      .eq("id", row.id)
      .select("*")
      .maybeSingle();

    if (error) throw toRepositoryError(error, "update");
    return (data as OutreachRow | null) ?? null;
  }
}

/**
 * In-memory gateway.
 *
 * Used by tests and by the local JSON configuration. Explicitly NOT durable --
 * a restart loses everything.
 */
export class InMemoryOutreachTableGateway implements OutreachTableGateway {
  private rows: OutreachRow[] = [];

  async insertRow(row: OutreachRow): Promise<void> {
    if (this.rows.some((r) => r.id === row.id)) {
      throw new OutreachRepositoryError("Duplicate outreach record id.");
    }
    this.rows.push({ ...row });
  }

  async findRowById(id: string): Promise<OutreachRow | null> {
    const row = this.rows.find((r) => r.id === id);
    return row ? { ...row } : null;
  }

  private newestFirst(rows: OutreachRow[]): OutreachRow[] {
    return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listRowsForLead(leadId: string): Promise<OutreachRow[]> {
    return this.newestFirst(this.rows.filter((r) => r.lead_id === leadId));
  }

  async listRecentRows(limit: number): Promise<OutreachRow[]> {
    return this.newestFirst(this.rows).slice(0, limit);
  }

  async updateRow(row: OutreachRow): Promise<OutreachRow | null> {
    const index = this.rows.findIndex((r) => r.id === row.id);
    if (index === -1) return null;

    // Same immutable columns as the Supabase gateway.
    const existing = this.rows[index];
    const updated: OutreachRow = {
      ...existing,
      status: row.status,
      subject: row.subject,
      body: row.body,
      outcome: row.outcome,
      sent_at: row.sent_at,
      updated_at: row.updated_at,
    };
    this.rows[index] = updated;
    return { ...updated };
  }
}
