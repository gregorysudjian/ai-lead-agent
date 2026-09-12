import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { OsmAttribution, OvertureAttribution, SOURCE_LABELS } from "@/components/attribution";
import { AddToLeadsButton } from "@/components/catalog/add-to-leads-button";
import { PriorityBadge } from "@/components/lead-row";
import { Badge, BUTTON_SECONDARY, Card, LINK, SectionHeading, type BadgeTone } from "@/components/ui/primitives";
import { Timestamp } from "@/components/ui/timestamp";
import { hiddenByGoogleCheck } from "@/lib/catalog/exclusion";
import { googleMapsSearchUrl } from "@/lib/catalog/maps-link";
import type { GoogleCheckVerdict } from "@/lib/catalog/types";
import { catalogReleases } from "@/lib/catalog/search";
import {
  classifyWebsite,
  displayOrNotListed,
  formatOpeningHours,
  formatRating,
  formatReviewCount,
  UNLINKABLE_WEBSITE_LABEL,
  websiteLabel,
} from "@/lib/format";
import { formatPhone, phoneHref } from "@/lib/phone";
import { MAX_SCORE, PRIORITY_LABELS, scoreSnapshot } from "@/lib/scoring";
import { requireSession } from "@/server/auth";
import { getCatalogRepository } from "@/server/repo";

/**
 * One business from the catalog, in full -- so the operator can look before
 * deciding whether it becomes a lead.
 *
 * Reading this page changes nothing: a business becomes a lead only through
 * the explicit Add button, exactly as on the list. Every value is what the
 * provider LISTED; a missing one reads "not listed", never "none".
 */
export const dynamic = "force-dynamic";

/**
 * The Google Maps check, in words. "Not found" is said as narrowly as it is
 * known: one lookup found no matching place -- not "this business is fake".
 */
const GOOGLE_CHECK_TEXT: Record<GoogleCheckVerdict, { label: string; tone: BadgeTone; detail: string }> = {
  verified: { label: "On Google Maps", tone: "emerald", detail: "Google has a matching place at this address." },
  uncertain: {
    label: "Google Maps: unsure",
    tone: "amber",
    detail: "Google has something similar, but not clearly this business at this address. Kept in search.",
  },
  not_found: {
    label: "Not found on Google Maps",
    tone: "rose",
    detail: "Google returned no matching place, so it is hidden from search. It stays in the database.",
  },
  closed: {
    label: "Closed on Google Maps",
    tone: "rose",
    detail: "Google marks its matching place permanently closed, so it is hidden from search.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guarded too: the title carries the business name.
  await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Business" };
  try {
    const business = await getCatalogRepository().findById(id);
    if (business) return { title: business.provider.name };
  } catch {
    // Fall through; the page reports the failure.
  }
  return { title: "Business" };
}

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const catalog = getCatalogRepository();
  const business = await catalog.findById(id);
  if (!business) notFound();

  // "No longer listed" needs the newest release, which only the whole catalog
  // knows. Same rule the list applies, so the two can never disagree.
  const releases = catalogReleases(await catalog.listAll());
  const isGone = releases.latest !== null && business.lastSeenRelease !== releases.latest;

  const { provider } = business;
  const score = scoreSnapshot(provider);
  const website = classifyWebsite(provider.website);
  const dial = provider.phone ? phoneHref(provider.phone) : null;

  return (
    <div className="space-y-6">
      <Link href="/businesses" className={`text-sm ${LINK}`}>
        &larr; Back to businesses
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {provider.category} · {business.municipality}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words text-slate-900 dark:text-slate-50">
            {provider.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge score={score} />
            <Badge tone={provider.website === null ? "amber" : "slate"}>{websiteLabel(provider.website)}</Badge>
            {isGone ? (
              <Badge tone="slate" title="The latest data release no longer lists this business">
                No longer listed
              </Badge>
            ) : null}
            {business.googleCheck ? (
              <Badge
                tone={GOOGLE_CHECK_TEXT[business.googleCheck.verdict].tone}
                title={GOOGLE_CHECK_TEXT[business.googleCheck.verdict].detail}
              >
                {GOOGLE_CHECK_TEXT[business.googleCheck.verdict].label}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* The decision this page exists for. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {business.leadId !== null ? (
            <Link href={`/leads/${business.leadId}`} className={BUTTON_SECONDARY}>
              In your leads — open the lead →
            </Link>
          ) : (
            <AddToLeadsButton businessId={business.id} businessName={provider.name} />
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading
            title="What the listing says"
            hint="From the provider's record. A missing value means it was not listed, not that it does not exist."
          />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business name" value={provider.name} />
            <Field label="Category" value={provider.category} />
            <Field label="Address" value={displayOrNotListed(provider.address)} />
            <Field label="Area" value={business.municipality} />
            <Field
              label="Phone"
              value={
                dial && provider.phone ? (
                  <a href={dial} className={`tabular-nums ${LINK}`}>
                    {formatPhone(provider.phone)}
                  </a>
                ) : (
                  displayOrNotListed(provider.phone)
                )
              }
            />
            <Field
              label="Website"
              value={
                website.kind === "linkable" ? (
                  <a href={website.href} target="_blank" rel="noopener noreferrer nofollow" className={`break-all ${LINK}`}>
                    {website.href}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : website.kind === "unlinkable" ? (
                  UNLINKABLE_WEBSITE_LABEL
                ) : (
                  websiteLabel(provider.website)
                )
              }
            />
            <Field label="Rating" value={formatRating(provider.rating)} />
            <Field label="Reviews" value={formatReviewCount(provider.reviewCount)} />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Look them up" hint="Opens in a new tab. Nothing is fetched or stored." />
          <div className="mt-4 flex flex-col items-start gap-3 text-sm">
            <a
              href={googleMapsSearchUrl(provider, business.googleCheck?.placeId ?? null)}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              Google Maps: reviews and photos ↗
            </a>
            <Link href={`/demos/lab?business=${business.id}`} className={LINK}>
              Full preview of their possible website →
            </Link>
          </div>
          <h3 className="mt-6 text-sm font-semibold">Google Maps check</h3>
          <p
            className={`mt-1 text-sm ${
              hiddenByGoogleCheck(business.googleCheck)
                ? "text-rose-800 dark:text-rose-300"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {business.googleCheck ? (
              <>
                {GOOGLE_CHECK_TEXT[business.googleCheck.verdict].detail} Checked{" "}
                <Timestamp iso={business.googleCheck.checkedAt} />.
              </>
            ) : (
              "Not checked yet."
            )}
          </p>

          <h3 className="mt-6 text-sm font-semibold">Opening hours</h3>
          {provider.openingHours === null ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Not listed</p>
          ) : provider.openingHours.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No hours listed for any day.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">Opening hours by day</caption>
              <tbody>
                {formatOpeningHours(provider.openingHours).map((row) => (
                  <tr key={row.day} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    <th scope="row" className="py-1.5 text-left font-normal text-slate-600 dark:text-slate-400">
                      {row.day}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{row.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* What a demo for them would look like, before they are even a lead.
          The real lab page in a frame, shrunk: rendered in memory, saved
          nowhere, no paid call. */}
      <Card className="overflow-hidden p-5">
        <SectionHeading
          title="Their possible website"
          hint="What the generator would make for them today. A preview only: nothing is saved or sent."
        />
        <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
          <iframe
            src={`/demos/lab?business=${business.id}`}
            title={`Possible website for ${provider.name}`}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute top-0 left-0 h-[300%] w-[300%] origin-top-left scale-[0.3334] border-0"
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading
            title="Why this priority"
            hint="A fixed rubric for ordering your review, not a prediction and not proof the business has no website."
          />
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Priority breakdown by factor</caption>
            <tbody>
              {score.factors.map((factor) => (
                <tr key={factor.key} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{factor.label}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{factor.reason}</span>
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

        <Card className="p-5">
          <SectionHeading title="Where this comes from" hint="Refreshed in bulk from the provider's public data." />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Source" value={SOURCE_LABELS[provider.source]} />
            <Field label="First seen" value={<Timestamp iso={business.firstSeenAt} />} />
            <Field label="Last seen" value={<Timestamp iso={business.lastSeenAt} />} />
            <Field label="Data release" value={business.lastSeenRelease} mono />
          </dl>
          <div className="mt-4">
            {provider.source === "osm" ? <OsmAttribution /> : null}
            {provider.source === "overture" ? <OvertureAttribution /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm break-words ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
