import "server-only";

import type { DiscoverySourceName } from "@/lib/discovery/candidates";
import {
  resolveSupportedCategory,
  supportedCategoryLabels,
} from "@/lib/osm/categories";
import { resolveSupportedCity, supportedCityLabels } from "@/lib/osm/cities";
import { getLeadRepository } from "@/server/repo";

import { configuredDiscoverySources, runDiscovery } from "./discovery";
import type { DiscoveryRunResult, DiscoverySource } from "./discovery";
import { DiscoveryValidationError } from "./discovery";

/**
 * The discovery application service.
 *
 * Owns everything the browser must not: which sources exist, which are enabled,
 * where the credentials live, how raw input becomes a safe query, and what the
 * lead store says. The route handler above it does HTTP and nothing else.
 *
 * WRITES NOTHING. A discovery run reads the lead store to mark what we already
 * have and then discards its candidates. The search-and-save path that persists
 * OpenStreetMap results is a separate service (`lead-discovery.ts`) and is
 * unchanged.
 */

export interface DiscoveryServiceInput {
  city: string;
  category: string;
  /**
   * Subset of the enabled sources to ask. Absent means "all enabled".
   *
   * A request may narrow the set; it can never widen it. Naming a source this
   * deployment has not enabled is rejected, so no client can turn on a billable
   * provider by asking nicely.
   */
  sources?: string[];
}

export interface DiscoveryServiceResult extends DiscoveryRunResult {
  query: { city: string; category: string };
  /** Every source this deployment allows, so the UI can render the choices. */
  availableSources: DiscoverySourceName[];
  /** The sources actually asked in this run. */
  requestedSources: DiscoverySourceName[];
}

/**
 * Narrow the enabled sources to those the caller asked for.
 *
 * Unknown or disabled names are rejected rather than ignored: silently dropping
 * one would run a different search from the one requested and report it as the
 * requested one.
 */
function selectSources(
  enabled: readonly DiscoverySource[],
  requested: string[] | undefined,
): DiscoverySource[] {
  const available = enabled.map((source) => source.name);
  if (requested === undefined) return [...enabled];

  const wanted = requested.map((name) => name.trim().toLowerCase());
  if (wanted.length === 0) {
    throw new DiscoveryValidationError("Select at least one discovery source.", {
      sources: available,
    });
  }

  const selected: DiscoverySource[] = [];
  for (const name of wanted) {
    const source = enabled.find((candidate) => candidate.name === name);
    if (!source) {
      throw new DiscoveryValidationError(
        "That discovery source is not enabled on this server.",
        { sources: available },
      );
    }
    if (!selected.includes(source)) selected.push(source);
  }
  return selected;
}

export async function discoverCandidates(
  input: DiscoveryServiceInput,
): Promise<DiscoveryServiceResult> {
  // Registry resolution happens HERE, once, before any source is dispatched.
  // Every adapter therefore receives canonical registry objects, and no
  // adapter can be handed the user's raw text to put into a query.
  const city = resolveSupportedCity(input.city);
  if (!city) {
    throw new DiscoveryValidationError(
      `Discovery does not support that city yet. Supported: ${supportedCityLabels().join(", ")}.`,
      { cities: supportedCityLabels() },
    );
  }

  const category = resolveSupportedCategory(input.category);
  if (!category) {
    throw new DiscoveryValidationError(
      `Discovery does not support that category yet. Supported: ${supportedCategoryLabels().join(", ")}.`,
      { categories: supportedCategoryLabels() },
    );
  }

  const enabled = configuredDiscoverySources();
  const sources = selectSources(enabled, input.sources);

  // Read once and pass it down: the orchestrator is a pure function of what it
  // is given, and one read is also one round trip rather than one per candidate.
  const leads = await getLeadRepository().list();

  const run = await runDiscovery({ city, category }, sources, leads);

  return {
    ...run,
    query: { city: city.label, category: category.label },
    availableSources: enabled.map((source) => source.name),
    requestedSources: sources.map((source) => source.name),
  };
}

/** Enabled source names, for a Server Component rendering the search form. */
export function availableDiscoverySources(): DiscoverySourceName[] {
  return configuredDiscoverySources().map((source) => source.name);
}
