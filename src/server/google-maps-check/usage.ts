import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The cost guard: every billable Google call is written down before it is
 * made, and none is made once this month's count reaches the cap.
 *
 * Google gives 5,000 "Text Search Pro" calls a month at no charge. The cap is
 * set well under that, and it is counted from the database -- not from one
 * run's memory -- so it holds across runs, retries and machines. The month is
 * counted from a day BEFORE the calendar month starts: Google bills on Pacific
 * time, and over-counting by a day is the safe direction.
 */
export const MONTHLY_CAP = { text_search_pro: 4_500, text_search_ids_only: 100_000 } as const;
export type GoogleSku = keyof typeof MONTHLY_CAP;

export interface UsageLedger {
  /** Calls of this kind recorded since (a day before) the start of this month. */
  countThisMonth(sku: GoogleSku, now?: Date): Promise<number>;
  /** Record one call about to be made. */
  record(sku: GoogleSku): Promise<void>;
}

/** The earliest moment that counts toward this month. */
export function monthStart(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

export function supabaseUsageLedger(client: SupabaseClient): UsageLedger {
  return {
    async countThisMonth(sku, now = new Date()) {
      const { count, error } = await client
        .from("google_api_calls")
        .select("id", { count: "exact" })
        .eq("sku", sku)
        .gte("called_at", monthStart(now).toISOString())
        .range(0, 0);
      if (error) throw new Error(`Could not count Google calls [${error.code ?? "?"}].`);
      return count ?? 0;
    },
    async record(sku) {
      const { error } = await client.from("google_api_calls").insert({ sku });
      if (error) throw new Error(`Could not record a Google call [${error.code ?? "?"}].`);
    },
  };
}

/**
 * Reserve one call: record it, or refuse when the cap is reached.
 *
 * `used` is the caller's running count (this month's count at start plus
 * every call reserved since), so a run never needs to re-count per call.
 */
export async function reserveCall(ledger: UsageLedger, sku: GoogleSku, used: number): Promise<boolean> {
  if (used >= MONTHLY_CAP[sku]) return false;
  await ledger.record(sku);
  return true;
}
