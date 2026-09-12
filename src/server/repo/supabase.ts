import "server-only";

import { randomUUID } from "node:crypto";

import type { DiscoveredBusiness, Lead, LeadStatus } from "@/lib/types";

import { SupabaseLeadTableGateway } from "./supabase-table";
import { UniqueViolationError, type LeadTableGateway } from "./supabase-gateway";
import {
  dedupeColumnsFor,
  leadToRow,
  refreshPatchFor,
  rowToLead,
  type LeadRow,
} from "./supabase-mapping";
import { LeadRepositoryError, type LeadRepository, type UpsertSummary } from "./types";

/**
 * Supabase/PostgreSQL-backed lead store.
 *
 * Semantics are identical to the JSON repository -- same dedupe rules, same
 * preservation guarantees -- but correctness now rests on database constraints
 * rather than an in-process lock.
 *
 * CONCURRENCY. The JSON store serialized everything through a promise queue,
 * which only ever worked because a single process owned the file. That approach
 * is not the source of truth here: two server instances could run the same
 * search simultaneously. Instead the unique indexes are the final authority.
 * The read-then-write below is an optimization for the common case; when it
 * loses a race the insert is rejected and we refresh the winner's row instead.
 */
export function createSupabaseLeadRepository(
  gateway: LeadTableGateway,
  options: { now?: () => Date } = {},
): LeadRepository {
  const now = options.now ?? (() => new Date());

  async function refreshExisting(
    existing: LeadRow,
    business: DiscoveredBusiness,
    timestamp: string,
  ): Promise<Lead> {
    // Only updated_at, the provider snapshot and the derived helper columns are
    // written. id, status and created_at are simply not in the patch, so they
    // survive by construction rather than by being carefully copied.
    const updated = await gateway.updateRow(
      existing.id,
      refreshPatchFor(business, timestamp),
    );
    if (!updated) {
      throw new LeadRepositoryError("Lead disappeared while being refreshed.");
    }
    return rowToLead(updated);
  }

  return {
    async list(): Promise<Lead[]> {
      try {
        return (await gateway.listRows()).map(rowToLead).filter((lead) => lead.removal === undefined);
      } catch (error) {
        throw asRepositoryError(error, "Could not read leads from the database.");
      }
    },

    async findById(id: string): Promise<Lead | null> {
      try {
        const row = await gateway.findRowById(id);
        return row ? rowToLead(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not read the lead from the database.");
      }
    },

    async updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
      try {
        const updated = await gateway.updateRow(id, {
          status,
          updated_at: now().toISOString(),
        });
        return updated ? rowToLead(updated) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not update the lead.");
      }
    },

    async markRemoved(id: string, reason: string): Promise<Lead | null> {
      const trimmed = reason.trim();
      if (trimmed.length === 0 || trimmed.length > 500) {
        throw new LeadRepositoryError("A removal needs a reason of 1 to 500 characters.");
      }
      try {
        const timestamp = now().toISOString();
        const updated = await gateway.updateRow(id, {
          removed_at: timestamp,
          removed_reason: trimmed,
          updated_at: timestamp,
        });
        return updated ? rowToLead(updated) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not remove the lead.");
      }
    },

    async restore(id: string): Promise<Lead | null> {
      try {
        const updated = await gateway.updateRow(id, {
          removed_at: null,
          removed_reason: null,
          updated_at: now().toISOString(),
        });
        return updated ? rowToLead(updated) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not restore the lead.");
      }
    },

    async upsertDiscovered(
      businesses: readonly DiscoveredBusiness[],
    ): Promise<UpsertSummary> {
      const timestamp = now().toISOString();
      const touched: Lead[] = [];
      const createdIds: string[] = [];
      let created = 0;
      let updated = 0;

      try {
        for (const business of businesses) {
          const dedupe = dedupeColumnsFor(business);

          // Fast path: an existing lead already represents this business.
          const existing = await gateway.findMatchingRow(dedupe);
          if (existing) {
            touched.push(await refreshExisting(existing, business, timestamp));
            updated += 1;
            continue;
          }

          const lead: Lead = {
            id: randomUUID(),
            status: "new",
            createdAt: timestamp,
            updatedAt: timestamp,
            provider: business,
          };

          try {
            await gateway.insertRow(leadToRow(lead));
            touched.push(lead);
            createdIds.push(lead.id);
            created += 1;
          } catch (error) {
            if (!(error instanceof UniqueViolationError)) throw error;

            // We lost a race, or an earlier business in this same batch already
            // created the row. Either way the database refused to duplicate it:
            // find the winner and refresh it, exactly as if we had seen it.
            const winner = await gateway.findMatchingRow(dedupe);
            if (!winner) {
              throw new LeadRepositoryError(
                "A unique index rejected the insert but no matching lead was found.",
                { cause: error },
              );
            }
            touched.push(await refreshExisting(winner, business, timestamp));
            updated += 1;
          }
        }
      } catch (error) {
        throw asRepositoryError(error, "Could not save discovered businesses.");
      }

      return { created, updated, leads: touched, createdIds };
    },
  };
}

/** Wrap anything unexpected; never let a driver error escape unlabelled. */
function asRepositoryError(error: unknown, message: string): LeadRepositoryError {
  if (error instanceof LeadRepositoryError) return error;
  return new LeadRepositoryError(message, { cause: error });
}

/** The wired-up production instance, backed by the real Supabase client. */
export function supabaseLeadRepository(): LeadRepository {
  return createSupabaseLeadRepository(new SupabaseLeadTableGateway());
}
