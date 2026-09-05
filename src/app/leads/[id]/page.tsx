import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/lead-card";
import { StatusToggle } from "@/components/status-toggle";
import {
  classifyWebsite,
  displayOrNotListed,
  formatOpeningHours,
  formatRating,
  formatReviewCount,
  formatTimestamp,
  UNLINKABLE_WEBSITE_LABEL,
} from "@/lib/format";
import { MAX_SCORE, PRIORITY_LABELS, scoreLead } from "@/lib/scoring";
import type { OpeningHours } from "@/lib/types";
import { getLeadRepository } from "@/server/repo";

/**
 * Lead detail.
 *
 * A Server Component reading the repository directly -- no HTTP call from the
 * server to its own API. Only the status control is a Client Component.
 *
 * The page is split into two clearly separated regions that mirror the data
 * model: what our application owns, and what the provider last told us.
 */
export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  // Next 16 passes route params as a Promise.
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

  // An unknown id renders the standard 404, not an error page.
  if (!lead) notFound();

  const { provider } = lead;
  // Derived on every render from the current snapshot. Never stored.
  const score = scoreLead(lead);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
      >
        &larr; Back to dashboard
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {provider.category} &middot; {provider.city}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={lead.status} />
          <StatusToggle leadId={lead.id} status={lead.status} />
        </div>
      </header>

      <section
        aria-labelledby="app-data"
        className="mt-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="app-data" className="text-base font-semibold">
          Lead record
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Owned by this application. Survives every rediscovery.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Internal lead ID" value={lead.id} mono />
          <Field label="Status" value={lead.status} />
          <Field label="Created" value={formatTimestamp(lead.createdAt)} />
          <Field label="Last updated" value={formatTimestamp(lead.updatedAt)} />
        </dl>
      </section>

      <section
        aria-labelledby="score"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="score" className="text-base font-semibold">
          Opportunity score
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          A review-order hint calculated from the provider signals below. It is not
          a likelihood of purchase, and not evidence that this business needs or
          lacks a website.
        </p>

        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Opportunity score breakdown by factor</caption>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th scope="col" className="py-1.5 text-left font-medium">Factor</th>
              <th scope="col" className="py-1.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {score.factors.map((factor) => (
              <tr key={factor.key} className="border-b border-slate-200 dark:border-slate-800">
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
      </section>

      <section
        aria-labelledby="provider-data"
        className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950"
      >
        <h2 id="provider-data" className="text-base font-semibold">
          Provider data
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Supplied by the discovery provider and refreshed on every search. A
          missing value means the provider did not list it, not that it does not
          exist.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" value={provider.name} />
          <Field label="Category" value={provider.category} />
          <Field label="City" value={provider.city} />
          <Field label="Address" value={displayOrNotListed(provider.address)} />
          <Field label="Phone" value={displayOrNotListed(provider.phone)} />
          <WebsiteField website={provider.website} />
          <Field label="Rating" value={formatRating(provider.rating)} />
          <Field label="Reviews" value={formatReviewCount(provider.reviewCount)} />
          <Field label="Source" value={provider.source} />
          <Field label="External ID" value={provider.externalId} mono />
          <Field label="Fetched" value={formatTimestamp(provider.fetchedAt)} />
        </dl>

        <h3 className="mt-6 text-sm font-semibold">Opening hours</h3>
        <OpeningHoursTable hours={provider.openingHours} />
      </section>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm break-words ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function WebsiteField({ website }: { website: string | null }) {
  // Provider data is untrusted. Only an allowlisted absolute http(s) URL is
  // rendered as an anchor; anything else is shown as escaped plain text.
  const rendering = classifyWebsite(website);

  return (
    <div>
      <dt className="text-xs text-slate-600 dark:text-slate-400">Website</dt>
      <dd className="mt-0.5 text-sm break-words">
        {rendering.kind === "none" ? (
          <span className="text-amber-800 dark:text-amber-300">
            No website listed by provider
          </span>
        ) : null}

        {rendering.kind === "linkable" ? (
          <a
            href={rendering.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
          >
            {rendering.href}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}

        {rendering.kind === "unlinkable" ? (
          <span className="text-amber-800 dark:text-amber-300">
            {UNLINKABLE_WEBSITE_LABEL}
            {rendering.raw.length > 0 ? (
              <>
                {": "}
                <code className="font-mono text-xs break-all">{rendering.raw}</code>
              </>
            ) : null}
          </span>
        ) : null}
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
          <tr key={row.day} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
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
