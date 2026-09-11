import Link from "next/link";

import { catalogHref, type CatalogQuery } from "@/lib/catalog/search";

import { FOCUS_RING } from "../ui/primitives";

/**
 * Pages of catalog results, as plain links.
 *
 * Server-rendered and JavaScript-free: each page is a URL, so it can be
 * opened in a new tab, bookmarked, and reached with the back button.
 *
 * Shows the first page, the last, and the pages around the current one --
 * "1 … 5 6 7 … 39" -- rather than thirty-nine numbers in a row.
 */

const BUTTON =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors";

function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function CatalogPagination({
  query,
  page,
  pageCount,
}: {
  query: CatalogQuery;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const idle = `${BUTTON} border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING}`;
  const disabled = `${BUTTON} border border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600`;

  return (
    <nav aria-label="Pages of results" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={catalogHref(query, { page: page - 1 })} className={idle} rel="prev">
          <span aria-hidden="true">←</span>
          <span className="ml-1">Previous</span>
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          ← <span className="ml-1">Previous</span>
        </span>
      )}

      <ul className="flex items-center gap-1.5">
        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-400">
              …
            </li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span
                  aria-current="page"
                  className={`${BUTTON} bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900`}
                >
                  {entry}
                </span>
              ) : (
                <Link href={catalogHref(query, { page: entry })} className={idle}>
                  <span className="sr-only">Page </span>
                  {entry}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {page < pageCount ? (
        <Link href={catalogHref(query, { page: page + 1 })} className={idle} rel="next">
          <span className="mr-1">Next</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          <span className="mr-1">Next</span> →
        </span>
      )}
    </nav>
  );
}
