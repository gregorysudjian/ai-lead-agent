/**
 * The business-discovery contract.
 *
 * Everything else in the application depends on THIS interface, never on a
 * concrete provider. Phase 1 ships one implementation (mock); Phase 5 adds
 * GooglePlacesProvider behind the same shape and nothing upstream changes.
 *
 * No server-only import here on purpose: this file declares types only and
 * emits no runtime code. The modules that actually load providers or touch
 * secrets carry the guard instead.
 */
import type { BusinessSearchQuery, DiscoveredBusiness } from "@/lib/types";

export interface PlacesProvider {
  /** Identifies the implementation in logs and responses. */
  readonly name: string;

  /**
   * Find businesses matching a category and city.
   *
   * Returns an empty array when nothing matches -- an unknown city is a normal
   * outcome, not an error. Reserve exceptions for genuine failures (a network
   * fault, a bad API key), which callers must not leak to the client.
   *
   * Async even though the mock resolves immediately: real providers are network
   * calls, and baking that into the contract now means the call sites written in
   * Phase 1 keep working unchanged in Phase 5.
   */
  search(query: BusinessSearchQuery): Promise<DiscoveredBusiness[]>;
}
