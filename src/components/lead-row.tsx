import Link from "next/link";

import {
  classifyWebsite,
  displayOrNotListed,
  formatRating,
  formatReviewCount,
  hasProviderReputation,
  UNLINKABLE_WEBSITE_LABEL,
  websiteBadgeLabel,
} from "@/lib/format";
import { isSocialProfileUrl } from "@/lib/social-hosts";
import { MAX_SCORE, PRIORITY_LABELS, type LeadScore } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

import { SOURCE_LABELS } from "./attribution";
import { StatusToggle } from "./status-toggle";
import { Badge, LINK, type BadgeTone } from "./ui/primitives";

/**
 * One lead as a table row.
 *
 * No "use client" directive: it holds no state, so it renders in whichever tree
 * imports it. It nests StatusToggle, which brings its own client boundary.
 */

const PRIORITY_TONE: Record<LeadScore["priority"], BadgeTone> = {
  high: "rose",
  medium: "amber",
  low: "slate",
};

export function PriorityBadge({ score }: { score: LeadScore }) {
  return (
    <Badge
      tone={PRIORITY_TONE[score.priority]}
      title="Lead priority: a deterministic review-order score from provider-listed signals"
    >
      {score.total}/{MAX_SCORE} · {PRIORITY_LABELS[score.priority].replace(" priority", "")}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: Lead["status"] }) {
  return (
    <Badge tone={status === "reviewed" ? "emerald" : "blue"}>
      {status === "reviewed" ? "Reviewed" : "New"}
    </Badge>
  );
}

/**
 * Web presence cell.
 *
 * `website === null` means the provider listed none -- NOT that none exists.
 * A non-null but unsafe value is shown as escaped plain text and never linked;
 * classifyWebsite remains the only authority on that.
 */
function WebPresence({ website }: { website: string | null }) {
  const rendering = classifyWebsite(website);

  if (rendering.kind === "none") {
    return <Badge tone="amber">{websiteBadgeLabel(website)}</Badge>;
  }

  if (rendering.kind === "unlinkable") {
    return (
      <span
        className="text-xs text-slate-600 dark:text-slate-400"
        title={UNLINKABLE_WEBSITE_LABEL}
      >
        {websiteBadgeLabel(website)}
      </span>
    );
  }

  // A social page IS a real link and stays clickable -- but it is labelled for
  // what it is, and shares the amber "prospect" tone with a missing website,
  // because scoring treats the two the same and the row must agree with it.
  if (isSocialProfileUrl(website)) {
    return (
      <a
        href={rendering.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[16rem] truncate"
        title={rendering.href}
      >
        <Badge tone="amber">{websiteBadgeLabel(website)}</Badge>
        <span className="sr-only"> {rendering.href} (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <a
      href={rendering.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`block max-w-[16rem] truncate text-xs ${LINK}`}
      title={rendering.href}
    >
      {rendering.href.replace(/^https?:\/\//, "")}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function LeadRow({ lead, score }: { lead: Lead; score: LeadScore }) {
  const { provider } = lead;

  return (
    <tr className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className="px-4 py-3">
        <Link
          href={`/leads/${lead.id}`}
          className={`block max-w-[18rem] truncate font-medium text-slate-900 dark:text-slate-100 ${LINK} decoration-transparent hover:decoration-current`}
          title={provider.name}
        >
          {provider.name}
        </Link>
        <p className="mt-0.5 max-w-[18rem] truncate text-xs text-slate-600 dark:text-slate-400">
          {provider.category} · {provider.city}
        </p>
        <p
          className="mt-0.5 max-w-[18rem] truncate text-xs text-slate-500 dark:text-slate-500"
          title={provider.address ?? undefined}
        >
          {displayOrNotListed(provider.address)}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="whitespace-nowrap text-slate-700 dark:text-slate-300">
          {displayOrNotListed(provider.phone)}
        </p>
        {/* Omitted entirely when the provider supplied no reputation data --
            otherwise every OSM row repeats the same empty statement. The detail
            page still says explicitly that none was listed. */}
        {hasProviderReputation(provider) ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">
            {formatRating(provider.rating)} · {formatReviewCount(provider.reviewCount)}
          </p>
        ) : null}
      </td>

      <td className="px-4 py-3">
        <WebPresence website={provider.website} />
        <p className="mt-1">
          <Badge tone="slate">{SOURCE_LABELS[provider.source]}</Badge>
        </p>
      </td>

      <td className="px-4 py-3">
        <PriorityBadge score={score} />
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-2">
          <StatusToggle leadId={lead.id} status={lead.status} />
          <Link href={`/leads/${lead.id}`} className={`text-xs ${LINK}`}>
            View details
            <span className="sr-only"> for {provider.name}</span>
          </Link>
        </div>
      </td>
    </tr>
  );
}
