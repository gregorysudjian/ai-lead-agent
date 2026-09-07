import "server-only";

import { researchProviderName, websiteLookupName } from "@/server/env";

import { mockResearchProvider } from "./mock";
import { createResearchOrchestrator } from "./orchestrator";
import type { ResearchProvider } from "./types";
import { WEBSITE_SOURCE_VERSION, createWebsiteResearchSource } from "./website";
import { createGoogleWebsiteLocator, noWebsiteLocator } from "./website-locator";

/**
 * Resolve the configured researcher.
 *
 * Defaults to the offline researcher. Selecting `website` is what enables real
 * outbound requests, and there is deliberately NO fallback in the other
 * direction: if website research is configured and fails, the failure is
 * reported. Silently substituting the offline researcher would record a
 * profile that says "not researched" when a run had in fact been attempted and
 * gone wrong, which is a different and misleading thing.
 */
export function getResearchProvider(): ResearchProvider {
  const name = researchProviderName();

  switch (name) {
    case "mock":
      return mockResearchProvider;
    case "website":
      return createResearchOrchestrator({
        name: "website",
        version: WEBSITE_SOURCE_VERSION,
        sources: [createWebsiteResearchSource({ locateWebsite: websiteLocator() })],
      });
  }
}

/**
 * How a missing website address is found, if at all.
 *
 * Defaults to not looking. Enabling the Google locator is a separate,
 * deliberate act because it is a billable per-lead request -- and because it is
 * the one place a third-party directory touches the research path at all.
 */
function websiteLocator() {
  return websiteLookupName() === "google" ? createGoogleWebsiteLocator() : noWebsiteLocator;
}

export { ResearchProviderError } from "./types";
export type { ResearchProvider, ResearchSource } from "./types";
