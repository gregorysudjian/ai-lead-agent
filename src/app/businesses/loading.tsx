import { Card, LoadingRegion, Skeleton } from "@/components/ui/primitives";

/** Shown while `/businesses` reads the catalog on first arrival. */
export default function BusinessesLoading() {
  return (
    <LoadingRegion label="Loading businesses…">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, tile) => (
          <Skeleton key={tile} className="h-[5.5rem]" />
        ))}
      </div>

      <Card className="space-y-4 p-5">
        <Skeleton className="h-10" />
        <div className="flex flex-wrap gap-2">
          {/* Complete class literals: an assembled width class would never be
              emitted by Tailwind (CLAUDE.md). */}
          {["w-24", "w-28", "w-28", "w-32", "w-28", "w-36"].map((width, chip) => (
            <Skeleton key={chip} className={`h-9 rounded-full ${width}`} />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, card) => (
          <Card key={card} className="space-y-3 p-5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-9 w-32" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}
