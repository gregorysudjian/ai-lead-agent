/**
 * Explicit mapping between `business_profiles` rows and the domain type.
 *
 * `jsonb` guarantees only that a value is JSON. Everything below exists because
 * a stored profile is untrusted input on the way out of the database, exactly
 * like a provider payload is on the way in.
 *
 * This layer is also where the provenance rule stops being a convention:
 *
 *   - every field named in `facts` is one of the closed `ProfileField` set;
 *   - every observation's value matches the type that field declares;
 *   - a field declared as a URL rejects anything that is not an absolute
 *     http(s) URL, so a `javascript:` string can never reach a renderer;
 *   - and every observation's `sourceId` must resolve to a `SourceRecord` in
 *     the same document.
 *
 * That last check is the one that matters. A profile containing a fact whose
 * source is missing cannot be read back at all, so "where did we learn this?"
 * has an answer for every value in the store, by construction.
 *
 * Pure, no I/O, no secrets, so it is directly unit-testable.
 */
import type {
  BusinessProfile,
  BusinessProfileDraft,
  BusinessProfileStatus,
  Observation,
  ObservationKind,
  ProfileFacts,
  ProfileField,
  ProfileValue,
  ResearchArea,
  ResearchAreaStatus,
  ResearchCoverage,
  SourceRecord,
  SourceType,
} from "@/lib/business-profile";
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LIST,
  PROFILE_LIMITS,
  RESEARCH_AREA_LABELS,
  SOURCE_TYPE_LABELS,
  emptyProfileFacts,
} from "@/lib/business-profile";

/** The `business_profiles` table shape. Database implementation detail. */
export interface BusinessProfileRow {
  id: string;
  lead_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  researcher_name: string;
  researcher_version: string;
  profile: unknown;
}

export class BusinessProfileRowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessProfileRowMappingError";
  }
}

function fail(field: string, why: string): never {
  throw new BusinessProfileRowMappingError(`Business profile field "${field}" ${why}.`);
}

function obj(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(field, "is not an object");
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(field, "is missing or not a non-empty string");
  }
  const text = value as string;
  // Bounds are checked, never silently truncated: a value too long to be
  // plausible is evidence something went wrong, and half of it is not a fact.
  if (maxLength !== undefined && text.length > maxLength) {
    fail(field, `is longer than the ${maxLength} characters this field allows`);
  }
  return text;
}

function strOrNull(value: unknown, field: string, maxLength?: number): string | null {
  if (value === null || value === undefined) return null;
  return str(value, field, maxLength);
}

function list<T>(value: unknown, field: string, each: (v: unknown, f: string) => T): T[] {
  if (!Array.isArray(value)) fail(field, "must be an array");
  return value.map((entry, i) => each(entry, `${field}[${i}]`));
}

const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS) as SourceType[];
const AREAS = Object.keys(RESEARCH_AREA_LABELS) as ResearchArea[];
const AREA_STATUSES: readonly string[] = ["covered", "not-researched", "unavailable"];
const OBSERVATION_KINDS: readonly string[] = ["stated", "observed"];

/**
 * A timestamp must be a real instant, not merely a non-empty string.
 *
 * `new Date("nonsense")` is Invalid Date and `new Date("2026-02-30")` silently
 * rolls over, so the value is required to round-trip through ISO-8601. A
 * source whose fetch time cannot be trusted cannot date its own evidence.
 */
function isoTimestamp(value: unknown, field: string): string {
  const text = str(value, field, 40);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) fail(field, "is not a valid timestamp");
  if (date.toISOString() !== text) fail(field, "is not a normalized ISO-8601 timestamp");
  return text;
}

/** Source ids are referenced by every observation, so they stay simple. */
function sourceId(value: unknown, field: string): string {
  const id = str(value, field, PROFILE_LIMITS.sourceId);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    fail(field, "must be a simple identifier of letters, digits, dot, dash or underscore");
  }
  return id;
}

/**
 * A stored URL must still be an absolute http(s) URL.
 *
 * Same allowlist the lead UI applies, applied here so a bad value is rejected
 * at the boundary rather than every time something renders it.
 */
function assertUrl(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(field, "must be an absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail(field, "must use http or https");
  }
  return value;
}

/**
 * A source's reference has to match the kind of source it claims to be.
 *
 * A `website` source must name the exact absolute http(s) URL that was
 * actually fetched -- that is the whole value of the record, and a reference
 * that is not a URL cannot be checked by anyone later. The stored discovery
 * record keeps its provider form, `osm:node/123`.
 */
function sourceReference(value: unknown, field: string, type: SourceType): string {
  const reference = str(value, field, PROFILE_LIMITS.sourceReference);

  if (type === "lead-snapshot") {
    if (!/^(mock|osm|google):[^\s]+$/.test(reference)) {
      fail(field, "must be a provider reference such as osm:node/123");
    }
    return reference;
  }

  // Every other source type is something on the web, so its reference is the
  // URL that was read. The same allowlist as everywhere else: nothing that a
  // browser or a fetcher could be steered by.
  return assertUrl(reference, field);
}

function toSource(value: unknown, field: string): SourceRecord {
  const s = obj(value, field);

  const type = str(s.type, `${field}.type`, 40);
  if (!SOURCE_TYPES.includes(type as SourceType)) fail(`${field}.type`, "is not a known source type");

  return {
    id: sourceId(s.id, `${field}.id`),
    type: type as SourceType,
    reference: sourceReference(s.reference, `${field}.reference`, type as SourceType),
    fetchedAt: isoTimestamp(s.fetchedAt, `${field}.fetchedAt`),
    title: strOrNull(s.title, `${field}.title`, PROFILE_LIMITS.sourceTitle),
  };
}

function toCoverage(value: unknown, field: string): ResearchCoverage {
  const c = obj(value, field);

  const area = str(c.area, `${field}.area`);
  if (!AREAS.includes(area as ResearchArea)) fail(`${field}.area`, "is not a known research area");

  const status = str(c.status, `${field}.status`);
  if (!AREA_STATUSES.includes(status)) fail(`${field}.status`, "is not a known coverage status");

  return {
    area: area as ResearchArea,
    status: status as ResearchAreaStatus,
    note: str(c.note, `${field}.note`, PROFILE_LIMITS.coverageNote),
  };
}

/** One observation, checked against the type its field declares. */
function toObservation(value: unknown, field: string, profileField: ProfileField): Observation {
  const o = obj(value, field);
  const spec = PROFILE_FIELDS[profileField];

  const kind = str(o.kind, `${field}.kind`);
  if (!OBSERVATION_KINDS.includes(kind)) {
    // There is no "inferred": a profile records evidence, never a conclusion.
    fail(`${field}.kind`, "is not a known observation kind");
  }

  let observed: ProfileValue;
  switch (spec.type) {
    case "string": {
      const text = str(o.value, `${field}.value`, spec.maxLength ?? PROFILE_LIMITS.defaultStringValue);
      observed = spec.url ? assertUrl(text, `${field}.value`) : text;
      break;
    }
    case "number": {
      if (typeof o.value !== "number" || !Number.isFinite(o.value)) {
        fail(`${field}.value`, "must be a finite number");
      }
      observed = o.value;
      break;
    }
    case "boolean": {
      if (typeof o.value !== "boolean") fail(`${field}.value`, "must be a boolean");
      observed = o.value;
      break;
    }
  }

  return {
    value: observed,
    sourceId: sourceId(o.sourceId, `${field}.sourceId`),
    kind: kind as ObservationKind,
  };
}

/**
 * Validate the fact set, then check every observation against the sources.
 *
 * An unknown field key is rejected rather than dropped: silently discarding it
 * would hide that something wrote a fact we do not understand.
 */
export function toProfileFacts(value: unknown, sources: SourceRecord[]): ProfileFacts {
  const raw = obj(value, "profile.facts");

  for (const key of Object.keys(raw)) {
    if (!PROFILE_FIELD_LIST.includes(key as ProfileField)) {
      fail(`profile.facts.${key}`, "is not a known profile field");
    }
  }

  const known = new Set(sources.map((s) => s.id));
  const facts = emptyProfileFacts();

  for (const field of PROFILE_FIELD_LIST) {
    const entry = raw[field];
    // A missing key is treated as "no observations", so a profile written
    // before a field existed still reads. An explicit non-array is an error.
    if (entry === undefined) continue;

    facts[field] = list(entry, `profile.facts.${field}`, (v, f) =>
      toObservation(v, f, field),
    );

    if (facts[field].length > PROFILE_LIMITS.observationsPerField) {
      fail(
        `profile.facts.${field}`,
        `holds more than the ${PROFILE_LIMITS.observationsPerField} observations one field allows`,
      );
    }

    facts[field].forEach((observation, i) => {
      if (!known.has(observation.sourceId)) {
        // THE provenance rule. A fact with no source in this profile is not a
        // fact we can defend, so it is not a fact we will return.
        fail(`profile.facts.${field}[${i}].sourceId`, "does not match any source in this profile");
      }
    });
  }

  return facts;
}

function boundedLimitations(value: unknown): string[] {
  const limitations = list(value, "profile.limitations", (v, f) =>
    str(v, f, PROFILE_LIMITS.limitationLength),
  );
  if (limitations.length > PROFILE_LIMITS.limitationCount) {
    fail("profile.limitations", `lists more than the ${PROFILE_LIMITS.limitationCount} entries allowed`);
  }
  return limitations;
}

/** Validate a whole profile document. */
export function toProfileDocument(value: unknown): Pick<
  BusinessProfile,
  "sources" | "facts" | "coverage" | "limitations"
> {
  const doc = obj(value, "profile");

  const sources = list(doc.sources, "profile.sources", toSource);
  if (sources.length > PROFILE_LIMITS.sourcesPerProfile) {
    fail("profile.sources", `lists more than the ${PROFILE_LIMITS.sourcesPerProfile} sources a run allows`);
  }
  const ids = new Set(sources.map((s) => s.id));
  if (ids.size !== sources.length) fail("profile.sources", "contains duplicate source ids");

  const coverage = list(doc.coverage, "profile.coverage", toCoverage);
  const areas = new Set(coverage.map((c) => c.area));
  if (areas.size !== coverage.length) fail("profile.coverage", "reports an area more than once");
  for (const area of AREAS) {
    if (!areas.has(area)) fail("profile.coverage", `does not report the "${area}" area`);
  }

  return {
    sources,
    facts: toProfileFacts(doc.facts, sources),
    coverage,
    limitations: boundedLimitations(doc.limitations),
  };
}

/** Database row -> BusinessProfile. Throws on anything malformed. */
export function rowToBusinessProfile(row: BusinessProfileRow): BusinessProfile {
  if (row.status !== "complete") fail("status", "is not a valid BusinessProfileStatus");

  return {
    id: str(row.id, "id"),
    leadId: str(row.lead_id, "lead_id"),
    status: row.status as BusinessProfileStatus,
    createdAt: str(row.created_at, "created_at"),
    updatedAt: str(row.updated_at, "updated_at"),
    researcher: {
      name: str(row.researcher_name, "researcher_name"),
      version: str(row.researcher_version, "researcher_version"),
    },
    ...toProfileDocument(row.profile),
  };
}

/** Validate an assembled draft before it is ever persisted. */
export function assertValidProfileDraft(draft: BusinessProfileDraft): BusinessProfileDraft {
  return {
    researcher: {
      name: str(draft.researcher?.name, "researcher_name"),
      version: str(draft.researcher?.version, "researcher_version"),
    },
    ...toProfileDocument({
      sources: draft.sources,
      facts: draft.facts,
      coverage: draft.coverage,
      limitations: draft.limitations,
    }),
  };
}

/** BusinessProfile -> database row, ready to insert. */
export function businessProfileToRow(profile: BusinessProfile): BusinessProfileRow {
  return {
    id: profile.id,
    lead_id: profile.leadId,
    status: profile.status,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    researcher_name: profile.researcher.name,
    researcher_version: profile.researcher.version,
    // Identity, the lead reference and timestamps live in real columns, never
    // duplicated inside the document a researcher contributed to.
    profile: {
      sources: profile.sources,
      facts: profile.facts,
      coverage: profile.coverage,
      limitations: profile.limitations,
    },
  };
}
