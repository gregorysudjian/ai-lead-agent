import "server-only";

import { jsonLeadRepository } from "./json";
import type { LeadRepository } from "./types";

/**
 * Resolve the lead repository.
 *
 * One implementation today. When Supabase arrives this becomes a switch on an
 * env var, exactly like `getPlacesProvider()` -- and no caller changes, because
 * they all depend on `LeadRepository` rather than on a store.
 */
export function getLeadRepository(): LeadRepository {
  return jsonLeadRepository;
}

export { LeadRepositoryError } from "./types";
export type { LeadRepository, UpsertSummary } from "./types";
