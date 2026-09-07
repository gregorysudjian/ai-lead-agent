import "server-only";

import { demoProviderName } from "@/server/env";

import { anthropicDemoSiteProvider } from "./anthropic";
import { mockDemoSiteProvider } from "./mock";
import type { DemoSiteProvider } from "./types";

/**
 * Resolve the demo-site generator.
 *
 * Defaults to the deterministic mock, which makes no network call and costs
 * nothing -- so a missing or empty variable can never cause an accidental paid
 * request. Selecting Claude is a deliberate act.
 *
 * An unrecognised value throws rather than silently falling back, and there is
 * deliberately NO fallback from "anthropic" to "mock" on failure either. If the
 * app is configured for Claude and Claude fails, that is reported, not papered
 * over with fixture-quality copy presented as a generated site.
 */
export function getDemoSiteProvider(): DemoSiteProvider {
  const name = demoProviderName();

  switch (name) {
    case "mock":
      return mockDemoSiteProvider;
    case "anthropic":
      return anthropicDemoSiteProvider;
  }
}

export { DemoSiteProviderError } from "./types";
export type { DemoSiteProvider } from "./types";
