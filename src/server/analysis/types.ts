/**
 * The analysis contract.
 *
 * The application depends on this interface, never on a concrete analyser, so a
 * real model can replace the mock without touching the workflow, the repository
 * or the UI.
 *
 * Types only, no runtime code, so no `server-only` guard is needed here.
 */
import type { AnalysisDraft } from "@/lib/analysis";
import type { Lead } from "@/lib/types";

export interface AnalysisProvider {
  /** Identifies the implementation in stored records and in the UI. */
  readonly name: string;
  /** Model identifier, or a ruleset version for a deterministic analyser. */
  readonly model: string;

  /**
   * Produce a website-strategy draft for one lead.
   *
   * Receives the whole Lead so it can read the provider snapshot, and must not
   * mutate it. Returns a draft without identity or timestamps -- the repository
   * assigns those.
   *
   * Throws on failure; callers report that rather than storing a partial run.
   */
  analyse(lead: Lead): Promise<AnalysisDraft>;
}

/** The analyser could not produce a usable result. */
export class AnalysisProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnalysisProviderError";
  }
}
