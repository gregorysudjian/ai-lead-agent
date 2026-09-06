import Link from "next/link";

import { SourceBadge } from "./attribution";

import {
  classifyWebsite,
  displayOrNotListed,
  formatRating,
  formatReviewCount,
  UNLINKABLE_WEBSITE_LABEL,
  websiteBadgeLabel,
} from "@/lib/format";
import { MAX_SCORE, PRIORITY_LABELS, type LeadScore } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

import { StatusToggle } from "./status-toggle";

/**
 * One lead row.
 *
 * No "use client" directive: it holds no state, so it renders in whichever tree
 * imports it. It nests StatusToggle, which brings its own client boundary.
 */
export function LeadCard({ lead, score }: { lead: Lead; score: LeadScore }) {
  const { provider } = lead;
  const noWebsiteListed = provider.website === null;
  // Provider data is untrusted: only an allowlisted http(s) URL becomes a link.
  const website = classifyWebsite(provider.website);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{provider.name}</h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {provider.category} &middot; {provider.city}
          </p>

          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex gap-1">
              <dt className="sr-only">Rating</dt>
              <dd>{formatRating(provider.rating)}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">Reviews</dt>
              <dd>{formatReviewCount(provider.reviewCount)}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">Phone</dt>
              <dd>{displayOrNotListed(provider.phone)}</dd>
            </div>
          </dl>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge score={score} />
            <StatusBadge status={lead.status} />
            <SourceBadge source={provider.source} />
            {/* Wording is deliberate: this describes what the provider
                returned, never what the business does or does not have. */}
            <span
              className={
                noWebsiteListed
                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              {websiteBadgeLabel(provider.website)}
            </span>
            {website.kind === "linkable" ? (
              <a
                href={website.href}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
              >
                {website.href}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {website.kind === "unlinkable" ? (
              // Rendered as plain text, never an href. React escapes the value.
              <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                {UNLINKABLE_WEBSITE_LABEL}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusToggle leadId={lead.id} status={lead.status} />
          <Link
            href={`/leads/${lead.id}`}
            className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
          >
            View details
            <span className="sr-only"> for {provider.name}</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: Lead["status"] }) {
  return (
    <span
      className={
        status === "reviewed"
          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-900/40 dark:text-green-200"
          : "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
      }
    >
      {status === "reviewed" ? "Reviewed" : "New"}
    </span>
  );
}

/**
 * Compact score display.
 *
 * The number is always shown with its scale and what it means -- a bare "85"
 * invites the reader to imagine it is a probability of a sale. The full factor
 * breakdown lives on the detail page rather than cluttering every row.
 */
export function PriorityBadge({ score }: { score: LeadScore }) {
  const tone =
    score.priority === "high"
      ? "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
      : score.priority === "medium"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title="Lead priority: a deterministic review-order score from provider-listed signals"
    >
      Lead priority {score.total}/{MAX_SCORE} &middot; {PRIORITY_LABELS[score.priority]}
    </span>
  );
}
