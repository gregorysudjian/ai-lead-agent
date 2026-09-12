import {
  GOOGLE_CHECK_VERDICTS,
  type CatalogBusiness,
  type Coordinates,
  type GoogleCheck,
  type GoogleCheckVerdict,
  type IngestRun,
  type IngestRunState,
} from "@/lib/catalog/types";

import { dedupeColumnsFor, LeadRowMappingError, toProviderSnapshot } from "./supabase-mapping";

/**
 * Row shapes and validation for the catalog and its refresh log.
 *
 * Validated on every read, like every other row here: the database guarantees
 * column types, not that a row still matches the domain after a migration, a
 * manual edit in the dashboard, or a restore. A malformed row is a hard error,
 * never a business that quietly renders with holes in it.
 *
 * Deliberately NOT server-only: pure mapping, no I/O, directly testable.
 */

export interface BusinessRow {
  id: string;
  provider: unknown;
  provider_source: string;
  provider_external_id: string;
  normalized_name: string;
  normalized_address: string | null;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  first_seen_at: string;
  last_seen_at: string;
  first_seen_release: string;
  last_seen_release: string;
  lead_id: string | null;
  google_place_id: string | null;
  google_check: string | null;
  google_checked_at: string | null;
}

export interface IngestRunRow {
  id: string;
  dataset: string;
  release: string;
  area: string;
  source_file: string;
  source_sha256: string;
  records: number;
  businesses_added: number;
  businesses_refreshed: number;
  records_collapsed: number;
  records_skipped: number;
  businesses_unseen: number | null;
  leads_linked: number;
  started_at: string;
  finished_at: string | null;
  state: string;
  detail: string | null;
}

export class CatalogRowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogRowMappingError";
  }
}

function fail(field: string, problem: string): never {
  throw new CatalogRowMappingError(`Invalid catalog row: ${field} ${problem}.`);
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(field, "must be a non-empty string");
  return value;
}

function nullableStr(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(field, "must be a string or null");
  return value;
}

function timestamp(value: unknown, field: string): string {
  const raw = str(value, field);
  if (!Number.isFinite(Date.parse(raw))) fail(field, "must be a parseable timestamp");
  return raw;
}

function nullableTimestamp(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return timestamp(value, field);
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(field, "must be a non-negative integer");
  }
  return value;
}

function nullableCount(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return count(value, field);
}

/**
 * A coordinate pair, or null. Half a pair is corruption, not "partly known".
 *
 * Postgres returns `double precision` as a number; a numeric string is also
 * accepted because some drivers serialise it that way.
 */
function coordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  const missing = (value: unknown) => value === null || value === undefined;
  if (missing(latitude) && missing(longitude)) return null;
  if (missing(latitude) || missing(longitude)) fail("latitude/longitude", "must both be set or both be null");

  const lat = typeof latitude === "string" ? Number(latitude) : latitude;
  const lon = typeof longitude === "string" ? Number(longitude) : longitude;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    fail("latitude", "must be a number between -90 and 90");
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    fail("longitude", "must be a number between -180 and 180");
  }
  return { latitude: lat, longitude: lon };
}

/**
 * The three Google check columns -> one value, or null when never checked.
 *
 * All three are read together: a verdict without a time, or a place id with
 * no verdict, is corruption. Rows from before the check existed have none of
 * the columns set (or none of the keys at all) and read as unchecked.
 */
function googleCheck(row: Record<string, unknown>): GoogleCheck | null {
  const verdict = row.google_check ?? null;
  const checkedAt = row.google_checked_at ?? null;
  const placeId = row.google_place_id ?? null;
  if (verdict === null && checkedAt === null) {
    if (placeId !== null) fail("google_place_id", "is set on a business that was never checked");
    return null;
  }
  if (typeof verdict !== "string" || !GOOGLE_CHECK_VERDICTS.includes(verdict as GoogleCheckVerdict)) {
    fail("google_check", "is not a known verdict");
  }
  if (placeId !== null && typeof placeId !== "string") fail("google_place_id", "must be a string or null");
  return {
    verdict: verdict as GoogleCheckVerdict,
    placeId: placeId as string | null,
    checkedAt: timestamp(checkedAt, "google_checked_at"),
  };
}

/** Database row -> catalog business. Throws on anything malformed. */
export function rowToCatalogBusiness(value: unknown): CatalogBusiness {
  if (typeof value !== "object" || value === null) fail("row", "must be an object");
  const row = value as Record<string, unknown>;

  let provider;
  try {
    // The same validator a lead's snapshot goes through: one type, one check.
    provider = toProviderSnapshot(row.provider);
  } catch (error) {
    if (error instanceof LeadRowMappingError) fail("provider", `is not a valid snapshot (${error.message})`);
    throw error;
  }

  // The indexed dedupe columns must still describe this snapshot. If they
  // disagree, the database is deduplicating against an identity the
  // application never returns -- fail loudly rather than hand it out.
  const expected = dedupeColumnsFor(provider);
  for (const column of [
    "provider_source",
    "provider_external_id",
    "normalized_name",
    "normalized_address",
  ] as const) {
    if ((row[column] ?? null) !== expected[column]) fail(column, "disagrees with the provider snapshot");
  }

  return {
    id: str(row.id, "id"),
    municipality: str(row.municipality, "municipality"),
    location: coordinates(row.latitude, row.longitude),
    firstSeenAt: timestamp(row.first_seen_at, "first_seen_at"),
    lastSeenAt: timestamp(row.last_seen_at, "last_seen_at"),
    firstSeenRelease: str(row.first_seen_release, "first_seen_release"),
    lastSeenRelease: str(row.last_seen_release, "last_seen_release"),
    leadId: nullableStr(row.lead_id, "lead_id"),
    googleCheck: googleCheck(row),
    provider,
  };
}

/** Catalog business -> database row, with the dedupe columns derived here. */
export function catalogBusinessToRow(business: CatalogBusiness): BusinessRow {
  return {
    id: business.id,
    provider: business.provider,
    ...dedupeColumnsFor(business.provider),
    municipality: business.municipality,
    latitude: business.location?.latitude ?? null,
    longitude: business.location?.longitude ?? null,
    first_seen_at: business.firstSeenAt,
    last_seen_at: business.lastSeenAt,
    first_seen_release: business.firstSeenRelease,
    last_seen_release: business.lastSeenRelease,
    lead_id: business.leadId,
    google_place_id: business.googleCheck?.placeId ?? null,
    google_check: business.googleCheck?.verdict ?? null,
    google_checked_at: business.googleCheck?.checkedAt ?? null,
  };
}

const RUN_STATES: readonly IngestRunState[] = ["running", "complete", "failed"];

export function rowToIngestRun(value: unknown): IngestRun {
  if (typeof value !== "object" || value === null) fail("run row", "must be an object");
  const row = value as Record<string, unknown>;

  const state = str(row.state, "state");
  if (!RUN_STATES.includes(state as IngestRunState)) fail("state", "is not a known run state");

  return {
    id: str(row.id, "id"),
    dataset: str(row.dataset, "dataset"),
    release: str(row.release, "release"),
    area: str(row.area, "area"),
    sourceFile: str(row.source_file, "source_file"),
    sourceSha256: str(row.source_sha256, "source_sha256"),
    records: count(row.records, "records"),
    businessesAdded: count(row.businesses_added, "businesses_added"),
    businessesRefreshed: count(row.businesses_refreshed, "businesses_refreshed"),
    recordsCollapsed: count(row.records_collapsed, "records_collapsed"),
    recordsSkipped: count(row.records_skipped, "records_skipped"),
    businessesUnseen: nullableCount(row.businesses_unseen, "businesses_unseen"),
    leadsLinked: count(row.leads_linked, "leads_linked"),
    startedAt: timestamp(row.started_at, "started_at"),
    finishedAt: nullableTimestamp(row.finished_at, "finished_at"),
    state: state as IngestRunState,
    detail: nullableStr(row.detail, "detail"),
  };
}

export function ingestRunToRow(run: IngestRun): IngestRunRow {
  return {
    id: run.id,
    dataset: run.dataset,
    release: run.release,
    area: run.area,
    source_file: run.sourceFile,
    source_sha256: run.sourceSha256,
    records: run.records,
    businesses_added: run.businessesAdded,
    businesses_refreshed: run.businessesRefreshed,
    records_collapsed: run.recordsCollapsed,
    records_skipped: run.recordsSkipped,
    businesses_unseen: run.businessesUnseen,
    leads_linked: run.leadsLinked,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    state: run.state,
    detail: run.detail,
  };
}
