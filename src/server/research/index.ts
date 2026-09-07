import "server-only";

import { mockResearchProvider } from "./mock";
import type { ResearchProvider } from "./types";

/**
 * Resolve the configured researcher.
 *
 * One implementation exists today, so there is nothing to select between and
 * no environment variable to get wrong. The seam is here rather than in the
 * caller: when the first real source lands, this function grows a switch and
 * an env var, and nothing else in the application changes.
 *
 * Whatever replaces it must default to the offline researcher, so a missing
 * variable can never cause an outbound request.
 */
export function getResearchProvider(): ResearchProvider {
  return mockResearchProvider;
}

export { ResearchProviderError } from "./types";
export type { ResearchProvider, ResearchSource } from "./types";
