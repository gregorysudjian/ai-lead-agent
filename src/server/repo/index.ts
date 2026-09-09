import "server-only";

import { leadRepositoryName } from "@/server/env";

import { InMemoryAnalysisTableGateway } from "./analysis-table";
import { createAnalysisRepository, supabaseAnalysisRepository } from "./analysis-supabase";
import type { AnalysisRepository } from "./analysis-types";
import { createDemoSiteRepository, supabaseDemoSiteRepository } from "./demo-supabase";
import { InMemoryDemoSiteTableGateway } from "./demo-table";
import type { DemoSiteRepository } from "./demo-types";
import { jsonLeadRepository } from "./json";
import { createOutreachRepository, supabaseOutreachRepository } from "./outreach-supabase";
import { InMemoryOutreachTableGateway } from "./outreach-table";
import type { OutreachRepository } from "./outreach-types";
import {
  createBusinessProfileRepository,
  supabaseBusinessProfileRepository,
} from "./profile-supabase";
import { InMemoryBusinessProfileTableGateway } from "./profile-table";
import type { BusinessProfileRepository } from "./profile-types";
import { supabaseLeadRepository } from "./supabase";
import type { LeadRepository } from "./types";
import { localDemoShareGateway } from "./share-gateway";
import { createDemoShareRepository, supabaseDemoShareRepository } from "./share-supabase";
import type { DemoShareRepository } from "./share-types";

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
/** Process-lifetime stores for the local (non-Supabase) configuration. */
const localAnalysisGateway = new InMemoryAnalysisTableGateway();
const localDemoSiteGateway = new InMemoryDemoSiteTableGateway();
const localBusinessProfileGateway = new InMemoryBusinessProfileTableGateway();
const localOutreachGateway = new InMemoryOutreachTableGateway();

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

/**
 * Resolve the analysis repository.
 *
 * Follows the same selector as leads: Supabase when selected, otherwise an
 * in-process store. The JSON lead store has no analysis file backing, so the
 * local path uses an in-memory gateway -- adequate for development, and
 * explicitly not durable.
 */
export function getAnalysisRepository(): AnalysisRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return createAnalysisRepository(localAnalysisGateway);
    case "supabase":
      return supabaseAnalysisRepository();
  }
}

export type { AnalysisRepository } from "./analysis-types";
export { AnalysisRepositoryError } from "./analysis-types";

/**
 * Resolve the demo-site repository.
 *
 * Same selector as leads and analyses. The JSON lead store has no demo file
 * backing, so the local path uses an in-memory gateway -- adequate for
 * development, and explicitly not durable.
 */
export function getDemoSiteRepository(): DemoSiteRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return createDemoSiteRepository(localDemoSiteGateway);
    case "supabase":
      return supabaseDemoSiteRepository();
  }
}

export type { DemoSiteRepository } from "./demo-types";
export { DemoSiteRepositoryError } from "./demo-types";

/**
 * Resolve the demo-share repository.
 *
 * Same selector as every other store. The JSON lead store has no share file
 * backing, so the local path uses an in-memory gateway -- adequate for
 * development, and explicitly not durable. That is a sharper limitation here
 * than elsewhere: a share issued against the local store stops working when
 * the dev server restarts.
 */
export function getDemoShareRepository(): DemoShareRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return createDemoShareRepository(localDemoShareGateway);
    case "supabase":
      return supabaseDemoShareRepository();
  }
}

export type { DemoShareRepository, CreateShareInput } from "./share-types";
export { DemoShareRepositoryError } from "./share-types";

/**
 * Resolve the business-profile repository.
 *
 * Same selector as every other store. The JSON lead store has no profile file
 * backing, so the local path uses an in-memory gateway -- adequate for
 * development, and explicitly not durable.
 */
export function getBusinessProfileRepository(): BusinessProfileRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return createBusinessProfileRepository(localBusinessProfileGateway);
    case "supabase":
      return supabaseBusinessProfileRepository();
  }
}

export type { BusinessProfileRepository } from "./profile-types";
export { BusinessProfileRepositoryError } from "./profile-types";

/**
 * Resolve the outreach repository.
 *
 * Same selector as every other store. The JSON lead store has no outreach file
 * backing, so the local path uses an in-memory gateway -- adequate for
 * development, and explicitly not durable.
 */
export function getOutreachRepository(): OutreachRepository {
  const name = leadRepositoryName();

  switch (name) {
    case "json":
      return createOutreachRepository(localOutreachGateway);
    case "supabase":
      return supabaseOutreachRepository();
  }
}

export type { OutreachRepository, OutreachUpdate } from "./outreach-types";
export { OutreachRepositoryError } from "./outreach-types";
