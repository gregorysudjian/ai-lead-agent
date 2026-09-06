import "server-only";

import { leadRepositoryName } from "@/server/env";

import { jsonLeadRepository } from "./json";
import { supabaseLeadRepository } from "./supabase";
import type { LeadRepository } from "./types";

/**
 * Resolve the lead repository.
 *
 * Defaults to the local JSON store. A missing or empty LEAD_REPOSITORY can
 * never cause an accidental connection to a real database -- selecting Supabase
 * has to be deliberate. An invalid value throws rather than falling back.
 *
 * No caller changes when the store changes: they all depend on the
 * `LeadRepository` interface rather than on an implementation.
 */
export function getLeadRepository(): LeadRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return jsonLeadRepository;
    case "supabase":
      return supabaseLeadRepository();
  }
}

export { LeadRepositoryError } from "./types";
export type { LeadRepository, UpsertSummary } from "./types";
