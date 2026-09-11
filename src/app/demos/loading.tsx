import { Card, LoadingRegion, Skeleton } from "@/components/ui/primitives";

/** Shown while `/demos` reads the demo store and the lead store. */
export default function DemosLoading() {
  return (
    <LoadingRegion label="Loading demo sites…">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, card) => (
          <Card key={card} className="space-y-4 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
            <Skeleton className="h-9 w-32" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}
