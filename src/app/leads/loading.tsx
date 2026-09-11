import { Card, LoadingRegion, Skeleton } from "@/components/ui/primitives";

/**
 * Shown while `/leads` reads the store.
 *
 * The page is `force-dynamic` and reads every stored lead, so without this
 * boundary a navigation sat on the previous screen with no feedback at all.
 */
export default function LeadsLoading() {
  return (
    <LoadingRegion label="Loading leads…">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      </Card>

      <Card className="divide-y divide-slate-200 dark:divide-slate-800">
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </Card>
    </LoadingRegion>
  );
}
