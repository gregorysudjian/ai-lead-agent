/**
 * Row <-> domain mapping and validation for outreach records.
 *
 * Same contract as every other mapping module: a row is untrusted until it has
 * been through here, and a draft is rejected before it reaches the database
 * rather than after. Bounds match the CHECK constraints in the migration, so a
 * value that would be refused by Postgres is refused here first, with a message
 * that says which field.
 */
import {
  OUTREACH_STATUSES,
  type OutreachChannel,
  type OutreachRecord,
  type OutreachStatus,
} from "@/lib/outreach";

export interface OutreachRow {
  id: string;
  lead_id: string;
  channel: string;
  status: string;
  contact: string | null;
  subject: string | null;
  body: string;
  outcome: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors the CHECK constraints. One definition, enforced on both sides. */
export const OUTREACH_LIMITS = {
  contact: 400,
  subject: 300,
  body: 8000,
  outcome: 4000,
} as const;

const CHANNELS: readonly OutreachChannel[] = ["phone", "email", "social", "in-person"];

export class OutreachMappingError extends Error {
  constructor(field: string, problem: string) {
    super(`Outreach record ${field} ${problem}.`);
    this.name = "OutreachMappingError";
  }
}

function fail(field: string, problem: string): never {
  throw new OutreachMappingError(field, problem);
}

function str(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(field, "is missing or not a non-empty string");
  }
  const text = value as string;
  // Checked, never truncated: half a message is not the message.
  if (text.length > maxLength) {
    fail(field, `is longer than the ${maxLength} characters this field allows`);
  }
  return text;
}

function strOrNull(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  return str(value, field, maxLength);
}

/** Must be a real instant that round-trips through ISO-8601. */
function isoOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(field, "is not a timestamp");
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) fail(field, "is not a valid timestamp");
  return date.toISOString();
}

function iso(value: unknown, field: string): string {
  const parsed = isoOrNull(value, field);
  if (parsed === null) fail(field, "is missing");
  return parsed;
}

export function assertChannel(value: unknown, field = "channel"): OutreachChannel {
  if (typeof value !== "string" || !CHANNELS.includes(value as OutreachChannel)) {
    fail(field, "is not a known outreach channel");
  }
  return value as OutreachChannel;
}

export function assertStatus(value: unknown, field = "status"): OutreachStatus {
  if (typeof value !== "string" || !OUTREACH_STATUSES.includes(value as OutreachStatus)) {
    fail(field, "is not a known outreach status");
  }
  return value as OutreachStatus;
}

export function rowToOutreachRecord(row: OutreachRow): OutreachRecord {
  return {
    id: str(row.id, "id", 64),
    leadId: str(row.lead_id, "leadId", 64),
    channel: assertChannel(row.channel),
    status: assertStatus(row.status),
    contact: strOrNull(row.contact, "contact", OUTREACH_LIMITS.contact),
    subject: strOrNull(row.subject, "subject", OUTREACH_LIMITS.subject),
    body: str(row.body, "body", OUTREACH_LIMITS.body),
    outcome: strOrNull(row.outcome, "outcome", OUTREACH_LIMITS.outcome),
    sentAt: isoOrNull(row.sent_at, "sentAt"),
    createdAt: iso(row.created_at, "createdAt"),
    updatedAt: iso(row.updated_at, "updatedAt"),
  };
}

export function outreachRecordToRow(record: OutreachRecord): OutreachRow {
  return {
    id: record.id,
    lead_id: record.leadId,
    channel: record.channel,
    status: record.status,
    contact: record.contact,
    subject: record.subject,
    body: record.body,
    outcome: record.outcome,
    sent_at: record.sentAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

/** Validate the parts a caller supplies when creating a draft. */
export function assertValidDraft(draft: {
  channel: unknown;
  contact: unknown;
  subject: unknown;
  body: unknown;
}): { channel: OutreachChannel; contact: string | null; subject: string | null; body: string } {
  const channel = assertChannel(draft.channel);
  const subject = strOrNull(draft.subject, "subject", OUTREACH_LIMITS.subject);

  // A subject is an email concept. Carrying one on a phone call would render
  // as a field that means nothing, so it is rejected rather than ignored.
  if (channel !== "email" && subject !== null) {
    fail("subject", "is only meaningful for the email channel");
  }

  return {
    channel,
    contact: strOrNull(draft.contact, "contact", OUTREACH_LIMITS.contact),
    subject,
    body: str(draft.body, "body", OUTREACH_LIMITS.body),
  };
}
