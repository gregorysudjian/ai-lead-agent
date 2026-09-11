import Link from "next/link";

import { DesignStrip } from "@/components/demo/design-strip";
import { UpgradeDemoButton } from "@/components/demo/upgrade-demo-button";
import { DIRECTIONS } from "@/lib/demo-design/directions";
import { groupDemosByLead } from "@/lib/demo-grouping";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";
import {
  Badge,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  ErrorPanel,
  LINK,
  PageHeader,
} from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { recentDemoSites } from "@/server/demo-service";
import { getDemoSiteProvider } from "@/server/demo";
import { loadLeads } from "@/server/leads-page-data";
import { GenerateDemoButton, type DemoCandidate } from "@/components/generate-demo-button";
import { requireSession } from "@/server/auth";

/**
 * Every stored demo site, newest first.
 *
 * A Server Component reading the repository directly. Each row shows enough to
 * find the right demo again -- the business, what shaped it, and when -- and
 * links to the internal preview and back to the lead it belongs to.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Demo Sites" };

export default async function DemosPage() {
  // The authorization boundary for this page. Proxy already redirected a
  // visitor with no cookie; this is the check that actually verifies one.
  await requireSession();
  let demos: Awaited<ReturnType<typeof recentDemoSites>> = [];
  let loadFailed = false;

  try {
    demos = await recentDemoSites();
  } catch (error) {
    console.error("[demos] could not read demo sites:", error);
    loadFailed = true;
  }

  // Businesses to offer in the picker. Read straight from the repository,
  // like every other Server Component here -- never by fetching our own API.
  const { leads } = await loadLeads("demos");
  const leadsWithDemos = new Set(demos.map((demo) => demo.leadId));
  const candidates: DemoCandidate[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.provider.name,
    category: lead.provider.category,
    city: lead.provider.city,
    hasDemo: leadsWithDemos.has(lead.id),
  }));

  const generator = getDemoSiteProvider();

  // One card per BUSINESS, not per generation. The store stays append-only --
  // a demo already shown to a prospect must never be rewritten -- but listing
  // every version flat made one salon look like two prospects.
  const groups = groupDemosByLead(demos);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Demo Sites"
          subtitle={
            loadFailed
              ? "Stored demo sites could not be loaded."
              : `${groups.length} ${groups.length === 1 ? "business" : "businesses"} with a demo. Previews are internal — nothing here is published or sent.`
          }
        />

        <GenerateDemoButton
          candidates={candidates}
          generator={{ name: generator.name, model: generator.model }}
        />
      </div>

      {loadFailed ? (
        <ErrorPanel
          title="Could not load demo sites."
          detail="The demo store did not respond. Check the server logs for details."
        />
      ) : demos.length === 0 ? (
        <EmptyState
          title="No demo sites yet"
          description="Open a lead, run an analysis, then generate a demo site from it. Each generation is one deliberate click."
          action={
            <Link href="/leads" className={BUTTON_SECONDARY}>
              Browse leads
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => {
            const demo = group.latest;
            const { business, design } = demo.spec;
            const olderVersions = group.versions.length - 1;
            return (
              <Card as="li" key={demo.id} className="flex flex-col p-5">
                <DesignStrip name={business.name} design={design} />

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                      {business.name}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">
                      {business.category} · {business.city}
                    </p>
                  </div>
                  {design ? (
                    <Badge tone="emerald">New design</Badge>
                  ) : (
                    <Badge tone="amber" title="Generated before the new design generator; update it to get a new site.">
                      Old design
                    </Badge>
                  )}
                </div>

                {/* One readable line each: how it looks, and when it was made. */}
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  {design
                    ? `${DIRECTIONS[design.direction].label} style · ${demo.spec.alternates?.fr ? "French and English" : "English"}`
                    : `${DEMO_THEME_LABELS[demo.spec.content.theme]} theme · English`}
                </p>
                <p className="mt-1 mb-5 text-xs text-slate-500 dark:text-slate-400">
                  Generated <Timestamp iso={demo.createdAt} />
                  {olderVersions > 0
                    ? // The history is kept, just not given its own card.
                      ` · ${olderVersions} earlier ${olderVersions === 1 ? "version" : "versions"}`
                    : ""}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <Link href={`/demos/${demo.id}`} className={design ? BUTTON_PRIMARY : BUTTON_SECONDARY}>
                    Open preview
                  </Link>
                  {design ? null : <UpgradeDemoButton leadId={demo.leadId} analysisId={demo.analysisId} />}
                  <Link href={`/leads/${demo.leadId}`} className={`ml-auto text-sm ${LINK}`}>
                    View lead
                  </Link>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
