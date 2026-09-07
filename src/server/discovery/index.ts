import "server-only";

import type { DiscoverySourceName } from "@/lib/discovery/candidates";
import { discoverySourceNames } from "@/server/env";

import { googlePlacesSource } from "./google-source";
import { mockDiscoverySource, osmDiscoverySource } from "./places-sources";
import type { DiscoverySource } from "./types";

/**
 * The source registry.
 *
 * The ONE place that knows which adapters exist. Adding a directory or another
 * places API means writing an adapter, adding a line here and a name to the
 * environment allowlist -- the orchestrator, the service, the route and the UI
 * are all written against the interface and do not change.
 */
const REGISTRY: Record<DiscoverySourceName, DiscoverySource> = {
  osm: osmDiscoverySource,
  google: googlePlacesSource,
  mock: mockDiscoverySource,
};

/** Sources this deployment is configured to allow, in configured order. */
export function configuredDiscoverySources(): DiscoverySource[] {
  return discoverySourceNames().map((name) => REGISTRY[name]);
}

export { runDiscovery } from "./orchestrator";
export type { DiscoveryRunResult } from "./orchestrator";
export type {
  DiscoveryRequest,
  DiscoverySource,
  DiscoverySourceResult,
  DiscoverySourceStatus,
} from "./types";
export {
  DiscoveryFailedError,
  DiscoverySourceError,
  DiscoveryValidationError,
} from "./types";
