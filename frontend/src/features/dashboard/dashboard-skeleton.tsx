import { Skeleton } from "@/components/ui/skeleton";

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-7" aria-hidden="true">
      <Skeleton className="h-44 w-full rounded-3xl sm:h-40" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-5 w-48 rounded-full" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function DashboardFeedbackSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-5 w-40 rounded-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
