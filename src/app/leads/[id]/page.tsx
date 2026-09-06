import Link from "next/link";
import { notFound } from "next/navigation";

import { AnalysisPanel } from "@/components/analysis-panel";
import { OsmAttribution, SOURCE_LABELS } from "@/components/attribution";
import { PriorityBadge, StatusBadge } from "@/components/lead-row";
import { StatusToggle } from "@/components/status-toggle";
import {
  Badge,
  Card,
  LINK,
  SectionHeading,
} from "@/components/ui/primitives";
import {
  classifyWebsite,
  displayOrNotListed,
  formatOpeningHours,
  formatRating,
  formatReviewCount,
  formatTimestamp,
  UNLINKABLE_WEBSITE_LABEL,
  websiteLabel,
} from "@/lib/format";
import { osmObjectUrl } from "@/lib/osm/normalize";
import { MAX_SCORE, PRIORITY_LABELS, scoreLead } from "@/lib/scoring";
import type { OpeningHours } from "@/lib/types";
import { getAnalysisProvider } from "@/server/analysis";
import { analysesForLead } from "@/server/analysis-service";
import { getLeadRepository } from "@/server/repo";

/**
 * Lead detail: a review workspace.
 *
 * A Server Component reading the repository directly -- no HTTP call from the
 * server to its own API. Only the status control is a Client Component.
 */
export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadRepository().findById(id);
  } catch (error) {
    console.error(`[lead ${id}] could not read lead store:`, error);
    throw new Error("Could not load this lead.");
  }

  if (!lead) notFound();

  // Analyses are read here rather than fetched by the client, keeping the page
  // a Server Component. A read failure must not break the lead page itself.
  let analyses: Awaited<ReturnType<typeof analysesForLead>> = [];
  try {
    analyses = await analysesForLead(id);
  } catch (error) {
    console.error(`[lead ${id}] could not read analyses:`, error);
  }
  const analysisProviderIsMock = getAnalysisProvider().name === "mock";

  const { provider } = lead;
  const score = scoreLead(lead);
  const website = classifyWebsite(provider.website);
  const osmUrl = provider.source === "osm" ? osmObjectUrl(provider.externalId) : null;

  return (
    <div className="space-y-6">
      <Link href="/leads" className={`text-sm ${LINK}`}>
        &larr; Back to leads
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-slate-900 dark:text-slate-50">
            {provider.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="indigo">{provider.category}</Badge>
            <Badge tone="slate">{provider.city}</Badge>
            <StatusBadge status={lead.status} />
            <PriorityBadge score={score} />
          </div>
        </div>
        <div className="shrink-0">
          <StatusToggle leadId={lead.id} status={lead.status} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading
            title="Business overview"
            hint="Supplied by the discovery provider. A missing value means the provider did not list it, not that it does not exist."
          />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business name" value={provider.name} />
            <Field label="Category" value={provider.category} />
            <Field label="City" value={provider.city} />
            <Field label="Rating" value={formatRating(provider.rating)} />
            <Field label="Reviews" value={formatReviewCount(provider.reviewCount)} />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Contact" hint="For manual outreach only." />
          <dl className="mt-4 space-y-4">
            <Field label="Phone" value={displayOrNotListed(provider.phone)} />
            <Field label="Address" value={displayOrNotListed(provider.address)} />
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            Nothing is contacted automatically. Any outreach is written and sent by you.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Web presence"
          hint="Only a valid absolute http(s) URL is made clickable."
        />
        <div className="mt-4">
          {website.kind === "none" ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {websiteLabel(provider.website)}
            </p>
          ) : null}

          {website.kind === "linkable" ? (
            <a
              href={website.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm break-all ${LINK}`}
            >
              {website.href}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}

          {website.kind === "unlinkable" ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {UNLINKABLE_WEBSITE_LABEL}
              {website.raw.length > 0 ? (
                <>
                  {": "}
                  <code className="font-mono text-xs break-all">{website.raw}</code>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </Card>

      <AnalysisPanel
        leadId={lead.id}
        analyses={analyses}
        providerIsMock={analysisProviderIsMock}
      />

      <Card className="p-5">
        <SectionHeading
          title="Lead priority"
          hint="This deterministic score orders leads for review using provider-listed website, phone, address and reputation signals. It is not a prediction of purchase intent, and not proof that a business lacks a website."
        />
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Lead priority breakdown by factor</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-800">
              <th scope="col" className="py-2 font-medium">Factor</th>
              <th scope="col" className="py-2 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {score.factors.map((factor) => (
              <tr key={factor.key} className="border-b border-slate-100 dark:border-slate-800/60">
                <td className="py-2.5 pr-3">
                  <span className="font-medium">{factor.label}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                    {factor.reason}
                  </span>
                </td>
                <td className="py-2.5 text-right align-top tabular-nums whitespace-nowrap">
                  +{factor.points} / {factor.maxPoints}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2.5 text-left font-semibold">
                Total
                <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">
                  {PRIORITY_LABELS[score.priority]}
                </span>
              </th>
              <td className="py-2.5 text-right align-top font-semibold tabular-nums">
                {score.total} / {MAX_SCORE}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading
            title="Provider &amp; source"
            hint="Refreshed on every search. Replaced wholesale on rediscovery."
          />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Source" value={SOURCE_LABELS[provider.source]} />
            <Field label="External ID" value={provider.externalId} mono />
            <Field label="Fetched" value={formatTimestamp(provider.fetchedAt)} />
          </dl>

          {osmUrl ? (
            <p className="mt-4 text-sm">
              <a href={osmUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                View on OpenStreetMap
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          ) : null}

          <h3 className="mt-6 text-sm font-semibold">Opening hours</h3>
          {provider.source === "osm" && provider.openingHours === null ? (
            // Do not say "Not listed": OpenStreetMap may well carry hours for
            // this business. We simply do not import them yet, and claiming the
            // provider listed nothing would misreport the data.
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Opening hours are not imported from OpenStreetMap in this version.
            </p>
          ) : (
            <OpeningHoursTable hours={provider.openingHours} />
          )}

          {provider.source === "osm" ? <OsmAttribution className="mt-6" /> : null}
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="Lead record"
            hint="Owned by this application. Survives every rediscovery."
          />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Internal lead ID" value={lead.id} mono />
            <Field label="Status" value={lead.status} />
            <Field label="Created" value={formatTimestamp(lead.createdAt)} />
            <Field label="Last updated" value={formatTimestamp(lead.updatedAt)} />
          </dl>

          <p className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            Status is the only field you can change, using the control at the top of this
            page. Provider data is refreshed by search.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm break-words ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function OpeningHoursTable({ hours }: { hours: OpeningHours | null }) {
  // null = the provider told us nothing. An empty array = it told us there are
  // no published hours. Those are different facts and are shown differently.
  if (hours === null) {
    return <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Not listed</p>;
  }

  if (hours.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Provider listed no opening hours for any day.
      </p>
    );
  }

  return (
    <table className="mt-2 w-full max-w-sm text-sm">
      <caption className="sr-only">Opening hours by day</caption>
      <tbody>
        {formatOpeningHours(hours).map((row) => (
          <tr key={row.day} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
            <th scope="row" className="py-1.5 text-left font-normal text-slate-600 dark:text-slate-400">
              {row.day}
            </th>
            <td className="py-1.5 text-right tabular-nums">{row.hours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
