import type { DemoShare } from "@/lib/demo-share";

/**
 * Row shape and validation for demo shares.
 *
 * Validated on every read for the same reason every other row is: the database
 * guarantees column types, not that a row still matches the domain after a
 * migration, a manual edit, or a restore. It matters more here than elsewhere,
 * because this is the one table whose contents gate an unauthenticated route --
 * a malformed row must be a hard error, never a share that quietly works.
 */

export interface DemoShareRow {
  id: string;
  demo_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  note: string | null;
}

export class DemoShareRowMappingError extends Error {
  constructor(field: string, problem: string) {
    super(`Invalid demo share row: ${field} ${problem}.`);
    this.name = "DemoShareRowMappingError";
  }
}

function fail(field: string, problem: string): never {
  throw new DemoShareRowMappingError(field, problem);
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(field, "must be a non-empty string");
  }
  return value;
}

function nullableStr(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(field, "must be a string or null");
  return value;
}

/**
 * A timestamp we can actually reason about.
 *
 * An unparseable value is rejected rather than carried, because `shareState`
 * treats an unreadable expiry as expired -- which is the right failure, but a
 * silent one. Catching it here turns a corrupt row into a loud error at the
 * boundary instead of a share that mysteriously never works.
 */
function timestamp(value: unknown, field: string): string {
  const raw = str(value, field);
  if (!Number.isFinite(Date.parse(raw))) fail(field, "must be a parseable timestamp");
  return raw;
}

function nullableTimestamp(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return timestamp(value, field);
}

/**
 * The token length the application issues, in characters.
 *
 * 32 random bytes encoded base64url. Asserted on read so a short token -- one
 * hand-inserted during debugging, say -- cannot become a working link.
 */
const MIN_TOKEN_LENGTH = 32;

export function rowToDemoShare(value: unknown): DemoShare {
  if (typeof value !== "object" || value === null) fail("row", "must be an object");
  const row = value as Record<string, unknown>;

  const token = str(row.token, "token");
  if (token.length < MIN_TOKEN_LENGTH) fail("token", "is too short to be a share token");

  return {
    id: str(row.id, "id"),
    demoId: str(row.demo_id, "demo_id"),
    token,
    createdAt: timestamp(row.created_at, "created_at"),
    expiresAt: timestamp(row.expires_at, "expires_at"),
    revokedAt: nullableTimestamp(row.revoked_at, "revoked_at"),
    note: nullableStr(row.note, "note"),
  };
}

export function demoShareToRow(share: DemoShare): DemoShareRow {
  return {
    id: share.id,
    demo_id: share.demoId,
    token: share.token,
    created_at: share.createdAt,
    expires_at: share.expiresAt,
    revoked_at: share.revokedAt,
    note: share.note,
  };
}
