import "server-only";

import { mockAnalysisProvider } from "./mock";
import type { AnalysisProvider } from "./types";

/**
 * Resolve the configured analyser.
 *
 * One implementation today. A real model provider will be selected here by an
 * env var, exactly like the places provider -- and no caller changes, because
 * they all depend on `AnalysisProvider`.
 */
export function getAnalysisProvider(): AnalysisProvider {
  return mockAnalysisProvider;
}

export { AnalysisProviderError } from "./types";
export type { AnalysisProvider } from "./types";
