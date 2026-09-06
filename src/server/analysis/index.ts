import "server-only";

import { analysisProviderName } from "@/server/env";

import { anthropicAnalysisProvider } from "./anthropic";
import { mockAnalysisProvider } from "./mock";
import type { AnalysisProvider } from "./types";

/**
 * Resolve the configured analyser.
 *
 * Defaults to the mock, so a missing variable can never trigger a paid call.
 * There is deliberately no fallback from anthropic to mock: if Claude is
 * selected and fails, the failure is reported rather than silently substituting
 * fixture-quality output.
 */
export function getAnalysisProvider(): AnalysisProvider {
  const name = analysisProviderName();

  switch (name) {
    case "mock":
      return mockAnalysisProvider;
    case "anthropic":
      return anthropicAnalysisProvider;
  }
}

export { AnalysisProviderError } from "./types";
export type { AnalysisProvider } from "./types";
