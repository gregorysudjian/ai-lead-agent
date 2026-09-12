/**
 * Explicit mapping between database rows and the application `Lead`.
 *
 * Two jobs:
 *   1. Keep snake_case out of the rest of the app. Nothing outside the
 *      repository layer should know the column names.
 *   2. Validate rows before they become Leads. A row is untrusted input -- it
 *      may predate a schema change, or have been written by something else --
 *      and malformed data must fail loudly rather than quietly becoming a Lead
 *      with missing fields.
 *
 * Deliberately NOT server-only: this is pure mapping with no I/O and no
 * secrets, which keeps it directly unit-testable.
 */
import { normalizeTerm } from "@/lib/normalize";
import type {
  DiscoveredBusiness,
  Lead,
  LeadStatus,
  OpeningHours,
  ProviderSnapshot,
  Weekday,
} from "@/lib/types";

/** The `leads` table shape. Database implementation detail. */
export interface LeadRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  provider: unknown;
  provider_source: string;
  provider_external_id: string;
  normalized_name: string;
  normalized_address: string | null;
  /** Both null (or absent, on rows read before the column existed) = active. */
  removed_at?: string | null;
  removed_reason?: string | null;
}

/** Thrown when a database row cannot be trusted as a Lead. */
export class LeadRowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadRowMappingError";
  }
}

const VALID_STATUSES: readonly LeadStatus[] = ["new", "reviewed"];

export function isValidLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as LeadStatus);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new LeadRowMappingError(`Lead row field "${field}" is missing or not a string.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new LeadRowMappingError(`Lead row field "${field}" must be a string or null.`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LeadRowMappingError(`Lead row field "${field}" must be a number or null.`);
  }
  return value;
}

const WEEKDAYS: readonly string[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

/**
 * Validate opening hours element by element.
 *
 * `Array.isArray` alone is not enough: jsonb guarantees only that the value is
 * JSON, so an array of nulls, numbers or half-built objects would pass and then
 * surface as a broken row in the UI. Each entry must be a real
 * OpeningHoursEntry -- a known weekday plus string open/close times.
 */
function toOpeningHours(value: unknown): OpeningHours | null {
  if (value === null || value === undefined) return null;

  if (!Array.isArray(value)) {
    throw new LeadRowMappingError("Lead row provider.openingHours must be an array or null.");
  }

  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new LeadRowMappingError(
        `Lead row provider.openingHours[${index}] is not an object.`,
      );
    }
    const e = entry as Record<string, unknown>;

    if (typeof e.day !== "string" || !WEEKDAYS.includes(e.day)) {
      throw new LeadRowMappingError(
        `Lead row provider.openingHours[${index}].day is not a weekday.`,
      );
    }
    if (typeof e.opens !== "string" || typeof e.closes !== "string") {
      throw new LeadRowMappingError(
        `Lead row provider.openingHours[${index}] must have string opens/closes.`,
      );
    }

    return { day: e.day as Weekday, opens: e.opens, closes: e.closes };
  });
}

/**
 * Validate the provider snapshot stored as jsonb.
 *
 * Checked field by field rather than cast, because `jsonb` guarantees only that
 * the value is JSON -- not that it matches our type.
 *
 * Exported because the business catalog stores the SAME snapshot shape, and
 * two validators for one type is how they come to disagree. Throws
 * `LeadRowMappingError`; the catalog mapping re-labels it for its own rows.
 */
export function toProviderSnapshot(value: unknown): ProviderSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LeadRowMappingError("Lead row provider snapshot is not an object.");
  }
  const p = value as Record<string, unknown>;

  const source = requireString(p.source, "provider.source");
  if (source !== "mock" && source !== "osm" && source !== "google" && source !== "overture") {
    throw new LeadRowMappingError(`Lead row provider.source has unknown value.`);
  }

  const openingHours = toOpeningHours(p.openingHours);

  return {
    externalId: requireString(p.externalId, "provider.externalId"),
    source,
    name: requireString(p.name, "provider.name"),
    category: requireString(p.category, "provider.category"),
    city: requireString(p.city, "provider.city"),
    address: optionalString(p.address, "provider.address"),
    phone: optionalString(p.phone, "provider.phone"),
    website: optionalString(p.website, "provider.website"),
    rating: optionalNumber(p.rating, "provider.rating"),
    reviewCount: optionalNumber(p.reviewCount, "provider.reviewCount"),
    openingHours,
    fetchedAt: requireString(p.fetchedAt, "provider.fetchedAt"),
  };
}

/**
 * Verify the dedupe helper columns still describe the provider snapshot.
 *
 * The columns are denormalized from `provider`, so they can drift: a manual SQL
 * edit, a partial restore, or a bug could leave them describing a different
 * business than the JSON does. That matters more than ordinary corruption --
 * these exact columns back the unique indexes, so a disagreement means the
 * database is deduplicating against an identity the application never returns.
 * Fail loudly rather than hand back a Lead whose stored identity is a lie.
 */
function assertDedupeColumnsMatch(row: LeadRow, provider: ProviderSnapshot): void {
  const expected = dedupeColumnsFor(provider);

  const mismatches: string[] = [];
  if (row.provider_source !== expected.provider_source) mismatches.push("provider_source");
  if (row.provider_external_id !== expected.provider_external_id) {
    mismatches.push("provider_external_id");
  }
  if (row.normalized_name !== expected.normalized_name) mismatches.push("normalized_name");
  if (row.normalized_address !== expected.normalized_address) {
    mismatches.push("normalized_address");
  }

  if (mismatches.length > 0) {
    // Names the columns, never the values -- provider data is not secret, but
    // there is no reason for a mapping error to echo row contents.
    throw new LeadRowMappingError(
      `Lead row dedupe columns disagree with the provider snapshot: ${mismatches.join(", ")}.`,
    );
  }
}

/** Database row -> application Lead. Throws on anything malformed. */
export function rowToLead(row: LeadRow): Lead {
  if (!isValidLeadStatus(row.status)) {
    throw new LeadRowMappingError(`Lead row status is not a valid LeadStatus.`);
  }

  const provider = toProviderSnapshot(row.provider);
  assertDedupeColumnsMatch(row, provider);

  const lead: Lead = {
    id: requireString(row.id, "id"),
    status: row.status,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
    provider,
  };

  // Removal is both columns or neither; the database enforces the pair too.
  const removedAt = row.removed_at ?? null;
  const reason = row.removed_reason ?? null;
  if ((removedAt === null) !== (reason === null)) {
    throw new LeadRowMappingError("Lead row has only half of a removal.");
  }
  if (removedAt !== null && reason !== null) {
    lead.removal = {
      removedAt: requireString(removedAt, "removed_at"),
      reason: requireString(reason, "removed_reason"),
    };
  }
  return lead;
}

/**
 * The dedupe helper columns, derived from a provider snapshot.
 *
 * These exist ONLY so Postgres can enforce the same rules the application
 * already applies. They mirror `src/lib/dedupe.ts` exactly:
 *
 *   - normalized_name / normalized_address use the same `normalizeTerm`, so
 *     accent, case and whitespace differences collapse identically.
 *   - normalized_address is NULL whenever the provider gave no usable address.
 *     The partial unique index skips NULLs, so a missing address can never act
 *     as a wildcard that merges two different businesses.
 */
export interface DedupeColumns {
  provider_source: string;
  provider_external_id: string;
  normalized_name: string;
  normalized_address: string | null;
}

export function dedupeColumnsFor(provider: ProviderSnapshot): DedupeColumns {
  const normalizedAddress =
    provider.address === null ? null : normalizeTerm(provider.address);

  return {
    provider_source: provider.source,
    provider_external_id: provider.externalId,
    normalized_name: normalizeTerm(provider.name),
    // An address that normalizes to an empty string carries no information, so
    // treat it exactly like a missing one rather than indexing "".
    normalized_address:
      normalizedAddress === null || normalizedAddress.length === 0 ? null : normalizedAddress,
  };
}

/** Application Lead -> full database row, ready to insert. */
export function leadToRow(lead: Lead): LeadRow {
  return {
    id: lead.id,
    status: lead.status,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    provider: lead.provider,
    ...dedupeColumnsFor(lead.provider),
  };
}

/**
 * The columns written when an existing lead is refreshed by rediscovery.
 *
 * Deliberately excludes id, status and created_at: those are application-owned
 * and survive by construction, not by remembering to omit them. The provider
 * snapshot is replaced wholesale, and the helper columns are recomputed from
 * the new snapshot so a re-listed business updates its own dedupe identity.
 */
export interface LeadRefreshPatch extends DedupeColumns {
  updated_at: string;
  provider: DiscoveredBusiness;
}

/** The columns written when a lead is removed from, or restored to, the list. */
export interface LeadRemovalPatch {
  removed_at: string | null;
  removed_reason: string | null;
  updated_at: string;
}

export function refreshPatchFor(
  business: DiscoveredBusiness,
  updatedAt: string,
): LeadRefreshPatch {
  return {
    updated_at: updatedAt,
    provider: business,
    ...dedupeColumnsFor(business),
  };
}
