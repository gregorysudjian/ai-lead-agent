import Link from "next/link";

import { groupDemosByLead } from "@/lib/demo-grouping";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";
import { formatTimestamp } from "@/lib/format";
import {
  Badge,
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  ErrorPanel,
  LINK,
  PageHeader,
} from "@/components/ui/primitives";
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
              : `${groups.length} ${groups.length === 1 ? "business" : "businesses"} with a demo, from ${demos.length} ${demos.length === 1 ? "generation" : "generations"}. Previews are internal only — nothing here is published.`
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
            const { business, content } = demo.spec;
            const olderVersions = group.versions.length - 1;
            return (
              <Card as="li" key={demo.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                      {business.name}
                    </h2>
                    <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
                      {content.tagline}
                    </p>
                  </div>
                  <Badge tone="indigo">{DEMO_THEME_LABELS[content.theme]}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-500">Category</dt>
                    <dd className="mt-0.5 truncate">{business.category}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-500">City</dt>
                    <dd className="mt-0.5 truncate">{business.city}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-500">Generated</dt>
                    <dd className="mt-0.5">
                      {formatTimestamp(demo.createdAt)}
                      {olderVersions > 0 ? (
                        // The history is kept, just not given its own card.
                        <span className="text-slate-500 dark:text-slate-500">
                          {" "}
                          · {olderVersions} earlier{" "}
                          {olderVersions === 1 ? "version" : "versions"}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-500">Generator</dt>
                    <dd className="mt-0.5 truncate">
                      {demo.generator.name} ({demo.generator.model})
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 dark:text-slate-500">From analysis</dt>
                    <dd className="mt-0.5 font-mono text-[11px] break-all">{demo.analysisId}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <Link href={`/demos/${demo.id}`} className={BUTTON_SECONDARY}>
                    Open preview
                  </Link>
                  <Link href={`/leads/${demo.leadId}`} className={`text-sm ${LINK}`}>
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
