import Link from "next/link";
import { Suspense } from "react";

import {
  CategoryBreakdown,
  LeadSummary,
  PriorityDistribution,
} from "@/components/lead-summary";
import { DiscoveryPanel } from "@/components/discovery-panel";
import { SearchPanel } from "@/components/search-panel";
import { SystemStatus } from "@/components/system-status";
import {
  Card,
  EmptyState,
  ErrorPanel,
  LINK,
  LoadingRegion,
  PageHeader,
  SectionHeading,
  Skeleton,
} from "@/components/ui/primitives";
import { availableDiscoverySources } from "@/server/discovery-service";
import { loadLeads } from "@/server/leads-page-data";
import { requireSession } from "@/server/auth";

/**
 * Dashboard.
 *
 * A Server Component. It reads the repository directly rather than fetching its
 * own API over HTTP -- that would be a pointless round trip to the same process.
 *
 * `force-dynamic` because it reads a data store: without it Next can prerender
 * this at build time, baking a stale lead list into the build.
 *
 * The lead read is behind a `Suspense` boundary rather than awaited up here.
 * The store read is the slow part of this page, and everything above it --
 * the configuration banner and the search form, which is what somebody
 * arriving here usually wants -- depends on none of it. Awaiting first made
 * the whole page wait for counts nobody had asked for yet.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // The authorization boundary for this page. Proxy already redirected a
  // visitor with no cookie; this is the check that actually verifies one.
  await requireSession();
  // Names only. Which sources are enabled is configuration, not a secret; the
  // credentials behind them never leave the server.
  const discoverySources = availableDiscoverySources();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Discover local businesses and review potential website leads."
      />

      <SystemStatus />

      <SearchPanel />

      <DiscoveryPanel availableSources={discoverySources} />

      <Suspense fallback={<LeadsOverviewSkeleton />}>
        <LeadsOverview />
      </Suspense>
    </div>
  );
}

/** The stored-lead half of the dashboard. Streams in behind its own boundary. */
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
        description="Run a search above to discover businesses. Nothing is contacted automatically — every lead is reviewed by you."
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
          <SectionHeading title="Leads by category" hint="Top categories discovered." />
          <div className="mt-4">
            <CategoryBreakdown leads={leads} />
          </div>
        </Card>
      </div>

      <p className="text-sm">
        <Link href="/leads" className={LINK}>
          Browse all {leads.length} leads →
        </Link>
      </p>
    </div>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </LoadingRegion>
  );
}
