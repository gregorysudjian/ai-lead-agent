import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { PriorityBadge } from "@/components/lead-row";
import { LeadCounts, PriorityDistribution } from "@/components/lead-summary";
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
} from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { catalogHref, DEFAULT_QUERY } from "@/lib/catalog/search";
import { CATALOG_TRADE_KEYS, TRADE_PLURALS } from "@/lib/catalog/trades";
import { rankLeads } from "@/lib/scoring";
import { requireSession } from "@/server/auth";
import { catalogPage } from "@/server/catalog-service";
import { loadLeads } from "@/server/leads-page-data";

/**
 * Dashboard: what to do next, then where to find more.
 *
 * The page opens on the work -- the new leads, highest priority first -- and
 * then the way into the catalog. The catalog's full numbers live on the
 * Businesses page; here they are one line. Which stores and providers this
 * instance is wired to is a footer: worth seeing, never the first thing.
 *
 * Each half streams in behind its own Suspense boundary, so the page shell
 * paints at once and a slow or failing store takes down only its own half.
 * Searching never adds a lead; a lead is only ever an explicit Add.
 *
 * `force-dynamic` because both halves read stores.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

/** How many new leads "Next up" lists before pointing at the full list. */
const NEXT_UP_LIMIT = 5;

const n = (value: number) => value.toLocaleString("en-CA");

export default async function DashboardPage() {
  // The authorization boundary for this page.
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Hair and beauty businesses in Montreal, and the ones you chose to approach."
      />

      <Suspense fallback={<LeadsOverviewSkeleton />}>
        <LeadsOverview />
      </Suspense>

      <Suspense fallback={<CatalogOverviewSkeleton />}>
        <CatalogOverview />
      </Suspense>

      <footer className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <SystemStatus />
      </footer>
    </div>
  );
}

/** The work: new leads worth opening first, and the lead list at a glance. */
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
        description="Find a business below and choose Add to leads. Nothing is contacted automatically — every lead is reviewed by you."
      />
    );
  }

  const fresh = rankLeads(leads.filter((lead) => lead.status === "new"));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card as="section" className="p-5 lg:col-span-2">
        <SectionHeading
          title="Next up"
          hint={
            fresh.length > 0
              ? "Your new leads, highest priority first."
              : "Every lead has been reviewed."
          }
        />
        {fresh.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Nothing waiting. Find more businesses below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {fresh.slice(0, NEXT_UP_LIMIT).map(({ lead, score }) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className={`group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">
                      {lead.provider.name}
                    </span>
                    <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
                      {lead.provider.category} · {lead.provider.city}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <PriorityBadge score={score} />
                    <span aria-hidden="true" className="text-slate-400">
                      &rarr;
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {fresh.length > NEXT_UP_LIMIT ? (
          <p className="mt-3 text-sm">
            <Link href="/leads" className={LINK}>
              All {fresh.length} new leads &rarr;
            </Link>
          </p>
        ) : null}
      </Card>

      <Card as="section" className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <SectionHeading title={`Your leads (${leads.length})`} />
          <Link href="/leads" className={`text-sm ${LINK}`}>
            Open &rarr;
          </Link>
        </div>
        <div className="mt-4">
          <LeadCounts leads={leads} />
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">Priority</h3>
          <div className="mt-2">
            <PriorityDistribution leads={leads} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** The catalog's entry point: a search box, the trades, and one line of numbers. */
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
    <Card as="section" className="p-5">
      <SectionHeading
        title="Find businesses"
        hint="Every hair and beauty business on the island, from Overture Maps. Adding one to your leads is always your choice."
      />

      {summary.total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="The business database is empty"
            description="Run the catalog extract and load (see the README). After that it keeps itself up to date."
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
                  className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 ${FOCUS_RING}`}
                >
                  {TRADE_PLURALS[key]}
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {n(tradeCounts[key] ?? 0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span>{n(summary.current)} businesses on the island ·</span>
            <Link href={catalogHref(DEFAULT_QUERY, { noWebsite: true, leads: "hide" })} className={LINK}>
              {n(summary.noWebsite)} with no website listed
            </Link>
            {hasHistory && summary.newInLatest > 0 ? (
              <>
                <span>·</span>
                <Link href={catalogHref(DEFAULT_QUERY, { fresh: true })} className={LINK}>
                  {n(summary.newInLatest)} new this month
                </Link>
              </>
            ) : null}
            {page.lastRefresh ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                · updated <Timestamp iso={page.lastRefresh.finishedAt ?? page.lastRefresh.startedAt} />
              </span>
            ) : null}
          </p>
        </>
      )}
    </Card>
  );
}

function CatalogOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading the business database…">
      <Card className="space-y-4 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10" />
        <Skeleton className="h-4 w-72" />
      </Card>
    </LoadingRegion>
  );
}

function LeadsOverviewSkeleton() {
  return (
    <LoadingRegion label="Loading your leads…">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </LoadingRegion>
  );
}
