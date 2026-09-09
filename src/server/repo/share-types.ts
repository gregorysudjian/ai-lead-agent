/**
 * Persistence contract for demo shares.
 *
 * Append-mostly rather than append-only, which is the one place this differs
 * from `DemoSiteRepository`. Revoking has to change an existing row, so the
 * Supabase grant includes UPDATE where demo_sites deliberately excludes it --
 * and `revoke` is the only method that writes to an existing share. There is
 * no way through this interface to change a token, move a share to a different
 * demo, or extend an expiry: a link that has been handed out cannot be quietly
 * repointed or made to last longer than it was issued for.
 *
 * There is no delete. A share that was created is a record of something we
 * did; rows disappear only when their demo does, through the cascade.
 */
import type { DemoShare } from "@/lib/demo-share";

export interface CreateShareInput {
  demoId: string;
  /** ISO-8601, already clamped by the caller. */
  expiresAt: string;
  note: string | null;
}

export interface DemoShareRepository {
  /** Issue a share. The token is generated here, never supplied by a caller. */
  create(input: CreateShareInput): Promise<DemoShare>;

  /**
   * Resolve a token to its share, or null.
   *
   * Returns the share whatever its state -- expired and revoked included. The
   * CALLER decides what a visitor is told, and every unusable state must
   * present identically, so this deliberately does not filter.
   */
  findByToken(token: string): Promise<DemoShare | null>;

  /** Every share issued for one demo, newest first. */
  listForDemo(demoId: string): Promise<DemoShare[]>;

  /**
   * Withdraw a share. Returns the updated record, or null when no share has
   * that id. Revoking an already-revoked share keeps the original timestamp:
   * the moment it stopped working is the fact worth keeping.
   */
  revoke(id: string): Promise<DemoShare | null>;
}

/** Thrown when the share store cannot be read or written. */
export class DemoShareRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DemoShareRepositoryError";
  }
}
