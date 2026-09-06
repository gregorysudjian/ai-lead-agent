import "server-only";

import { mockDemoSiteProvider } from "./mock";
import type { DemoSiteProvider } from "./types";

/**
 * Resolve the demo-site generator.
 *
 * One implementation exists today, so there is nothing to select between and
 * no environment variable to get wrong. The seam is here rather than in the
 * caller: when a model-backed generator is added, this function grows a switch
 * and an env var, and nothing else in the application changes.
 */
export function getDemoSiteProvider(): DemoSiteProvider {
  return mockDemoSiteProvider;
}

export { DemoSiteProviderError } from "./types";
export type { DemoSiteProvider } from "./types";
