import "server-only";

import { randomUUID } from "node:crypto";

import type { OutreachChannel, OutreachRecord } from "@/lib/outreach";

import type { OutreachTableGateway } from "./outreach-gateway";
import {
  assertStatus,
  assertValidDraft,
  outreachRecordToRow,
  OUTREACH_LIMITS,
  rowToOutreachRecord,
} from "./outreach-mapping";
import { SupabaseOutreachTableGateway } from "./outreach-table";
import {
  OutreachRepositoryError,
  type OutreachRepository,
  type OutreachUpdate,
} from "./outreach-types";

/**
 * Outreach persistence, backed by whichever gateway is supplied.
 *
 * The rules live here rather than in the gateway, so they hold whichever store
 * is underneath:
 *
 *   - a draft is validated before it is written
 *   - `id`, `leadId`, `channel` and `createdAt` are never updatable
 *   - `sentAt` is whatever the CALLER passed, because only a person knows
 *     whether a message was actually sent. Nothing here infers it from a
 *     status change, and nothing here sends anything.
 */
export function createOutreachRepository(
  gateway: OutreachTableGateway,
  options: { now?: () => Date } = {},
): OutreachRepository {
  const now = options.now ?? (() => new Date());

  return {
    async create(
      leadId: string,
      draft: {
        channel: OutreachChannel;
        contact: string | null;
        subject: string | null;
        body: string;
      },
    ): Promise<OutreachRecord> {
      const validated = assertValidDraft(draft);
      const timestamp = now().toISOString();

      const record: OutreachRecord = {
        id: randomUUID(),
        leadId,
        status: "draft",
        outcome: null,
        // A new record has not been sent, by construction. There is no path
        // that could have sent it.
        sentAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...validated,
      };

      try {
        await gateway.insertRow(outreachRecordToRow(record));
      } catch (error) {
        throw asRepositoryError(error, "Could not save the outreach draft.");
      }
      return record;
    },

    async findById(id: string): Promise<OutreachRecord | null> {
      try {
        const row = await gateway.findRowById(id);
        return row ? rowToOutreachRecord(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not read the outreach record.");
      }
    },

    async listForLead(leadId: string): Promise<OutreachRecord[]> {
      try {
        return (await gateway.listRowsForLead(leadId)).map(rowToOutreachRecord);
      } catch (error) {
        throw asRepositoryError(error, "Could not read outreach for this lead.");
      }
    },

    async listRecent(limit: number): Promise<OutreachRecord[]> {
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new OutreachRepositoryError("listRecent requires a positive integer limit.");
      }
      try {
        return (await gateway.listRecentRows(limit)).map(rowToOutreachRecord);
      } catch (error) {
        throw asRepositoryError(error, "Could not read outreach records.");
      }
    },

    async update(id: string, changes: OutreachUpdate): Promise<OutreachRecord | null> {
      const existing = await this.findById(id);
      if (!existing) return null;

      const next: OutreachRecord = {
        ...existing,
        // Everything above this line is fixed: id, leadId, channel, contact
        // and createdAt all come from `existing` and are not in OutreachUpdate.
        status: changes.status === undefined ? existing.status : assertStatus(changes.status),
        subject: changes.subject === undefined ? existing.subject : changes.subject,
        body: changes.body === undefined ? existing.body : changes.body,
        outcome: changes.outcome === undefined ? existing.outcome : changes.outcome,
        sentAt: changes.sentAt === undefined ? existing.sentAt : changes.sentAt,
        updatedAt: now().toISOString(),
      };

      // Re-validate the mutable text, so an update cannot store what a create
      // would have refused.
      assertValidDraft({
        channel: next.channel,
        contact: next.contact,
        subject: next.subject,
        body: next.body,
      });
      if (next.outcome !== null && next.outcome.length > OUTREACH_LIMITS.outcome) {
        throw new OutreachRepositoryError("The outcome note is too long.");
      }

      try {
        const row = await gateway.updateRow(outreachRecordToRow(next));
        return row ? rowToOutreachRecord(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not update the outreach record.");
      }
    },
  };
}

function asRepositoryError(error: unknown, message: string): OutreachRepositoryError {
  if (error instanceof OutreachRepositoryError) return error;
  return new OutreachRepositoryError(message, { cause: error });
}

/** The wired-up production instance. */
export function supabaseOutreachRepository(): OutreachRepository {
  return createOutreachRepository(new SupabaseOutreachTableGateway());
}
