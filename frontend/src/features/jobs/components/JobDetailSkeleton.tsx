import { Skeleton } from '@/components/ui/skeleton'

export function JobDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8" data-testid="job-detail">
      <Skeleton className="h-4 w-24" />

      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>

      {/* ATS panel */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>

      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}
