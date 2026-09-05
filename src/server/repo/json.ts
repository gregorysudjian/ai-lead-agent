import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { findExistingLead } from "@/lib/dedupe";
import type { DiscoveredBusiness, Lead } from "@/lib/types";
import { LeadRepositoryError, type LeadRepository, type UpsertSummary } from "./types";

/**
 * DEVELOPMENT-ONLY lead store backed by a single JSON file.
 *
 * This is scaffolding, not production persistence. It has no transactions, no
 * cross-process locking, and no integrity guarantees, and on Vercel the
 * filesystem is ephemeral so writes would vanish. It exists so the pipeline can
 * be built and inspected by eye before a real database is introduced. Lead data
 * must move to Postgres/Supabase before anything is deployed.
 *
 * Guarded with `server-only`: nothing here may reach browser code.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

/** Versioned envelope so the file shape can change later without guesswork. */
interface StoreFile {
  version: 1;
  leads: Lead[];
}

const EMPTY_STORE: StoreFile = { version: 1, leads: [] };

/**
 * Serializes all access in this process.
 *
 * Every operation is read-modify-write, so two concurrent requests could
 * otherwise both read the same file and the second would clobber the first.
 * Chaining onto a single promise makes that impossible within one process. It
 * does NOT protect against a second process -- another reason this store is
 * development-only.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  // Keep the chain alive regardless of outcome, without swallowing the error.
  queue = result.catch(() => undefined);
  return result;
}

/** Read the store, creating an empty one the first time. */
async function readStore(): Promise<StoreFile> {
  let raw: string;
  try {
    raw = await fs.readFile(DATA_FILE, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...EMPTY_STORE, leads: [] };
    }
    throw new LeadRepositoryError(`Could not read lead store at ${DATA_FILE}`, {
      cause: error,
    });
  }

  // A new or truncated file is an empty store, not a failure.
  if (raw.trim().length === 0) return { ...EMPTY_STORE, leads: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // Refuse to continue rather than overwrite: a later write would destroy
    // whatever is actually in there. Surfacing this forces a human to look.
    throw new LeadRepositoryError(
      `Lead store at ${DATA_FILE} is not valid JSON. Refusing to overwrite it.`,
      { cause: error },
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as StoreFile).leads)
  ) {
    throw new LeadRepositoryError(
      `Lead store at ${DATA_FILE} has an unexpected shape. Refusing to overwrite it.`,
    );
  }

  return { version: 1, leads: (parsed as StoreFile).leads };
}

/**
 * Write the store atomically: full content to a temp file, then rename over the
 * target. A crash mid-write leaves the previous file intact instead of a
 * half-written one.
 */
async function writeStore(store: StoreFile): Promise<void> {
  const tempFile = `${DATA_FILE}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => undefined);
    throw new LeadRepositoryError(`Could not write lead store at ${DATA_FILE}`, {
      cause: error,
    });
  }
}

/** A brand-new lead from a first sighting. */
function createLead(business: DiscoveredBusiness, now: string): Lead {
  return {
    // Ours, generated once, never derived from externalId.
    id: randomUUID(),
    status: "new",
    createdAt: now,
    updatedAt: now,
    provider: business,
  };
}

/**
 * Refresh an existing lead from a newer discovery result.
 *
 * The whole `provider` subtree is replaced -- including `externalId` and
 * `source`, so a business re-listed under a new place ID keeps its lead and just
 * updates the reference. Everything we own is copied across untouched: `id`,
 * `createdAt` and `status` survive by construction.
 */
function refreshLead(existing: Lead, business: DiscoveredBusiness, now: string): Lead {
  return {
    id: existing.id,
    status: existing.status,
    createdAt: existing.createdAt,
    updatedAt: now,
    provider: business,
  };
}

class JsonLeadRepository implements LeadRepository {
  async list(): Promise<Lead[]> {
    return withLock(async () => (await readStore()).leads);
  }

  async findById(id: string): Promise<Lead | null> {
    return withLock(async () => {
      const store = await readStore();
      return store.leads.find((lead) => lead.id === id) ?? null;
    });
  }

  async upsertDiscovered(
    businesses: readonly DiscoveredBusiness[],
  ): Promise<UpsertSummary> {
    return withLock(async () => {
      const store = await readStore();
      const now = new Date().toISOString();

      // Working copy; matching runs against it as it grows, so two identical
      // businesses inside one batch collapse into a single lead.
      const leads = [...store.leads];
      const touched: Lead[] = [];
      let created = 0;
      let updated = 0;

      for (const business of businesses) {
        const match = findExistingLead(leads, business);

        if (match) {
          const refreshed = refreshLead(match.lead, business, now);
          leads[leads.indexOf(match.lead)] = refreshed;
          touched.push(refreshed);
          updated += 1;
        } else {
          const lead = createLead(business, now);
          leads.push(lead);
          touched.push(lead);
          created += 1;
        }
      }

      // Only write when something actually changed.
      if (created > 0 || updated > 0) {
        await writeStore({ version: 1, leads });
      }

      return { created, updated, leads: touched };
    });
  }
}

export const jsonLeadRepository: LeadRepository = new JsonLeadRepository();
