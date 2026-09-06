import "server-only";

import type { Lead } from "@/lib/types";
import { getLeadRepository } from "@/server/repo";

/**
 * Load leads for a page render.
 *
 * Both pages read the repository directly rather than fetching their own API
 * over HTTP. A failure is returned rather than thrown so the page can show a
 * truthful error panel instead of a blank or misleading empty state.
 */
export interface LeadsPageData {
  leads: Lead[];
  loadFailed: boolean;
}

export async function loadLeads(context: string): Promise<LeadsPageData> {
  try {
    return { leads: await getLeadRepository().list(), loadFailed: false };
  } catch (error) {
    // Never surface the message: it can contain a filesystem path or DB detail.
    console.error(`[${context}] could not read lead store:`, error);
    return { leads: [], loadFailed: true };
  }
}
