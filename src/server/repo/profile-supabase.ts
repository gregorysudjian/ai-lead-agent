import "server-only";

import { randomUUID } from "node:crypto";

import type { BusinessProfile, BusinessProfileDraft } from "@/lib/business-profile";

import type { BusinessProfileTableGateway } from "./profile-gateway";
import {
  assertValidProfileDraft,
  businessProfileToRow,
  rowToBusinessProfile,
} from "./profile-mapping";
import { SupabaseBusinessProfileTableGateway } from "./profile-table";
import { BusinessProfileRepositoryError, type BusinessProfileRepository } from "./profile-types";

/**
 * Business-profile persistence, backed by whichever gateway is supplied.
 *
 * Validates the assembled draft BEFORE writing, including the rule that every
 * observation names a source present in the same document. A profile that
 * would fail that check is rejected rather than stored: a row full of
 * unattributable facts is worse than a failed research run, because it looks
 * like evidence.
 */
export function createBusinessProfileRepository(
  gateway: BusinessProfileTableGateway,
  options: { now?: () => Date } = {},
): BusinessProfileRepository {
  const now = options.now ?? (() => new Date());

  return {
    async create(leadId: string, draft: BusinessProfileDraft): Promise<BusinessProfile> {
      const validated = assertValidProfileDraft(draft);
      const timestamp = now().toISOString();

      const profile: BusinessProfile = {
        id: randomUUID(),
        leadId,
        status: "complete",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...validated,
      };

      try {
        await gateway.insertRow(businessProfileToRow(profile));
      } catch (error) {
        throw new BusinessProfileRepositoryError("Could not save the business profile.", {
          cause: error,
        });
      }
      return profile;
    },

    async findById(id: string): Promise<BusinessProfile | null> {
      try {
        const row = await gateway.findRowById(id);
        return row ? rowToBusinessProfile(row) : null;
      } catch (error) {
        throw asRepositoryError(error, "Could not read the business profile.");
      }
    },

    async listForLead(leadId: string): Promise<BusinessProfile[]> {
      try {
        return (await gateway.listRowsForLead(leadId)).map(rowToBusinessProfile);
      } catch (error) {
        throw asRepositoryError(error, "Could not read profiles for this lead.");
      }
    },

    async latestForLead(leadId: string): Promise<BusinessProfile | null> {
      // The gateway returns newest first, so the head is the latest.
      const [latest] = await this.listForLead(leadId);
      return latest ?? null;
    },

    async listRecent(limit: number): Promise<BusinessProfile[]> {
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new BusinessProfileRepositoryError("listRecent requires a positive integer limit.");
      }
      try {
        return (await gateway.listRecentRows(limit)).map(rowToBusinessProfile);
      } catch (error) {
        throw asRepositoryError(error, "Could not read business profiles.");
      }
    },
  };
}

function asRepositoryError(error: unknown, message: string): BusinessProfileRepositoryError {
  if (error instanceof BusinessProfileRepositoryError) return error;
  return new BusinessProfileRepositoryError(message, { cause: error });
}

/** The wired-up production instance. */
export function supabaseBusinessProfileRepository(): BusinessProfileRepository {
  return createBusinessProfileRepository(new SupabaseBusinessProfileTableGateway());
}
