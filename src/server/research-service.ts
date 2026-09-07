import "server-only";

import type {
  BusinessProfile,
  ObservationDraft,
  ProfileFacts,
  ResearchArea,
  ResearchCoverage,
  ResearchProviderResult,
  SourceRecord,
} from "@/lib/business-profile";
import {
  LEAD_SNAPSHOT_SOURCE_ID,
  PROFILE_FIELDS,
  RESEARCH_AREA_LABELS,
  emptyProfileFacts,
} from "@/lib/business-profile";
import {
  deriveLeadObservations,
  deriveLeadSnapshotSource,
  toResearchInput,
} from "@/lib/profile-facts";
import { getResearchProvider } from "@/server/research";
import { ResearchProviderError } from "@/server/research/types";
import { getBusinessProfileRepository, getLeadRepository } from "@/server/repo";

import { LeadNotFoundError } from "./service-errors";

/**
 * Research one lead and persist the resulting business profile.
 *
 * The business rule lives here rather than in the route handler, so a future
 * CLI or batch job can reuse it without going through HTTP.
 *
 * The lead is loaded from the DATABASE. A caller supplies an identity only --
 * which lead to research. Nothing about the business may be passed in.
 *
 * ── WHAT THE RESEARCHER CANNOT DO ─────────────────────────────────────────
 *
 * It cannot set the profile id, the lead id, the timestamps or the researcher
 * name: those are written here, from the provider OBJECT rather than from its
 * output. It cannot cite the reserved `lead-snapshot` source, so it cannot
 * attribute an invention to our own stored record. And every observation it
 * returns must name one of the sources it also returned, or the run fails --
 * checked here, and again by the repository before anything is written.
 */

export { LeadNotFoundError } from "./service-errors";

const AREAS = Object.keys(RESEARCH_AREA_LABELS) as ResearchArea[];

/**
 * Fill in coverage for the areas the researcher did not report on.
 *
 * A researcher reports what IT did. Areas it stayed out of are covered by the
 * stored discovery record or by nothing at all, and application code is the
 * honest author of that statement. An area with lead-derived facts reads as
 * covered by the snapshot; an area with none reads as not researched -- never
 * as "the business does not have this".
 */
export function mergeCoverage(
  reported: ResearchCoverage[],
  leadObservations: ObservationDraft[],
): ResearchCoverage[] {
  const byArea = new Map(reported.map((c) => [c.area, c]));
  const fromSnapshot = new Set(leadObservations.map((o) => PROFILE_FIELDS[o.field].area));

  return AREAS.map((area) => {
    const provided = byArea.get(area);
    if (provided) return provided;

    return fromSnapshot.has(area)
      ? {
          area,
          status: "covered" as const,
          note: "From the stored discovery record only. No other source was consulted.",
        }
      : {
          area,
          status: "not-researched" as const,
          note: "Nothing was consulted for this area, and the discovery record held nothing.",
        };
  });
}

/** File a flat list of observation drafts into the fact set. */
function fileObservations(drafts: ObservationDraft[]): ProfileFacts {
  const facts = emptyProfileFacts();
  for (const draft of drafts) {
    facts[draft.field].push({
      value: draft.value,
      sourceId: draft.sourceId,
      kind: draft.kind,
    });
  }
  return facts;
}

/** Reject provider output that cannot be filed honestly. */
function assertUsable(result: ResearchProviderResult, leadSource: SourceRecord): void {
  const ids = new Set<string>();

  for (const source of result.sources) {
    if (source.id === leadSource.id) {
      // Citing our own stored record would let a researcher attribute anything
      // it liked to a source it never read.
      throw new ResearchProviderError(
        `A researcher may not use the reserved source id "${LEAD_SNAPSHOT_SOURCE_ID}".`,
      );
    }
    if (ids.has(source.id)) {
      throw new ResearchProviderError("A researcher returned duplicate source ids.");
    }
    ids.add(source.id);
  }

  for (const observation of result.observations) {
    if (observation.sourceId === leadSource.id) {
      throw new ResearchProviderError(
        "A researcher may not attribute an observation to the stored discovery record.",
      );
    }
    if (!ids.has(observation.sourceId)) {
      throw new ResearchProviderError(
        "A researcher returned an observation with no matching source.",
      );
    }
  }
}

export async function researchLead(leadId: string): Promise<BusinessProfile> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  // FACT OWNERSHIP. What the lead already tells us becomes attributed
  // observations here, by deterministic application code, before any
  // researcher is consulted.
  const leadSource = deriveLeadSnapshotSource(lead);
  const leadObservations = deriveLeadObservations(lead);

  const researcher = getResearchProvider();

  // Researcher errors and unusable output both surface as exceptions; nothing
  // partial is persisted.
  const result = await researcher.research(toResearchInput(lead));
  assertUsable(result, leadSource);

  return getBusinessProfileRepository().create(lead.id, {
    // Read from the researcher itself, never from its output -- it cannot
    // claim to be a different researcher.
    researcher: { name: researcher.name, version: researcher.version },
    sources: [leadSource, ...result.sources],
    facts: fileObservations([...leadObservations, ...result.observations]),
    coverage: mergeCoverage(result.coverage, leadObservations),
    limitations: result.limitations,
  });
}

/** Business profiles for a lead, newest first. */
export async function profilesForLead(leadId: string): Promise<BusinessProfile[]> {
  return getBusinessProfileRepository().listForLead(leadId);
}
