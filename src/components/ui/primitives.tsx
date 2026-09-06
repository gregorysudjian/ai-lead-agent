import type { ReactNode } from "react";

/**
 * Shared presentational primitives.
 *
 * These exist so card, badge and heading styling lives in ONE place rather than
 * being re-typed as long Tailwind strings in every component. No hooks and no
 * state, so they render in both the server and client trees.
 */

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  return (
    <Tag
      className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  hint,
  id,
}: {
  title: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="min-w-0">
      <h2 id={id} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {hint ? (
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Small stat tile for derived, non-persisted counts. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "amber" | "rose" | "emerald";
}) {
  const accent = {
    neutral: "text-slate-900 dark:text-slate-50",
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <Card className="p-4">
      <dt className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</dd>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p>
      ) : null}
    </Card>
  );
}

export type BadgeTone = "slate" | "blue" | "emerald" | "amber" | "rose" | "indigo";

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  emerald: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  rose: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  indigo: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
};

export function Badge({
  children,
  tone = "slate",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Neutral empty/placeholder panel. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Truthful failure panel. Never hides an error behind an empty state. */
export function ErrorPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50"
    >
      <p className="text-sm font-medium text-red-900 dark:text-red-200">{title}</p>
      {detail ? (
        <p className="mt-1 text-sm text-red-800 dark:text-red-300">{detail}</p>
      ) : null}
    </div>
  );
}

/** Shared focus treatment so every interactive element matches. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export const BUTTON_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BUTTON_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`;

export const INPUT = `w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${FOCUS_RING}`;

export const LINK = `text-indigo-700 underline underline-offset-2 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 ${FOCUS_RING}`;
