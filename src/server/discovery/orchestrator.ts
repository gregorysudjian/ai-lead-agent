import "server-only";

import {
  compareCandidates,
  groupIntoCandidates,
  type CandidateObservation,
  type DiscoveryCandidate,
  type DiscoverySourceName,
} from "@/lib/discovery/candidates";
import { findExistingLead } from "@/lib/dedupe";
import type { Lead } from "@/lib/types";

import type {
  DiscoveryRequest,
  DiscoverySource,
  DiscoverySourceStatus,
} from "./types";
import { DiscoveryFailedError, DiscoverySourceError } from "./types";

/**
 * Runs several discovery sources and turns their answers into candidates.
 *
 * Knows nothing about OpenStreetMap, Google, HTTP or credentials. It is handed
 * a list of `DiscoverySource` and a list of leads, and everything it does is a
 * function of those -- which is what makes the whole layer testable without a
 * network and what makes "register another source" a one-line change.
 *
 * ── THE DATA BOUNDARY ─────────────────────────────────────────────────────
 *
 * This function WRITES NOTHING. It is a read of the world, not a change to it.
 * Candidates exist for the duration of one request and are then discarded; no
 * provider payload is stored, no lead is created, and no lead is touched. That
 * is what lets a Google-only result be shown at all: it is displayed under the
 * source that found it, and it stays a candidate until a verification and
 * promotion step -- which this phase does not build -- decides otherwise.
 *
 * The established search-and-save path for OpenStreetMap is untouched and still
 * lives in `lead-discovery.ts`. Discovery previews; that path persists.
 */

export interface DiscoveryRunResult {
  /** Ordered deterministically. See `compareCandidates` -- not a ranking. */
  candidates: DiscoveryCandidate[];
  /** One entry per source that was asked, whatever the outcome. */
  statuses: DiscoverySourceStatus[];
  /** True when ANY source reported reaching its cap. */
  truncated: boolean;
}

interface SourceOutcome {
  status: DiscoverySourceStatus;
  observations: CandidateObservation[];
}

/**
 * Ask one source, and convert any failure into a reported status.
 *
 * A source that throws does not fail the run. It reports its own failure and
 * the run continues, because the alternative -- discarding the results another
 * source did return -- makes one provider's outage look like the city being
 * empty. The failure is never silently rendered as zero results: it is a
 * distinct status the UI must show.
 */
async function askSource(
  source: DiscoverySource,
  request: DiscoveryRequest,
): Promise<SourceOutcome> {
  try {
    const result = await source.search(request);

    const observations = result.businesses.map((business) => ({
      source: source.name,
      externalId: business.externalId,
      business,
    }));

    return {
      status: {
        source: source.name,
        status: "ok",
        count: observations.length,
        truncated: result.meta.truncated,
        limit: result.meta.limit,
      },
      observations,
    };
  } catch (error) {
    // Detail stays in the server log; the status carries our own sentence.
    console.error(`[discovery] source "${source.name}" failed:`, error);

    const reason = error instanceof DiscoverySourceError ? error.reason : "unavailable";
    const message =
      error instanceof DiscoverySourceError
        ? error.message
        : "The source failed unexpectedly.";

    return {
      status: { source: source.name, status: "failed", reason, message },
      observations: [],
    };
  }
}

/**
 * Decide a candidate's state against our durable records.
 *
 * The EXISTING dedupe rules are authoritative -- `findExistingLead`, the same
 * function the repository uses when it decides whether to create a lead. A
 * second notion of "already a lead" living here would eventually disagree with
 * the one that actually governs writes, and the disagreement would show up as
 * a duplicate row.
 *
 * Every observation is checked, not just the displayed one: a Google record and
 * an OSM record in the same group can match different stored leads, and finding
 * either means we already have this business.
 */
function resolveState(
  candidate: ReturnType<typeof groupIntoCandidates>[number],
  leads: readonly Lead[],
  persistableSources: ReadonlySet<DiscoverySourceName>,
): Pick<DiscoveryCandidate, "state" | "existingLeadId"> {
  for (const observation of candidate.observations) {
    const match = findExistingLead(leads, observation.business);
    if (match) return { state: "in-leads", existingLeadId: match.lead.id };
  }

  const persistable = candidate.foundBy.some((source) => persistableSources.has(source));
  // Found only by a source we do not persist from. It stays a candidate: the
  // record would be Google content in our database with nothing having checked
  // it, which is the thing this phase deliberately does not do.
  return { state: persistable ? "can-add" : "candidate-only", existingLeadId: null };
}

export async function runDiscovery(
  request: DiscoveryRequest,
  sources: readonly DiscoverySource[],
  leads: readonly Lead[],
): Promise<DiscoveryRunResult> {
  if (sources.length === 0) {
    throw new DiscoveryFailedError("No discovery source is configured.", []);
  }

  // Sequential, not parallel. A discovery run should be a small, orderly number
  // of requests -- one of these sources is volunteer-run community
  // infrastructure and another is billed per call.
  const outcomes: SourceOutcome[] = [];
  for (const source of sources) {
    outcomes.push(await askSource(source, request));
  }

  const statuses = outcomes.map((outcome) => outcome.status);
  const succeeded = statuses.filter((status) => status.status === "ok");

  // Every source failed: there is nothing to show, and an empty list would read
  // as "no businesses here" rather than "we could not look".
  if (succeeded.length === 0) {
    throw new DiscoveryFailedError("Every discovery source failed.", statuses);
  }

  const persistableSources = new Set(
    sources.filter((source) => source.persistable).map((source) => source.name),
  );

  const observations = outcomes.flatMap((outcome) => outcome.observations);

  const candidates = groupIntoCandidates(observations)
    .map((candidate) => ({
      ...candidate,
      ...resolveState(candidate, leads, persistableSources),
    }))
    .sort(compareCandidates);

  return {
    candidates,
    statuses,
    truncated: statuses.some((status) => status.status === "ok" && status.truncated),
  };
}
