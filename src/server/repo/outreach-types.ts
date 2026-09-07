/**
 * Persistence contract for outreach records.
 *
 * The one MUTABLE store in the application. Analyses, demo sites and business
 * profiles are append-only because they are evidence of what we believed at a
 * moment; an outreach record is a piece of work in progress that a human moves
 * through states and annotates afterwards.
 *
 * What it still does not have is a delete. An outreach record is the log of a
 * business having been approached, and that is precisely the fact worth
 * keeping -- not least so a request never to be contacted again can be
 * honoured rather than forgotten.
 *
 * There is no `send`. There is no method here that could deliver anything,
 * because nothing in this application delivers anything.
 */
import type { OutreachChannel, OutreachRecord, OutreachStatus } from "@/lib/outreach";

/** The parts of a record a human may change after it exists. */
export interface OutreachUpdate {
  status?: OutreachStatus;
  subject?: string | null;
  body?: string;
  outcome?: string | null;
  /**
   * The moment a PERSON reports having sent this.
   *
   * Supplied by the caller rather than stamped on a status change, so it is
   * always something someone asserted and never something the system inferred.
   */
  sentAt?: string | null;
}

export interface OutreachRepository {
  /** Persist a new draft and return the stored record. */
  create(
    leadId: string,
    draft: { channel: OutreachChannel; contact: string | null; subject: string | null; body: string },
  ): Promise<OutreachRecord>;

  /** One record by its own id, or null. */
  findById(id: string): Promise<OutreachRecord | null>;

  /** Every record for a lead, newest first. */
  listForLead(leadId: string): Promise<OutreachRecord[]>;

  /** The most recent records across all leads, newest first. */
  listRecent(limit: number): Promise<OutreachRecord[]>;

  /**
   * Apply a human's changes. Returns the updated record, or null when no
   * record has that id -- a normal 404, not an exception.
   *
   * `leadId`, `channel`, `createdAt` and `id` are not updatable: a record must
   * keep naming the business it was written for.
   */
  update(id: string, changes: OutreachUpdate): Promise<OutreachRecord | null>;
}

/** Thrown when the outreach store cannot be read or written. */
export class OutreachRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OutreachRepositoryError";
  }
}
