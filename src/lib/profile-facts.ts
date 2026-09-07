/**
 * The single source of truth for the facts APPLICATION CODE contributes to a
 * business profile.
 *
 * Pure and deterministic. Everything a lead already told us becomes an
 * observation attributed to the stored discovery record, written here rather
 * than by a researcher -- so even a researcher that returned nothing produces
 * a profile whose lead-derived facts are correct and correctly attributed.
 *
 * A researcher adds evidence on top. It cannot alter, contradict-by-overwrite
 * or remove any of this, because the two sets are concatenated and every
 * observation keeps its own `sourceId`.
 */
import type {
  ObservationDraft,
  ProfileField,
  ResearchProviderInput,
  SourceRecord,
} from "./business-profile";
import { LEAD_SNAPSHOT_SOURCE_ID, leadSnapshotReference } from "./business-profile";
import { isUsableRating, isUsableReviewCount, isUsableText } from "./scoring";
import type { Lead } from "./types";

/** Human-readable source labels. Internal enum values never reach a researcher. */
const SOURCE_LABELS: Record<string, string> = {
  mock: "Mock fixture data",
  osm: "OpenStreetMap",
  google: "Google Places",
};

/**
 * The source record for what we already hold.
 *
 * `fetchedAt` is the snapshot's own timestamp, not now: the claim being made
 * is "the discovery provider said this when we fetched it", and back-dating it
 * to the research run would overstate how fresh the evidence is.
 */
export function deriveLeadSnapshotSource(lead: Lead): SourceRecord {
  const p = lead.provider;
  return {
    id: LEAD_SNAPSHOT_SOURCE_ID,
    type: "lead-snapshot",
    reference: leadSnapshotReference(p.source, p.externalId),
    // Normalized so a snapshot stored with a non-canonical but valid ISO form
    // still satisfies the profile's strict timestamp rule. An unparseable
    // value is left as-is and rejected at validation, which is correct: a
    // source that cannot date its own evidence should not be stored.
    fetchedAt: normalizeTimestamp(p.fetchedAt),
    title: SOURCE_LABELS[p.source] ?? p.source,
  };
}

function normalizeTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/**
 * Everything the stored snapshot tells us, as attributed observations.
 *
 * `kind` is always `observed`: we read these out of a third party's record.
 * The business did not state them to us, and a directory entry is not the
 * business speaking. A website source is where `stated` will start appearing.
 *
 * A field the provider left empty produces NO observation. Silence is not an
 * observation that something is absent -- `coverage` reports what was looked
 * at, and that distinction is the whole reason both exist.
 */
export function deriveLeadObservations(lead: Lead): ObservationDraft[] {
  const p = lead.provider;
  const observations: ObservationDraft[] = [];

  const add = (field: ProfileField, value: string | number | boolean) =>
    observations.push({ field, value, sourceId: LEAD_SNAPSHOT_SOURCE_ID, kind: "observed" });

  add("identity.name", p.name);
  add("identity.category", p.category);
  add("identity.city", p.city);

  if (isUsableText(p.phone)) add("contact.phone", (p.phone as string).trim());
  if (isUsableText(p.address)) add("contact.address", (p.address as string).trim());

  // The listed website is recorded as an observation of what the provider
  // listed. It is NOT recorded as reachable: nothing has fetched it, and
  // `web.reachable` stays empty until something does.
  if (isUsableText(p.website)) add("web.website", (p.website as string).trim());

  // Reputation only when the provider actually carried usable values. The same
  // validity predicates the scoring rubric uses, so a rating that scores zero
  // cannot enter a profile as a fact.
  if (isUsableRating(p.rating)) add("reputation.rating", p.rating as number);
  if (isUsableReviewCount(p.reviewCount)) add("reputation.reviewCount", p.reviewCount as number);

  return observations;
}

/**
 * Reduce a lead to what a researcher may see.
 *
 * Contact VALUES are included here, unlike the analysis input: a researcher
 * legitimately needs the name to look up and the website to fetch, and a
 * phone number is a key a directory can be matched on. What it never receives
 * is anything identifying the record in OUR systems -- no internal id, no
 * provider external id, no status, no application timestamps.
 */
export function toResearchInput(lead: Lead): ResearchProviderInput {
  const p = lead.provider;
  return {
    businessName: p.name,
    category: p.category,
    city: p.city,
    sourceLabel: SOURCE_LABELS[p.source] ?? p.source,
    phone: isUsableText(p.phone) ? (p.phone as string).trim() : null,
    address: isUsableText(p.address) ? (p.address as string).trim() : null,
    website: isUsableText(p.website) ? (p.website as string).trim() : null,
  };
}
