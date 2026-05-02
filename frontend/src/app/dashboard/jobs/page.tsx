'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/features/jobs/components/FilterBar'
import { JobCard } from '@/features/jobs/components/JobCard'
import { JobGridSkeleton } from '@/features/jobs/components/JobCardSkeleton'
import { Pagination } from '@/features/jobs/components/Pagination'
import { ApplyDialog } from '@/features/jobs/components/ApplyDialog'
import { JobDetailModal } from '@/features/jobs/components/JobDetailModal'
import { useJobs } from '@/features/jobs/hooks/useJobs'
import { getJobs } from '@/services/jobs.service'
import type { Job, JobFilters } from '@/types/jobs'

function parseFilters(params: URLSearchParams): JobFilters {
  const filters: JobFilters = {}
  const q = params.get('q')
  const source = params.get('source')
  const remote = params.get('remote')
  const category = params.get('category')
  const country = params.get('country')
  const page = params.get('page')

  if (q) filters.q = q
  if (source) filters.source = source
  if (remote === 'true') filters.remote = true
  else if (remote === 'false') filters.remote = false
  if (category) filters.category = category
  if (country) filters.country = country
  if (page) filters.page = parseInt(page, 10)

  return filters
}

function JobsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <SearchX className="size-12 text-muted-foreground" />
      <div>
        <p className="text-base font-semibold text-foreground">No jobs found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or search query.
        </p>
      </div>
    </div>
  )
}

function JobsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const filters = parseFilters(searchParams)

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [applyJob, setApplyJob] = useState<Job | null>(null)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)

  const { data, isLoading, isFetching } = useJobs(filters)

  // isStale: TanStack Query is fetching new data but we have old data to show.
  // keepPreviousData means jobs is the previous page's results during this window.
  const isStale = isFetching && !isLoading

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const current = new URLSearchParams(searchParams.toString())
      if (value === undefined || value === '') {
        current.delete(key)
      } else {
        current.set(key, value)
      }
      if (key !== 'page') current.delete('page')
      router.replace(`/dashboard/jobs?${current.toString()}`)
    },
    [router, searchParams]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const current = new URLSearchParams(searchParams.toString())
      current.set('page', String(page))
      router.replace(`/dashboard/jobs?${current.toString()}`)
    },
    [router, searchParams]
  )

  const handlePrefetch = useCallback(
    (page: number) => {
      queryClient.prefetchQuery({
        queryKey: ['jobs', { ...filters, page }],
        queryFn: () => getJobs({ ...filters, page }),
        staleTime: 5 * 60 * 1000,
      })
    },
    [queryClient, filters]
  )

  const handleView = useCallback((job: Job) => {
    setSelectedJobId(job.id)
    setModalOpen(true)
  }, [])

  const handleApply = useCallback((job: Job) => {
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    setApplyJob(job)
    setApplyDialogOpen(true)
  }, [])

  const handleSave = useCallback((job: Job) => {
    setApplyJob(job)
    setApplyDialogOpen(true)
  }, [])

  const handleModalApply = useCallback(() => {
    setApplyDialogOpen(true)
  }, [])

  const totalJobs = data?.pagination.total ?? 0
  const jobs = data?.items ?? []
  const pagination = data?.pagination

  // Only show the skeleton on true first load — no data at all yet.
  // When stale (filter/search changed, waiting for new results), we dim the existing grid instead.
  const showSkeleton = isLoading || (isStale && jobs.length === 0)

  return (
    <div className="flex flex-col min-h-full">
      <FilterBar filters={filters} onFilterChange={updateFilter} />

      <div className="mx-auto w-full max-w-7xl px-4 py-5 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {showSkeleton ? (
              <span className="animate-pulse">Loading jobs...</span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{totalJobs.toLocaleString()}</span>{' '}
                {totalJobs === 1 ? 'job' : 'jobs'} found
              </>
            )}
          </p>
          {isStale && !showSkeleton && (
            <span className="text-xs text-muted-foreground animate-pulse">Searching...</span>
          )}
        </div>

        {showSkeleton ? (
          <JobGridSkeleton />
        ) : jobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <div
            className={cn(
              'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-200',
              isStale && 'opacity-40 pointer-events-none select-none'
            )}
          >
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onView={handleView}
                onApply={handleApply}
                onSave={handleSave}
              />
            ))}
          </div>
        )}

        {!showSkeleton && !isStale && pagination && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPrefetch={handlePrefetch}
          />
        )}
      </div>

      <JobDetailModal
        jobId={selectedJobId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onApply={handleModalApply}
        onSave={() => setApplyDialogOpen(true)}
      />

      <ApplyDialog
        job={applyJob}
        open={applyDialogOpen}
        onClose={() => {
          setApplyDialogOpen(false)
          setApplyJob(null)
        }}
      />
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={<JobGridSkeleton />}>
      <JobsContent />
    </Suspense>
  )
}
