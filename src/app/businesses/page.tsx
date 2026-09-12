import Link from "next/link";

import { OvertureAttribution } from "@/components/attribution";
import { BusinessCard } from "@/components/catalog/business-card";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import {
  BUTTON_SECONDARY,
  EmptyState,
  ErrorPanel,
  PageHeader,
} from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { municipalityLabels } from "@/lib/catalog/area";
import { parseCatalogQuery, PAGE_SIZE } from "@/lib/catalog/search";
import { requireSession } from "@/server/auth";
import { CATALOG_AREA, catalogPage, type CatalogPage } from "@/server/catalog-service";

/**
 * The business catalog: every hair and beauty business on the island of
 * Montreal, searchable, and none of it a lead until someone chooses it.
 *
 * A Server Component. The URL is the whole state -- `parseCatalogQuery` reads
 * it leniently, the service searches the catalog in memory, and only the
 * requested page is sent to the browser. The toolbar and the Add buttons are
 * the only client code, and both change state only by asking the server.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Businesses" };

const n = (value: number) => value.toLocaleString("en-CA");

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The authorization boundary for this page.
  await requireSession();

  const query = parseCatalogQuery(await searchParams, CATALOG_AREA);

  let page: CatalogPage;
  try {
    page = await catalogPage(query);
  } catch (error) {
    console.error("[businesses] could not load the catalog:", error);
    return (
      <div className="space-y-6">
        <PageHeader title="Businesses" />
        <ErrorPanel
          title="Could not load the business database."
          detail="The catalog could not be read. On a new installation this usually means its two migrations have not been applied yet; the server log names the cause."
        />
      </div>
    );
  }

  const { result, lastRefresh, attention } = page;
  const { summary, releases } = result;
  const hasHistory =
    releases.latest !== null && releases.baseline !== null && releases.latest !== releases.baseline;

  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        subtitle={
          summary.total === 0
            ? "The business database is empty."
            : `${n(summary.current)} hair and beauty businesses on the island of Montreal. None of them is a lead until you add it.`
        }
        actions={
          <div className="flex items-center gap-4">
            {lastRefresh ? (
              <p className="text-xs text-slate-600 sm:text-right dark:text-slate-400">
                Updated <Timestamp iso={lastRefresh.finishedAt ?? lastRefresh.startedAt} />
                <br />
                <span className="text-slate-500 dark:text-slate-400">
                  Overture Maps release {lastRefresh.release}
                </span>
              </p>
            ) : null}
            <Link
              href="/demos/lab/grid"
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Design grid
            </Link>
          </div>
        }
      />

      {attention ? (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {attention.state === "running"
            ? `A refresh from Overture release ${attention.release} is in progress. Results may change when it finishes.`
            : `The most recent refresh (Overture release ${attention.release}) did not finish. The businesses below are from the last complete one.`}
        </p>
      ) : null}

      {summary.total === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="The catalog fills from Overture Maps. Run the extract and load scripts (see the README) to populate it; after that it refreshes itself every month."
        />
      ) : (
        <>
          {/* No stat tiles: every number they showed is one filter away
              below, with the count on the filter itself. */}
          <CatalogToolbar
            query={query}
            tradeCounts={result.tradeCounts}
            areaCounts={result.areaCounts}
            municipalities={municipalityLabels(CATALOG_AREA)}
            hasHistory={hasHistory}
            goneCount={summary.gone}
          />

          <section aria-labelledby="results-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="results-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {result.total === 0 ? (
                  "No businesses match"
                ) : (
                  <>
                    Showing <span className="tabular-nums">{n(from)}</span>–
                    <span className="tabular-nums">{n(to)}</span> of{" "}
                    <span className="tabular-nums">{n(result.total)}</span>
                  </>
                )}
              </h2>
              {query.sort === "priority" && result.total > 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Best prospects first: no website of their own, a phone and an address.
                </p>
              ) : null}
            </div>

            {result.total === 0 ? (
              <EmptyState
                title="Nothing matches these filters"
                description="Try a different trade or area, or clear the search."
                action={
                  <Link href="/businesses" className={BUTTON_SECONDARY}>
                    Clear all filters
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {result.results.map((item) => (
                  <BusinessCard key={item.business.id} item={item} />
                ))}
              </ul>
            )}

            <CatalogPagination query={query} page={result.page} pageCount={result.pageCount} />
          </section>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Everything here is what Overture Maps lists. &ldquo;No website listed&rdquo; means
              the data lists none, not that the business has none &mdash; the Google Maps link is
              there to check. Priority orders your review; it predicts nothing.
            </p>
            {summary.hiddenByGoogle > 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {n(summary.hiddenByGoogle)} more {summary.hiddenByGoogle === 1 ? "business is" : "businesses are"}{" "}
                hidden because a Google Maps check found no matching place, or found it permanently
                closed. They stay in the database, and each one&rsquo;s page says so.
              </p>
            ) : null}
            <OvertureAttribution />
          </div>
        </>
      )}
    </div>
  );
}
