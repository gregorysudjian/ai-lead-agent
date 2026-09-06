/**
 * The analysis contract.
 *
 * The application depends on this interface, never on a concrete analyser, so a
 * real model can replace the mock without touching the workflow, the repository
 * or the UI.
 *
 * Types only, no runtime code, so no `server-only` guard is needed here.
 */
import type { AnalysisProviderInput, AnalysisProviderResult } from "@/lib/analysis";

export interface AnalysisProvider {
  /** Identifies the implementation in stored records and in the UI. */
  readonly name: string;
  /** Model identifier, or a ruleset version for a deterministic analyser. */
  readonly model: string;

  /**
   * Produce website-strategy recommendations for one business.
   *
   * Receives a SANITIZED input, not the Lead: no internal ids, no contact
   * values, no timestamps. Returns recommendations, assumptions and limitations
   * ONLY -- provider facts are derived by application code and merged
   * afterwards, so an analyser has no way to assert one.
   *
   * Throws on failure; callers report that rather than storing a partial run.
   */
  analyse(input: AnalysisProviderInput): Promise<AnalysisProviderResult>;
}

/** The analyser could not produce a usable result. */
export class AnalysisProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnalysisProviderError";
  }
}
