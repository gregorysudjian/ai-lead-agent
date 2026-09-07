/**
 * The research contract.
 *
 * The application depends on this interface, never on a concrete researcher,
 * so real sources can be added without touching the workflow, the repository
 * or the UI.
 *
 * Types only, no runtime code, so no `server-only` guard is needed here.
 */
import type { ResearchProviderInput, ResearchProviderResult } from "@/lib/business-profile";

export interface ResearchProvider {
  /** Identifies the implementation in stored profiles and in the UI. */
  readonly name: string;
  /** Ruleset or adapter version. */
  readonly version: string;

  /**
   * Gather evidence about one business.
   *
   * Receives a SANITIZED input, not the Lead: no internal ids, no database
   * metadata. Returns sources, observations, coverage and limitations ONLY --
   * the profile's identity, the lead it belongs to, its timestamps and the
   * researcher's own name are all set by application code afterwards.
   *
   * Throws on failure; callers report that rather than storing a partial run.
   */
  research(input: ResearchProviderInput): Promise<ResearchProviderResult>;
}

/**
 * One specialist source.
 *
 * The intended shape of the eventual orchestrator: several small adapters,
 * each responsible for one kind of evidence and each independently disablable,
 * combined by a `ResearchProvider` that owns nothing but the combining.
 *
 *   ResearchOrchestrator
 *     ├── lead snapshot        (application code, always present)
 *     ├── WebsiteResearchSource
 *     ├── PublicDirectoryResearchSource
 *     ├── SocialLinkResearchSource
 *     └── ReviewResearchSource
 *
 * Declaring it now is what keeps the first real adapter from being welded to
 * the provider: an adapter returns evidence for its own sources and nothing
 * else, and cannot see or overwrite another adapter's findings.
 *
 * A source that cannot run returns `unavailable` coverage rather than throwing,
 * so one dead adapter degrades a run instead of failing it.
 */
export interface ResearchSource {
  readonly name: string;
  readonly area: import("@/lib/business-profile").ResearchArea;
  gather(input: ResearchProviderInput): Promise<ResearchProviderResult>;
}

/** The researcher could not produce a usable result. */
export class ResearchProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ResearchProviderError";
  }
}
