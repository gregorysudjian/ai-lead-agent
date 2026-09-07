/**
 * Persistence contract for business profiles.
 *
 * Append-only, like analyses and demo sites: there is no update and no delete.
 * A fresh research run creates a new profile, so what we believed at any point
 * stays readable, and the Supabase grant narrows to SELECT + INSERT.
 *
 * That matters more here than elsewhere. A profile is the evidence record a
 * later conversation with a business owner rests on; being able to say "this
 * is what we had on 6 September, and this is where each part came from"
 * requires that nothing was ever quietly edited.
 */
import type { BusinessProfile, BusinessProfileDraft } from "@/lib/business-profile";

export interface BusinessProfileRepository {
  /** Persist a completed research run and return the stored record. */
  create(leadId: string, draft: BusinessProfileDraft): Promise<BusinessProfile>;

  /** One profile by its own id, or null. */
  findById(id: string): Promise<BusinessProfile | null>;

  /** Every profile for a lead, newest first. */
  listForLead(leadId: string): Promise<BusinessProfile[]>;

  /** The most recent profile for a lead, or null when never researched. */
  latestForLead(leadId: string): Promise<BusinessProfile | null>;

  /** The most recent profiles across all leads, newest first. */
  listRecent(limit: number): Promise<BusinessProfile[]>;
}

/** Thrown when the profile store cannot be read or written. */
export class BusinessProfileRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BusinessProfileRepositoryError";
  }
}
