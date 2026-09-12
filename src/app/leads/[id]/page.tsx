import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AnalysisPanel } from "@/components/analysis-panel";
import { DemoPanel } from "@/components/demo-panel";
import { OutreachPanel } from "@/components/outreach-panel";
import { ResearchPanel } from "@/components/research-panel";
import { OsmAttribution, OvertureAttribution, SOURCE_LABELS } from "@/components/attribution";
import { PriorityBadge, StatusBadge } from "@/components/lead-row";
import { StatusToggle } from "@/components/status-toggle";
import { Card, Disclosure, LINK } from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { googleMapsSearchUrl } from "@/lib/catalog/maps-link";
import {
  classifyWebsite,
  formatOpeningHours,
  formatRating,
  formatReviewCount,
  NOT_LISTED,
  UNLINKABLE_WEBSITE_LABEL,
  websiteBadgeLabel,
} from "@/lib/format";
import { osmObjectUrl } from "@/lib/osm/normalize";
import { formatPhone, phoneHref } from "@/lib/phone";
import { MAX_SCORE, PRIORITY_LABELS, scoreLead } from "@/lib/scoring";
import type { OpeningHours } from "@/lib/types";
import { getAnalysisProvider } from "@/server/analysis";
import { analysesForLead } from "@/server/analysis-service";
import { getDemoSiteProvider } from "@/server/demo";
import { demoSitesForLead } from "@/server/demo-service";
import { getResearchProvider } from "@/server/research";
import { outreachForLead } from "@/server/outreach-service";
import { profilesForLead } from "@/server/research-service";
import { getLeadRepository } from "@/server/repo";
import { requireSession } from "@/server/auth";

/**
 * Lead detail: a review workspace.
 *
 * A Server Component reading the repository directly -- no HTTP call from the
 * server to its own API. Only the status control is a Client Component.
 *
 * The page reads top to bottom in the order the work happens: who they are
 * and what to do next, then Research -> Strategy -> Demo website -> Outreach.
 * Each listing fact appears once, in the header; the "blank means not listed"
 * caution is said once, under it. The bookkeeping -- the priority breakdown,
 * the provider record, the IDs -- is folded at the bottom, still in the page.
 */
export const dynamic = "force-dynamic";

/** What to do next, judged only from what exists -- never from a guess. */
function nextStep(state: {
  researched: boolean;
  analysed: boolean;
  hasDemo: boolean;
  drafted: boolean;
}): { label: string; href: string } {
  if (!state.researched) return { label: "Research what is public about them", href: "#research" };
  if (!state.analysed) return { label: "Write a website strategy", href: "#strategy" };
  if (!state.hasDemo) return { label: "Build the demo website", href: "#website" };
  if (!state.drafted) return { label: "Write a first message", href: "#outreach" };
  return { label: "Record how the conversation went", href: "#outreach" };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Authorization boundary. See `requireSession` in server/auth/dal.ts.
  await requireSession();

  let lead;
  try {
    lead = await getLeadRepository().findById(id);
  } catch (error) {
    console.error(`[lead ${id}] could not read lead store:`, error);
    throw new Error("Could not load this lead.");
  }

  if (!lead) notFound();

  /**
   * The four secondary reads, issued together.
   *
   * These are read here rather than fetched by the client, which keeps the page
   * a Server Component. They were also awaited one after another, which made
   * this page as slow as the sum of four stores rather than the slowest of
   * them -- for reads that have no dependency on each other at all.
   *
   * Each still fails alone. The `catch` sits on the individual promise, not
   * around the `Promise.all`, because `all` rejects on the first failure and
   * would take the other three down with it: an outreach store being unwell
   * says nothing about whether we can show the analyses.
   */
  const [analyses, demos, profiles, outreach] = await Promise.all([
    analysesForLead(id).catch((error: unknown) => {
      console.error(`[lead ${id}] could not read analyses:`, error);
      return [] as Awaited<ReturnType<typeof analysesForLead>>;
    }),
    demoSitesForLead(id).catch((error: unknown) => {
      console.error(`[lead ${id}] could not read demo sites:`, error);
      return [] as Awaited<ReturnType<typeof demoSitesForLead>>;
    }),
    profilesForLead(id).catch((error: unknown) => {
      console.error(`[lead ${id}] could not read business profiles:`, error);
      return [] as Awaited<ReturnType<typeof profilesForLead>>;
    }),
    outreachForLead(id).catch((error: unknown) => {
      console.error(`[lead ${id}] could not read outreach:`, error);
      return null;
    }),
  ]);

  const analysisProvider = getAnalysisProvider();
  const researcher = getResearchProvider();
  const demoProvider = getDemoSiteProvider();
  const latestAnalysis = analyses[0] ?? null;

  const { provider } = lead;
  const score = scoreLead(lead);
  const website = classifyWebsite(provider.website);
  const osmUrl = provider.source === "osm" ? osmObjectUrl(provider.externalId) : null;
  const dial = provider.phone ? phoneHref(provider.phone) : null;
  const next = nextStep({
    researched: profiles.length > 0,
    analysed: analyses.length > 0,
    hasDemo: demos.length > 0,
    drafted: (outreach?.records.length ?? 0) > 0,
  });

  return (
    <div className="space-y-6">
      <Link href="/leads" className={`text-sm ${LINK}`}>
        &larr; Back to leads
      </Link>

      {/* WHO, AND WHAT NEXT ------------------------------------------------ */}
      <Card as="section" className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words text-slate-900 dark:text-slate-50">
              {provider.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>
                {provider.category} · {provider.city}
              </span>
              <StatusBadge status={lead.status} />
              <PriorityBadge score={score} />
            </div>
          </div>
          <div className="shrink-0">
            <StatusToggle leadId={lead.id} status={lead.status} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Field
            label="Phone"
            value={
              provider.phone === null ? (
                <NotListed />
              ) : dial ? (
                <a href={dial} className={LINK}>
                  {formatPhone(provider.phone)}
                </a>
              ) : (
                formatPhone(provider.phone)
              )
            }
          />
          <Field
            label="Address"
            value={
              <>
                {provider.address ?? <NotListed />}
                <a
                  href={googleMapsSearchUrl(provider)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-0.5 block text-xs ${LINK}`}
                >
                  Look up on Google Maps
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            }
          />
          <Field label="Website" value={<WebsiteValue website={website} raw={provider.website} />} />
          <Field
            label="Reputation"
            value={
              provider.rating === null && provider.reviewCount === null ? (
                <NotListed />
              ) : (
                `${formatRating(provider.rating)} · ${formatReviewCount(provider.reviewCount)}`
              )
            }
          />
        </dl>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            From the {SOURCE_LABELS[provider.source]} listing. &ldquo;Not listed&rdquo; means the
            listing does not say, not that the business has none.
          </p>
          <a
            href={next.href}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 sm:self-auto dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
          >
            Next: {next.label}
            <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </Card>

      {/* THE WORK, IN THE ORDER IT HAPPENS --------------------------------- */}
      <section id="research" className="scroll-mt-6">
        <ResearchPanel
          leadId={lead.id}
          profiles={profiles}
          researcher={{ name: researcher.name, version: researcher.version }}
        />
      </section>

      <section id="strategy" className="scroll-mt-6">
        <AnalysisPanel
          leadId={lead.id}
          analyses={analyses}
          configuredProvider={{ name: analysisProvider.name, model: analysisProvider.model }}
        />
      </section>

      <section id="website" className="scroll-mt-6">
        <DemoPanel
          leadId={lead.id}
          demos={demos}
          latestAnalysis={
            latestAnalysis ? { id: latestAnalysis.id, createdAt: latestAnalysis.createdAt } : null
          }
          generator={{ name: demoProvider.name, model: demoProvider.model }}
        />
      </section>

      {outreach ? (
        <section id="outreach" className="scroll-mt-6">
          <OutreachPanel leadId={lead.id} sheet={outreach.sheet} records={outreach.records} />
        </section>
      ) : null}

      {/* BOOKKEEPING, FOLDED ----------------------------------------------- */}
      <Card as="section" className="p-5">
        <Disclosure summary="Record details: priority, hours, source and IDs">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Why this priority</h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                A review-order hint from listed facts. Not a prediction of purchase, and not proof
                they lack a website.
              </p>
              <table className="mt-3 w-full text-sm">
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
                      <td className="py-2 pr-3">
                        <span className="font-medium">{factor.label}</span>
                        <span className="block text-xs text-slate-600 dark:text-slate-400">
                          {factor.reason}
                        </span>
                      </td>
                      <td className="py-2 text-right align-top tabular-nums whitespace-nowrap">
                        +{factor.points} / {factor.maxPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="py-2 text-left font-semibold">
                      Total
                      <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">
                        {PRIORITY_LABELS[score.priority]}
                      </span>
                    </th>
                    <td className="py-2 text-right align-top font-semibold tabular-nums">
                      {score.total} / {MAX_SCORE}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold">Opening hours</h3>
                {provider.source === "osm" && provider.openingHours === null ? (
                  // Still not "Not listed". OSM hours ARE imported now, but only when
                  // the whole value falls inside the subset `parseOsmOpeningHours`
                  // fully understands -- a seasonal or holiday-qualified schedule is
                  // refused rather than half-read. So null here means one of two
                  // things, and saying which keeps the record honest.
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    No hours recorded. OpenStreetMap either lists none for this business, or
                    lists them in a form too complex to import safely.
                  </p>
                ) : (
                  <OpeningHoursTable hours={provider.openingHours} />
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold">Source and record</h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  The listing is refreshed by search and replaced wholesale; the lead record is
                  ours and survives every refresh.
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Source" value={SOURCE_LABELS[provider.source]} />
                  <Field label="Listing fetched" value={<Timestamp iso={provider.fetchedAt} />} />
                  <Field label="External ID" value={provider.externalId} mono />
                  <Field label="Internal lead ID" value={lead.id} mono />
                  <Field label="Lead created" value={<Timestamp iso={lead.createdAt} />} />
                  <Field label="Last updated" value={<Timestamp iso={lead.updatedAt} />} />
                </dl>
                {osmUrl ? (
                  <p className="mt-3 text-sm">
                    <a href={osmUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                      View on OpenStreetMap
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </Disclosure>

        {/* Attribution stays visible: the licence asks for credit where the
            data is shown, and the header shows it. */}
        {provider.source === "osm" ? <OsmAttribution className="mt-4" /> : null}
        {provider.source === "overture" ? <OvertureAttribution className="mt-4" /> : null}
      </Card>
    </div>
  );
}

function NotListed() {
  return <span className="text-slate-500 dark:text-slate-400">{NOT_LISTED}</span>;
}

function WebsiteValue({
  website,
  raw,
}: {
  website: ReturnType<typeof classifyWebsite>;
  raw: string | null;
}) {
  if (website.kind === "linkable") {
    return (
      <a href={website.href} target="_blank" rel="noopener noreferrer" className={`break-all ${LINK}`}>
        {website.href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (website.kind === "unlinkable") {
    return (
      <span className="text-amber-800 dark:text-amber-300">
        {UNLINKABLE_WEBSITE_LABEL}
        {website.raw.length > 0 ? (
          <>
            {": "}
            <code className="font-mono text-xs break-all">{website.raw}</code>
          </>
        ) : null}
      </span>
    );
  }
  // The short form: the line under the facts already says whose listing this is.
  return <span className="text-amber-800 dark:text-amber-300">{websiteBadgeLabel(raw)}</span>;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
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
