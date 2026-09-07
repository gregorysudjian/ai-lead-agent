/**
 * Business profile: what we have actually LEARNED about one business.
 *
 * The fourth domain object, and the one the rest of the pipeline is meant to
 * grow into:
 *
 *   Lead ──▶ BusinessProfile ──▶ Analysis ──▶ DemoSite
 *
 * Today analysis and demo generation each start from the lead snapshot. The
 * intent is that research happens ONCE, produces a sourced profile, and every
 * later specialist reads that instead of independently going and looking. This
 * phase builds the record and the seam; Phase 9B migrates the consumers.
 *
 * A lead may be researched many times. Each run is its own immutable profile,
 * so what we believed in March stays readable in June.
 *
 * ── THE CENTRAL RULE ──────────────────────────────────────────────────────
 *
 * A profile holds FACTS, and every fact names its source.
 *
 * That is enforced by the shape rather than by discipline: there is no field
 * anywhere that holds a bare value. A fact is an `Observation`, and an
 * observation without a `sourceId` resolving to a `SourceRecord` in the same
 * profile fails validation and is never stored. So "where did we learn this?"
 * always has an answer, for every value, without anyone having to remember to
 * record one.
 *
 * ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
 *
 * There is no representation for an inference. `ObservationKind` has exactly
 * two members -- a source stated it, or we observed it -- and no third. A
 * researcher that concluded "premium salon", "popular", "family-owned" or
 * "excellent service" has nowhere to put it. Opinions belong in `Analysis`,
 * which is explicitly a proposal; a profile is evidence.
 *
 * ── CONFLICTS ARE KEPT, NOT RESOLVED AWAY ─────────────────────────────────
 *
 * Every field holds a LIST of observations. Two sources giving different phone
 * numbers produce two observations, both stored, both attributable. Reading a
 * single preferred value is a separate, pure operation (`resolveField`) that
 * returns the conflicting evidence alongside its choice. Nothing overwrites
 * anything.
 */
import type { BusinessSource } from "./types";

/** Only completed runs are persisted; a failure is reported, not stored. */
export type BusinessProfileStatus = "complete";

/**
 * Where a fact came from.
 *
 * `lead-snapshot` is our own stored discovery record. The rest name research
 * sources that do not exist yet -- the type is declared now so a profile
 * written today stays readable once they do.
 */
export type SourceType =
  | "lead-snapshot"
  | "website"
  | "directory"
  | "social"
  | "reviews";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  "lead-snapshot": "Stored discovery record",
  website: "The business's own website",
  directory: "Public directory",
  social: "Public social profile",
  reviews: "Review source",
};

/**
 * Source precedence, most authoritative first.
 *
 * A business's own website is the best statement about itself; a third-party
 * index is the weakest, because it is a copy of something else. This ordering
 * decides which observation `resolveField` PREFERS -- it never decides which
 * observations are kept, because all of them are.
 */
export const SOURCE_PRECEDENCE: readonly SourceType[] = [
  "website",
  "directory",
  "social",
  "reviews",
  "lead-snapshot",
];

/** The reserved id of the source application code always writes. */
export const LEAD_SNAPSHOT_SOURCE_ID = "lead-snapshot";

export interface SourceRecord {
  /** Unique within one profile. Observations reference this. */
  id: string;
  type: SourceType;
  /**
   * What was consulted: an absolute http(s) URL for a web source, or a
   * provider reference such as "osm:node/123" for the stored snapshot.
   */
  reference: string;
  /** ISO-8601. When this source was read. */
  fetchedAt: string;
  /** Page or record title, when the source carried one. */
  title: string | null;
}

/**
 * How a source carried a fact.
 *
 * `stated`   the source says it in its own words -- a services list on the
 *            business's own site, opening hours it publishes.
 * `observed` we read it out of a record or a page structure -- a phone number
 *            in a directory entry, a link in the page markup.
 *
 * There is no `inferred`. That omission is the point.
 */
export type ObservationKind = "stated" | "observed";

export type ProfileValue = string | number | boolean;

export interface Observation {
  value: ProfileValue;
  /** Must match a SourceRecord.id in the same profile. Validated on read. */
  sourceId: string;
  kind: ObservationKind;
}

/**
 * The closed set of things a profile can record.
 *
 * A flat, dotted key set rather than a nested tree: it keeps the stored shape
 * stable, makes every field uniformly a list of observations, and means adding
 * a field later is additive. Grouping for display is a UI concern, driven by
 * `PROFILE_FIELDS[field].area`.
 */
export type ProfileField =
  | "identity.name"
  | "identity.category"
  | "identity.city"
  | "contact.phone"
  | "contact.address"
  | "contact.email"
  | "web.website"
  | "web.reachable"
  | "web.pageTitle"
  | "web.description"
  | "web.socialLink"
  | "web.bookingUrl"
  | "business.service"
  | "business.openingHours"
  | "business.description"
  | "reputation.rating"
  | "reputation.reviewCount";

/** The areas a research run reports coverage for. */
export type ResearchArea = "identity" | "contact" | "web" | "business" | "reputation";

export const RESEARCH_AREA_LABELS: Record<ResearchArea, string> = {
  identity: "Identity",
  contact: "Contact",
  web: "Web presence",
  business: "Publicly stated details",
  reputation: "Reputation",
};

export interface ProfileFieldSpec {
  area: ResearchArea;
  label: string;
  type: "string" | "number" | "boolean";
  /** True when the value must be an absolute http(s) URL. */
  url?: true;
  /** True when several distinct values are expected rather than a conflict. */
  multiple?: true;
}

/**
 * Field definitions, including the value type each must carry.
 *
 * The validator checks values against these, so a researcher cannot store a
 * page title where a rating belongs, or a `javascript:` string where a URL is
 * expected.
 */
export const PROFILE_FIELDS: Record<ProfileField, ProfileFieldSpec> = {
  "identity.name": { area: "identity", label: "Business name", type: "string" },
  "identity.category": { area: "identity", label: "Category", type: "string" },
  "identity.city": { area: "identity", label: "City", type: "string" },

  "contact.phone": { area: "contact", label: "Phone", type: "string" },
  "contact.address": { area: "contact", label: "Address", type: "string" },
  "contact.email": { area: "contact", label: "Email", type: "string" },

  "web.website": { area: "web", label: "Website", type: "string", url: true },
  "web.reachable": { area: "web", label: "Website responded", type: "boolean" },
  "web.pageTitle": { area: "web", label: "Page title", type: "string" },
  "web.description": { area: "web", label: "Page description", type: "string" },
  "web.socialLink": {
    area: "web",
    label: "Public social link",
    type: "string",
    url: true,
    multiple: true,
  },
  "web.bookingUrl": { area: "web", label: "Booking link", type: "string", url: true },

  "business.service": {
    area: "business",
    label: "Publicly stated service",
    type: "string",
    multiple: true,
  },
  "business.openingHours": {
    area: "business",
    label: "Publicly stated opening hours",
    type: "string",
    multiple: true,
  },
  "business.description": { area: "business", label: "Publicly stated description", type: "string" },

  "reputation.rating": { area: "reputation", label: "Rating", type: "number" },
  "reputation.reviewCount": { area: "reputation", label: "Review count", type: "number" },
};

export const PROFILE_FIELD_LIST = Object.keys(PROFILE_FIELDS) as ProfileField[];

/**
 * Every field, always present, holding zero or more observations.
 *
 * An empty list means "no source gave us this". Whether anyone LOOKED is a
 * different question, answered by `coverage` -- conflating the two would let an
 * unresearched field read as a confirmed absence.
 */
export type ProfileFacts = Record<ProfileField, Observation[]>;

export type ResearchAreaStatus =
  /** A source was consulted and whatever it held is recorded. */
  | "covered"
  /** Nothing was consulted for this area in this run. */
  | "not-researched"
  /** A source was tried and could not be used. */
  | "unavailable";

export const RESEARCH_AREA_STATUS_LABELS: Record<ResearchAreaStatus, string> = {
  covered: "Researched",
  "not-researched": "Not researched",
  unavailable: "Unavailable",
};

export interface ResearchCoverage {
  area: ResearchArea;
  status: ResearchAreaStatus;
  /** Why, in one plain sentence. Always present, including when covered. */
  note: string;
}

/** Which researcher produced this, so an old profile stays interpretable. */
export interface ResearcherInfo {
  /** Implementation name, e.g. "mock". */
  name: string;
  /** Ruleset or adapter version. */
  version: string;
}

export interface BusinessProfile {
  id: string;
  /** The lead researched. Never embeds the lead. */
  leadId: string;
  status: BusinessProfileStatus;
  createdAt: string;
  updatedAt: string;
  researcher: ResearcherInfo;
  /** Every source consulted. Observations reference these by id. */
  sources: SourceRecord[];
  facts: ProfileFacts;
  coverage: ResearchCoverage[];
  /** What this run could not establish. */
  limitations: string[];
}

/** What the service assembles before the repository assigns identity and time. */
export type BusinessProfileDraft = Pick<
  BusinessProfile,
  "researcher" | "sources" | "facts" | "coverage" | "limitations"
>;

/**
 * One observation a researcher proposes, before application code files it.
 *
 * Flat, and the field is a closed enum, so a researcher can neither invent a
 * fact category nor decide the shape of the stored document. `sourceId` must
 * name one of the sources the same researcher returned.
 */
export interface ObservationDraft {
  field: ProfileField;
  value: ProfileValue;
  sourceId: string;
  kind: ObservationKind;
}

/**
 * Everything a researcher is permitted to RETURN.
 *
 * Note what is absent: no profile id, no lead id, no timestamps, no researcher
 * identity. Those are application-owned, exactly as with analyses and demo
 * sites, so a researcher cannot claim to be something it is not or attach its
 * findings to a different business.
 */
export interface ResearchProviderResult {
  sources: SourceRecord[];
  observations: ObservationDraft[];
  coverage: ResearchCoverage[];
  limitations: string[];
}

/**
 * Everything a researcher RECEIVES.
 *
 * The stored snapshot's own values, because a researcher legitimately needs
 * the name to search for and the website to fetch. Nothing that identifies the
 * record in our systems: no internal id, no provider external id, no database
 * metadata.
 *
 * Every string here is UNTRUSTED provider data, and anything a researcher
 * later fetches is more untrusted still.
 */
export interface ResearchProviderInput {
  businessName: string;
  category: string;
  city: string;
  /** Human-readable source label, not an internal enum. */
  sourceLabel: string;
  phone: string | null;
  address: string | null;
  /** The website the discovery provider listed, if any. Not yet verified. */
  website: string | null;
}

/** One field's preferred value plus the evidence that disagrees with it. */
export interface ResolvedField {
  observation: Observation;
  source: SourceRecord;
  /** Observations carrying a DIFFERENT value. Never discarded. */
  conflicting: Observation[];
}

/**
 * Choose the preferred observation for one field, deterministically.
 *
 * Order: source precedence, then the more recent fetch, then source id. The
 * last tiebreak exists so the result never depends on array order.
 *
 * This is a READ operation. It picks nothing to keep and nothing to drop; the
 * stored profile is unchanged, and `conflicting` hands the caller everything
 * that disagreed so a UI can show it rather than hide it.
 */
export function resolveField(
  facts: ProfileFacts,
  field: ProfileField,
  sources: SourceRecord[],
): ResolvedField | null {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const usable = facts[field].filter((o) => byId.has(o.sourceId));
  if (usable.length === 0) return null;

  const rank = (o: Observation) => {
    const source = byId.get(o.sourceId) as SourceRecord;
    const precedence = SOURCE_PRECEDENCE.indexOf(source.type);
    return precedence === -1 ? SOURCE_PRECEDENCE.length : precedence;
  };

  const sorted = [...usable].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;

    const sa = byId.get(a.sourceId) as SourceRecord;
    const sb = byId.get(b.sourceId) as SourceRecord;
    const byRecency = sb.fetchedAt.localeCompare(sa.fetchedAt);
    if (byRecency !== 0) return byRecency;

    return sa.id.localeCompare(sb.id);
  });

  const [preferred, ...rest] = sorted;
  return {
    observation: preferred,
    source: byId.get(preferred.sourceId) as SourceRecord,
    conflicting: rest.filter((o) => o.value !== preferred.value),
  };
}

/** Every distinct value recorded for a field, in resolution order. */
export function allValues(
  facts: ProfileFacts,
  field: ProfileField,
  sources: SourceRecord[],
): Observation[] {
  const resolved = resolveField(facts, field, sources);
  if (!resolved) return [];
  return [resolved.observation, ...resolved.conflicting];
}

/** An empty fact set with every field present. */
export function emptyProfileFacts(): ProfileFacts {
  return Object.fromEntries(
    PROFILE_FIELD_LIST.map((f) => [f, [] as Observation[]]),
  ) as unknown as ProfileFacts;
}

/** Human-readable label for a discovery source, for a SourceRecord reference. */
export function leadSnapshotReference(source: BusinessSource, externalId: string): string {
  return `${source}:${externalId}`;
}
