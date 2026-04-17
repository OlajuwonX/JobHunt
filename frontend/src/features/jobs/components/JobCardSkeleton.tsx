import { Skeleton } from '@/components/ui/skeleton'

function JobCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-card p-3.5 ring-1 ring-foreground/8">
      {/* Source badge + match score */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4.5 w-20 rounded-full" />
        <Skeleton className="h-4.5 w-16 rounded-full" />
      </div>

      {/* Title + company + location */}
      <div className="space-y-1">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>

      {/* Tech stack tags */}
      <div className="flex gap-1.5">
        <Skeleton className="h-4.5 w-14 rounded-md" />
        <Skeleton className="h-4.5 w-16 rounded-md" />
        <Skeleton className="h-4.5 w-12 rounded-md" />
      </div>

      {/* Salary + date */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-18 rounded-lg" />
      </div>
    </div>
  )
}

export function JobGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  )
}
