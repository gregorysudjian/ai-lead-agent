import { Skeleton } from "@/components/ui/primitives";

/**
 * Shown while a demo preview loads.
 *
 * Chromeless like the page it stands in for, and it mimics the dark admin bar
 * rather than the dashboard: a light skeleton followed by a dark bar would
 * flash the wrong shape of page.
 */
export default function DemoPreviewLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading this demo site…</span>

      <div className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div
              aria-hidden="true"
              className="h-5 w-32 animate-pulse rounded bg-slate-700 motion-reduce:animate-none"
            />
            <div
              aria-hidden="true"
              className="h-5 w-48 animate-pulse rounded bg-slate-800 motion-reduce:animate-none"
            />
          </div>
          <div
            aria-hidden="true"
            className="h-3 w-full max-w-2xl animate-pulse rounded bg-slate-800 motion-reduce:animate-none"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-16">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
