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

// ---------------------------------------------------------------------------
// Batch research
// ---------------------------------------------------------------------------

/**
 * Research several leads in one deliberate, bounded run.
 *
 * ── WHY THIS IS NOT A CRAWLER ─────────────────────────────────────────────
 *
 * Every constraint here exists because a research run reaches a real business's
 * server, and one of the lookups behind it is billable:
 *
 *   - it runs ONLY when a person asks; nothing schedules it
 *   - it is capped, and the cap is small enough to be surveyable
 *   - leads are researched SEQUENTIALLY, with a pause between them, so we are
 *     never several requests deep into other people's infrastructure at once
 *   - it skips leads that already have a profile, so re-running costs nothing
 *     and is not a way to re-fetch the same sites repeatedly
 *   - a lead that fails is recorded and SKIPPED. There is no retry: a site that
 *     timed out is not more likely to answer immediately afterwards, and a
 *     failed billable lookup repeated is just a bill
 *
 * Each profile is written as it is produced, so an interrupted run keeps
 * everything it had already learned.
 */

/** The most leads one run may touch. Deliberately small. */
export const MAX_BATCH_SIZE = 25;

/** Pause between leads. Politeness, not rate-limit evasion. */
const DEFAULT_DELAY_MS = 1000;

export interface BatchResearchOutcome {
  leadId: string;
  name: string;
  status: "researched" | "failed";
  /** Client-safe. Never an upstream message. */
  note: string;
}

export interface BatchResearchResult {
  requested: number;
  attempted: number;
  researched: number;
  failed: number;
  /** Leads with no profile that this run did not reach, because of the cap. */
  remaining: number;
  outcomes: BatchResearchOutcome[];
}

export interface BatchResearchOptions {
  delayMs?: number;
  /** Test seam. Production waits for real time. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function researchLeadsWithoutProfiles(
  limit: number,
  options: BatchResearchOptions = {},
): Promise<BatchResearchResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }

  const sleep = options.sleep ?? realSleep;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  const leads = await getLeadRepository().list();

  // One read to learn which leads already have a profile, rather than a query
  // per lead. The limit is generous enough to cover every profile we hold.
  const existing = await getBusinessProfileRepository().listRecent(1000);
  const researched = new Set(existing.map((profile) => profile.leadId));

  const pending = leads.filter((lead) => !researched.has(lead.id));
  const batch = pending.slice(0, limit);

  const outcomes: BatchResearchOutcome[] = [];

  for (const [index, lead] of batch.entries()) {
    if (index > 0) await sleep(delayMs);

    try {
      await researchLead(lead.id);
      outcomes.push({
        leadId: lead.id,
        name: lead.provider.name,
        status: "researched",
        note: "Researched.",
      });
    } catch (error) {
      // Detail to the server log; the outcome carries our own sentence.
      console.error(`[research batch] lead ${lead.id} failed:`, error);
      outcomes.push({
        leadId: lead.id,
        name: lead.provider.name,
        status: "failed",
        // No retry, and the run continues: one bad site must not cost the
        // operator the leads that would have worked.
        note: "This lead could not be researched. It was skipped, not retried.",
      });
    }
  }

  return {
    requested: limit,
    attempted: batch.length,
    researched: outcomes.filter((o) => o.status === "researched").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    remaining: pending.length - batch.length,
    outcomes,
  };
}
