/**
 * The demo-site generation contract.
 *
 * The application depends on this interface, never on a concrete generator, so
 * a model-backed generator can replace the mock without touching the workflow,
 * the repository or the renderer.
 *
 * Types only, no runtime code, so no `server-only` guard is needed here.
 */
import type { DemoSiteGeneratorInput, DemoSiteGeneratorResult } from "@/lib/demo-site";

export interface DemoSiteProvider {
  /** Identifies the implementation in stored records and in the UI. */
  readonly name: string;
  /** Model identifier, or a ruleset version for a deterministic generator. */
  readonly model: string;

  /**
   * Produce the presentation content for one demo site.
   *
   * Receives a SANITIZED input, not the Lead or the Analysis: no internal ids,
   * no contact values, no timestamps. Returns wording, structure and a theme
   * ONLY -- business facts are derived by application code and merged into the
   * spec afterwards, so a generator has no way to assert one.
   *
   * Throws on failure; callers report that rather than storing a partial demo.
   */
  generate(input: DemoSiteGeneratorInput): Promise<DemoSiteGeneratorResult>;
}

/** The generator could not produce a usable result. */
export class DemoSiteProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DemoSiteProviderError";
  }
}
