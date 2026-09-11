"use client";

import { useSyncExternalStore } from "react";

import { formatTimestamp } from "@/lib/format";

/**
 * Nothing to subscribe to: the value below never changes after hydration.
 * Defined once at module scope so the reference is stable across renders --
 * a new closure each render would make React resubscribe every time.
 */
const neverChanges = () => () => {};

/**
 * A stored instant, shown in the reader's own timezone.
 *
 * Everything in this application is stored as UTC ISO 8601, and
 * `formatTimestamp` renders exactly that. It is unambiguous, and it is what a
 * Server Component can render safely -- but "2026-09-09 14:32 UTC" is not the
 * timezone the operator lives in, and these values get read to answer questions
 * like "did I generate this before or after I called them?".
 *
 * The server, and the hydrating client render, emit the UTC string; the local
 * rendering replaces it once hydration is done. Formatting during the first
 * render instead would produce different HTML on the two sides, because only
 * one of them knows the reader's timezone -- that is a hydration mismatch.
 *
 * `useSyncExternalStore` is how that "have we hydrated yet?" question is asked
 * without writing state from an effect: it is given a server snapshot of
 * `false` and a client snapshot of `true`, so React renders the server's answer
 * during hydration and re-renders with the client's afterwards. Without
 * JavaScript the UTC string simply stays, which is still correct.
 *
 * The stored value never disappears: `title` keeps the UTC rendering and
 * `dateTime` keeps the raw ISO string.
 */
export function Timestamp({ iso }: { iso: string }) {
  const utc = formatTimestamp(iso);
  const hydrated = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  const date = new Date(iso);
  // An unparseable value never becomes a `<time>`: `dateTime` would be invalid,
  // and `formatTimestamp` has already turned it into the "not listed" label.
  if (Number.isNaN(date.getTime())) return <>{utc}</>;

  return (
    <time dateTime={iso} title={utc}>
      {hydrated
        ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : utc}
    </time>
  );
}
