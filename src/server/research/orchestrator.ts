import "server-only";

import type {
  ObservationDraft,
  ResearchCoverage,
  ResearchProviderInput,
  ResearchProviderResult,
  SourceRecord,
} from "@/lib/business-profile";

import type { ResearchProvider, ResearchSource } from "./types";

/**
 * Combines specialist sources into one research result.
 *
 * The provider owns nothing but the combining. Each source is responsible for
 * one kind of evidence, returns its own sources and observations, and cannot
 * see or alter another's -- so adding a directory or review adapter later is
 * additive, and one adapter's failure degrades a run rather than failing it.
 *
 * The stored discovery record is NOT a source here. It is contributed by
 * application code in the research service, before any of this runs, so its
 * facts exist even when every source is disabled or broken.
 */

export interface OrchestratorOptions {
  name: string;
  version: string;
  sources: readonly ResearchSource[];
}

/**
 * A source that throws does not fail the run.
 *
 * It reports `unavailable` for its own area and the run continues. A specialist
 * crashing is a fact about our code, not about the business, and it should not
 * cost the operator the evidence the other sources did gather.
 */
async function gatherSafely(
  source: ResearchSource,
  input: ResearchProviderInput,
): Promise<ResearchProviderResult> {
  try {
    return await source.gather(input);
  } catch (error) {
    console.error(`[research] source "${source.name}" failed:`, error);
    return {
      sources: [],
      observations: [],
      coverage: [
        {
          area: source.area,
          status: "unavailable",
          note: "This research source could not be run.",
        },
      ],
      limitations: [`The ${source.name} research source failed, so its area was not covered.`],
    };
  }
}

export function createResearchOrchestrator(options: OrchestratorOptions): ResearchProvider {
  return {
    name: options.name,
    version: options.version,

    async research(input: ResearchProviderInput): Promise<ResearchProviderResult> {
      const sources: SourceRecord[] = [];
      const observations: ObservationDraft[] = [];
      const coverage: ResearchCoverage[] = [];
      const limitations: string[] = [];

      // Sequential, not parallel: a research run should be a small, orderly
      // number of requests, not a burst aimed at one business at once.
      for (const source of options.sources) {
        const result = await gatherSafely(source, input);
        sources.push(...result.sources);
        observations.push(...result.observations);
        coverage.push(...result.coverage);
        limitations.push(...result.limitations);
      }

      return { sources, observations, coverage, limitations };
    },
  };
}
