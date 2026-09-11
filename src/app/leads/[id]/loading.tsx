import { Card, LoadingRegion, Skeleton } from "@/components/ui/primitives";

/**
 * Shown while a lead detail page reads its five stores.
 *
 * This is the navigation the audit found worst: clicking a row ran a lead
 * read plus four more reads before anything rendered, with no feedback.
 * The reads are now issued together, and this covers the wait that remains.
 */
export default function LeadDetailLoading() {
  return (
    <LoadingRegion label="Loading this lead…">
      <Skeleton className="h-4 w-28" />

      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3 max-w-sm" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </Card>
      </div>

      {Array.from({ length: 3 }, (_, panel) => (
        <Card key={panel} className="space-y-4 p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20" />
        </Card>
      ))}
    </LoadingRegion>
  );
}
