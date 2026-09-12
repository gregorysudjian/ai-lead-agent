"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { catalogHref, type CatalogQuery, type LeadsFilter, type SortOrder } from "@/lib/catalog/search";
import { CATALOG_TRADE_GROUPS, TRADE_PLURALS } from "@/lib/catalog/trades";

import { BUTTON_SECONDARY, Card, FOCUS_RING, INPUT } from "../ui/primitives";

/**
 * The catalog's search controls.
 *
 * A Client Component only because typing and choosing need to change the URL
 * without a full page load. It holds no results and fetches nothing: every
 * control navigates to a new `/businesses?...` URL, the Server Component reads
 * the catalog for that URL, and the server stays the source of truth. So a
 * search can be bookmarked, shared, and undone with the back button.
 *
 * Every href comes from `catalogHref`, which only ever builds `/businesses`
 * URLs from validated values -- nothing typed here reaches the router raw.
 */

const SEARCH_DELAY_MS = 350;

const SORTS: { id: SortOrder; label: string }[] = [
  { id: "priority", label: "Best prospects first" },
  { id: "newest", label: "Newest first" },
  { id: "name", label: "Name A–Z" },
];

const LEADS: { id: LeadsFilter; label: string }[] = [
  { id: "any", label: "In my leads or not" },
  { id: "hide", label: "Not in my leads" },
  { id: "only", label: "Only my leads" },
];

const PILL =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors";

/** A compact select: sized by its content, the height of a pill row. */
const SELECT = `rounded-lg border border-slate-300 bg-white py-1.5 pr-8 pl-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 ${FOCUS_RING}`;
const PILL_ON = "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";
const PILL_OFF =
  "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={`tabular-nums text-xs ${on ? "text-white/70 dark:text-slate-900/60" : "text-slate-500 dark:text-slate-400"}`}
    >
      {n.toLocaleString("en-CA")}
    </span>
  );
}

export function CatalogToolbar({
  query,
  tradeCounts,
  areaCounts,
  municipalities,
  hasHistory,
  goneCount,
}: {
  query: CatalogQuery;
  tradeCounts: Record<string, number>;
  areaCounts: { label: string; count: number }[];
  /** Every municipality in the area, so an area with no matches is still choosable. */
  municipalities: string[];
  /** Whether more than one release has been loaded, so "new" means something. */
  hasHistory: boolean;
  goneCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * The search box follows the URL -- but only when something ELSE changed
   * it: "Clear all", the back button, a bookmarked link.
   *
   * Our own debounced search also changes the URL, a moment after the
   * keystroke. Treating that echo as an outside change reset the box to the
   * text that was sent, erasing whatever had been typed since. So the last
   * text we sent is remembered, and its echo is ignored. Derived during
   * render rather than in an effect, and without remounting the input, which
   * would steal focus mid-word.
   */
  const [text, setText] = useState(query.q);
  const [seenQ, setSeenQ] = useState(query.q);
  const [sentQ, setSentQ] = useState(query.q);
  if (query.q !== seenQ) {
    setSeenQ(query.q);
    if (query.q !== sentQ) setText(query.q);
  }

  // Debounced live search. The timer lives in a ref so each keystroke resets it.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /**
   * Navigate to the search with `patch` applied.
   *
   * Every navigation cancels a pending search and carries the current text.
   * Without that, clicking a toggle within the debounce window was undone a
   * moment later when the stale timer fired with the old filters.
   */
  const go = (patch: Partial<CatalogQuery>) => {
    if (timer.current) clearTimeout(timer.current);
    const next = { q: text.trim(), ...patch };
    setSentQ(next.q);
    startTransition(() => router.replace(catalogHref(query, next), { scroll: false }));
  };

  function onType(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    // The value is captured here, not read later, so the timer always sends
    // exactly what was typed when it was set.
    timer.current = setTimeout(() => go({ q: value.trim() }), SEARCH_DELAY_MS);
  }

  const allTrades = Object.values(tradeCounts).reduce((sum, n) => sum + n, 0);
  const countFor = new Map(areaCounts.map((entry) => [entry.label, entry.count]));
  const filtersActive =
    query.q !== "" ||
    query.trade !== null ||
    query.area !== null ||
    query.noWebsite ||
    query.hasPhone ||
    query.fresh ||
    query.leads !== "any" ||
    query.includeGone;

  return (
    <Card className="space-y-3 p-4">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go({});
        }}
      >
        <label htmlFor="catalog-q" className="sr-only">
          Search businesses
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            id="catalog-q"
            type="search"
            value={text}
            onChange={(event) => onType(event.target.value)}
            placeholder="Search by business name, street or neighbourhood"
            autoComplete="off"
            maxLength={100}
            className={`${INPUT} pl-9`}
          />
        </div>
      </form>

      {/* Trades. The count beside each is what you would get by switching to
          it, with every other filter kept -- never the total for the trade. */}
      <div role="group" aria-label="Trade" className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => go({ trade: null })}
          aria-pressed={query.trade === null}
          className={`${PILL} ${query.trade === null ? PILL_ON : PILL_OFF} ${FOCUS_RING}`}
        >
          All trades <Count n={allTrades} on={query.trade === null} />
        </button>
        {CATALOG_TRADE_GROUPS.flatMap((group) => group.keys).map((key) => {
          const on = query.trade === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => go({ trade: on ? null : key })}
              aria-pressed={on}
              className={`${PILL} ${on ? PILL_ON : PILL_OFF} ${FOCUS_RING}`}
            >
              {TRADE_PLURALS[key]} <Count n={tradeCounts[key] ?? 0} on={on} />
            </button>
          );
        })}
      </div>

      {/* Everything else on one wrapping line. The selects label themselves
          through their current option, so their labels are for screen readers. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <label htmlFor="catalog-area" className="sr-only">
          Area
        </label>
        <select
          id="catalog-area"
          value={query.area ?? ""}
          onChange={(event) => go({ area: event.target.value || null })}
          className={SELECT}
        >
          <option value="">Anywhere on the island</option>
          {municipalities.map((label) => (
            <option key={label} value={label}>
              {label} ({(countFor.get(label) ?? 0).toLocaleString("en-CA")})
            </option>
          ))}
        </select>

        <label htmlFor="catalog-sort" className="sr-only">
          Order
        </label>
        <select
          id="catalog-sort"
          value={query.sort}
          onChange={(event) => go({ sort: event.target.value as SortOrder })}
          className={SELECT}
        >
          {SORTS.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.label}
            </option>
          ))}
        </select>

        <label htmlFor="catalog-leads" className="sr-only">
          Your leads
        </label>
        <select
          id="catalog-leads"
          value={query.leads}
          onChange={(event) => go({ leads: event.target.value as LeadsFilter })}
          className={SELECT}
        >
          {LEADS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div role="group" aria-label="Show only" className="flex flex-wrap gap-2">
          <Toggle on={query.noWebsite} onClick={() => go({ noWebsite: !query.noWebsite })}>
            No website listed
          </Toggle>
          <Toggle on={query.hasPhone} onClick={() => go({ hasPhone: !query.hasPhone })}>
            Has a phone
          </Toggle>
          {hasHistory ? (
            <Toggle on={query.fresh} onClick={() => go({ fresh: !query.fresh })}>
              New this month
            </Toggle>
          ) : null}
          {goneCount > 0 ? (
            <Toggle on={query.includeGone} onClick={() => go({ includeGone: !query.includeGone })}>
              Include {goneCount.toLocaleString("en-CA")} no longer listed
            </Toggle>
          ) : null}
        </div>

        <span className="ml-auto flex items-center gap-3">
          <span aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
            {pending ? "Updating…" : ""}
          </span>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setText("");
                setSentQ("");
                startTransition(() => router.replace("/businesses", { scroll: false }));
              }}
              className={BUTTON_SECONDARY}
            >
              Clear all
            </button>
          ) : null}
        </span>
      </div>
    </Card>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`${PILL} ${on ? "bg-indigo-600 text-white dark:bg-indigo-500" : PILL_OFF} ${FOCUS_RING}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
          on ? "border-white/70 bg-white/20" : "border-slate-400 dark:border-slate-500"
        }`}
      >
        {on ? (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m2.5 6.5 2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {children}
    </button>
  );
}
