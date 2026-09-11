import Link from "next/link";

import { googleMapsSearchUrl } from "@/lib/catalog/maps-link";
import type { ScoredBusiness } from "@/lib/catalog/search";
import { classifyWebsite, websiteBadgeLabel } from "@/lib/format";
import { formatPhone, phoneHref } from "@/lib/phone";
import { isSocialProfileUrl } from "@/lib/social-hosts";

import { PriorityBadge } from "../lead-row";
import { Badge, Card, FOCUS_RING, LINK } from "../ui/primitives";
import { AddToLeadsButton } from "./add-to-leads-button";

/**
 * One business in the catalog.
 *
 * No "use client": it holds no state, so it renders on the server and ships
 * as HTML. Only the Add button brings its own client boundary.
 *
 * Every statement is about what the provider LISTED. "No website listed" is
 * never "no website", and a business the latest release dropped reads "no
 * longer listed", never "closed" -- CLAUDE.md rule 7, on every card.
 */

function WebsiteLine({ website }: { website: string | null }) {
  const rendering = classifyWebsite(website);
  const prospect = website === null || isSocialProfileUrl(website);
  const badge = <Badge tone={prospect ? "amber" : "slate"}>{websiteBadgeLabel(website)}</Badge>;

  if (rendering.kind !== "linkable") return badge;

  // Linked either way. A social page is often the best look at a business
  // with no website -- its photos are what a demo will be compared against.
  return (
    <a
      href={rendering.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={rendering.href}
      className={`inline-flex rounded-full hover:opacity-80 ${FOCUS_RING}`}
    >
      {badge}
      <span className="sr-only"> {rendering.href} (opens in a new tab)</span>
    </a>
  );
}

function PhoneLine({ phone }: { phone: string | null }) {
  if (phone === null) {
    return <span className="text-slate-500 dark:text-slate-400">Phone not listed</span>;
  }
  const dial = phoneHref(phone);
  if (dial === null) {
    return <span className="tabular-nums text-slate-700 dark:text-slate-300">{phone}</span>;
  }
  return (
    <a href={dial} className={`tabular-nums ${LINK}`}>
      {formatPhone(phone)}
    </a>
  );
}

export function BusinessCard({ item }: { item: ScoredBusiness }) {
  const { business, score, isNew, isGone } = item;
  const { provider } = business;

  return (
    <Card
      as="li"
      className={`flex flex-col p-4 transition-shadow hover:shadow-md sm:p-5 ${isGone ? "opacity-70" : ""}`}
    >
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
            {provider.category} · {provider.city}
          </p>
          <div className="flex shrink-0 gap-1.5">
            {isNew ? <Badge tone="indigo">New</Badge> : null}
            {isGone ? (
              <Badge tone="slate" title="The latest data release no longer lists this business">
                No longer listed
              </Badge>
            ) : null}
          </div>
        </div>

        {/* The name opens the full record, where the Add decision is made
            with everything in view. */}
        <h3 className="mt-1 text-base leading-snug font-semibold tracking-tight break-words text-slate-900 dark:text-slate-50">
          <Link
            href={`/businesses/${business.id}`}
            className={`rounded hover:text-indigo-700 hover:underline dark:hover:text-indigo-300 ${FOCUS_RING}`}
          >
            {provider.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          {provider.address ?? <span className="italic">Address not listed</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <WebsiteLine website={provider.website} />
          <PriorityBadge score={score} />
        </div>

        <p className="mt-2 text-sm">
          <PhoneLine phone={provider.phone} />
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        {business.leadId !== null ? (
          <Link
            href={`/leads/${business.leadId}`}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60 ${FOCUS_RING}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            In your leads
            <span aria-hidden="true">→</span>
            <span className="sr-only"> : open the lead for {provider.name}</span>
          </Link>
        ) : (
          <AddToLeadsButton businessId={business.id} businessName={provider.name} />
        )}

        <div className="flex items-center gap-4">
          <Link href={`/businesses/${business.id}`} className={`text-sm font-medium ${LINK}`}>
            Details
            <span className="sr-only"> for {provider.name}</span>
          </Link>
          {/* The lab renders the site generation WOULD produce, in memory:
              nothing is saved, and no paid provider can be reached from it. */}
          <Link href={`/demos/lab?business=${business.id}`} className={`text-sm ${LINK}`}>
            Preview site
            <span className="sr-only"> for {provider.name}</span>
          </Link>
          <a
            href={googleMapsSearchUrl(provider)}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-sm ${LINK}`}
          >
            Google Maps
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> for {provider.name} (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </Card>
  );
}
