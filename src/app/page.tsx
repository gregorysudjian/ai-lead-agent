import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import {
  CategoryBreakdown,
  LeadSummary,
  PriorityDistribution,
} from "@/components/lead-summary";
import { SystemStatus } from "@/components/system-status";
import {
  BUTTON_PRIMARY,
  Card,
  EmptyState,
  ErrorPanel,
  FOCUS_RING,
  INPUT,
  LINK,
  LoadingRegion,
  PageHeader,
  SectionHeading,
  Skeleton,
  StatTile,
} from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { catalogHref, DEFAULT_QUERY } from "@/lib/catalog/search";
import { CATALOG_TRADE_KEYS, TRADE_PLURALS } from "@/lib/catalog/trades";
import { requireSession } from "@/server/auth";
import { catalogPage } from "@/server/catalog-service";
import { loadLeads } from "@/server/leads-page-data";

/**
 * Dashboard.
 *
 * Two halves, deliberately in this order. The business catalog -- everything
 * on the island we might approach -- and then the leads: the businesses the
 * operator actually chose. Searching never adds a lead; that was the old
 * behaviour, and it is what this page used to get wrong.
 *
 * Each half streams in behind its own Suspense boundary, so the page shell
 * paints at once and a slow or failing store takes down only its own half.
 *
 * `force-dynamic` because both halves read stores.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

const n = (value: number) => value.toLocaleString("en-CA");

export default async function DashboardPage() {
  // The authorization boundary for this page.
  await requireSession();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Local hair and beauty businesses in Montreal, and the ones you have chosen to approach."
      />

      <SystemStatus />

      <Suspense fallback={<CatalogOverviewSkeleton />}>
        <CatalogOverview />
      </Suspense>

      <section aria-labelledby="leads-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="leads-heading" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Your leads
          </h2>
          <Link href="/leads" className={`text-sm ${LINK}`}>
            Open the lead list →
          </Link>
        </div>
        <Suspense fallback={<LeadsOverviewSkeleton />}>
          <LeadsOverview />
        </Suspense>
      </section>
    </div>
  );
}

/** The catalog's entry point: a search box, the trades, and the headline numbers. */
async function CatalogOverview() {
  let page;
  try {
    page = await catalogPage(DEFAULT_QUERY);
  } catch (error) {
    console.error("[dashboard] could not read the catalog:", error);
    return (
      <ErrorPanel
        title="Could not load the business database."
        detail="On a new installation this usually means its migrations have not been applied yet. The server log names the cause."
      />
    );
  }

  const { summary, tradeCounts, releases } = page.result;
  const hasHistory =
    releases.latest !== null && releases.baseline !== null && releases.latest !== releases.baseline;

  return (
    <Card as="section" className="p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="Find businesses"
          hint="Every hair and beauty business on the island of Montreal, kept up to date from Overture Maps. Adding one to your leads is always your choice."
        />
        {page.lastRefresh ? (
          <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
            Updated <Timestamp iso={page.lastRefresh.finishedAt ?? page.lastRefresh.startedAt} />
          </p>
        ) : null}
      </div>

      {summary.total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="The business database is empty"
            description="Run the catalog extract and load (see the README). After that it refreshes itself every month."
          />
        </div>
      ) : (
        <>
          {/* A plain GET form: works before hydration, and `next/form` turns
              it into a client-side navigation once it has. */}
          <Form action="/businesses" className="mt-4 flex gap-2">
            <label htmlFor="dashboard-q" className="sr-only">
              Search businesses
            </label>
            <input
              id="dashboard-q"
              name="q"
              type="search"
              placeholder="Business name, street or neighbourhood"
              autoComplete="off"
              maxLength={100}
              className={INPUT}
            />
            <button type="submit" className={BUTTON_PRIMARY}>
              Search
            </button>
          </Form>

          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Browse by trade">
            {CATALOG_TRADE_KEYS.map((key) => (
              <li key={key}>
                <Link
                  href={catalogHref(DEFAULT_QUERY, { trade: key })}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                >
                  {TRADE_PLURALS[key]}
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {n(tradeCounts[key] ?? 0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="On the island" value={n(summary.current)} />
            <StatTile
              label="No website listed"
              value={n(summary.noWebsite)}
              tone="amber"
              hint="Or only a social page"
            />
            <StatTile
              label="New this month"
              value={hasHistory ? n(summary.newInLatest) : "—"}
              hint={hasHistory ? undefined : "After the next update"}
            />
            <StatTile label="In your leads" value={n(summary.inLeads)} tone="emerald" />
          </dl>

          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={catalogHref(DEFAULT_QUERY, { noWebsite: true, leads: "hide" })} className={LINK}>
              Businesses with no website listed, not yet in your leads →
            </Link>
            {hasHistory && summary.newInLatest > 0 ? (
              <Link href={catalogHref(DEFAULT_QUERY, { fresh: true })} className={LINK}>
                {n(summary.newInLatest)} new this month →
              </Link>
            ) : null}
          </p>
        </>
      )}
    </Card>
  );
}

/** The leads half: only businesses the operator chose. */
async function LeadsOverview() {
  const { leads, loadFailed } = await loadLeads("dashboard");

  if (loadFailed) {
    return (
      <ErrorPanel
        title="Could not load stored leads."
        detail="The lead store did not respond. Check the server logs for details."
      />
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Find a business above and choose Add to leads. Nothing is contacted automatically — every lead is reviewed by you."
      />
    );
  }

  return (
    <div className="space-y-6">
      <LeadSummary leads={leads} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading
            title="Priority distribution"
            hint="Derived from the current provider snapshots. Never stored."
          />
          <div className="mt-4">
            <PriorityDistribution leads={leads} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Leads by category" hint="Top categories among your leads." />
          <div className="mt-4">
            <CategoryBreakdown leads={leads} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function CatalogOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading the business database…">
      <Card className="space-y-4 p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, tile) => (
            <Skeleton key={tile} className="h-[5.5rem]" />
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}

function LeadsOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading lead totals…">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, tile) => (
          <Skeleton key={tile} className="h-[5.5rem]" />
        ))}
      </dl>
    </LoadingRegion>
  );
}
