import { LeadsSection } from "@/components/leads-section";
import { SearchPanel } from "@/components/search-panel";
import type { Lead } from "@/lib/types";
import { getLeadRepository } from "@/server/repo";

/**
 * Dashboard.
 *
 * A Server Component. It reads the repository directly rather than fetching its
 * own API over HTTP -- that would be a pointless network round trip to the same
 * process, and it keeps the repository abstraction as the single data path.
 *
 * `force-dynamic` because it reads a data store: without it Next can prerender
 * this at build time, baking a stale lead list into the build.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let leads: Lead[] = [];
  let loadError = false;

  try {
    leads = await getLeadRepository().list();
  } catch (error) {
    // Never surface the message: it contains a filesystem path.
    console.error("[dashboard] could not read lead store:", error);
    loadError = true;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Business Lead Finder</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Discover local businesses and review potential website leads.
        </p>
      </header>

      <div className="mt-8">
        <SearchPanel />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          Could not load stored leads. Check the server logs for details.
        </p>
      ) : (
        <LeadsSection leads={leads} />
      )}
    </main>
  );
}
