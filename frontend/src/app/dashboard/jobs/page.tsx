'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchX } from 'lucide-react'
import { FilterBar } from '@/features/jobs/components/FilterBar'
import { JobCard } from '@/features/jobs/components/JobCard'
import { JobGridSkeleton } from '@/features/jobs/components/JobCardSkeleton'
import { Pagination } from '@/features/jobs/components/Pagination'
import { ApplyDialog } from '@/features/jobs/components/ApplyDialog'
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
  const [applyJob, setApplyJob] = useState<Job | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, isFetching } = useJobs(filters)

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const current = new URLSearchParams(searchParams.toString())
      if (value === undefined || value === '') {
        current.delete(key)
      } else {
        current.set(key, value)
      }
      // Reset to page 1 on any filter change (except page itself)
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

  const handleApply = useCallback((job: Job) => {
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    setApplyJob(job)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback((job: Job) => {
    setApplyJob(job)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setApplyJob(null)
  }, [])

  const totalJobs = data?.pagination.total ?? 0
  const jobs = data?.items ?? []
  const pagination = data?.pagination

  return (
    <div className="flex flex-col min-h-full">
      <FilterBar filters={filters} onFilterChange={updateFilter} />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="animate-pulse">Loading jobs...</span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{totalJobs.toLocaleString()}</span>{' '}
                {totalJobs === 1 ? 'job' : 'jobs'} found
              </>
            )}
          </p>
          {isFetching && !isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Updating...</span>
          )}
        </div>

        {isLoading ? (
          <JobGridSkeleton />
        ) : jobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={searchParams.toString()}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onApply={handleApply} onSave={handleSave} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {pagination && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPrefetch={handlePrefetch}
          />
        )}
      </div>

      <ApplyDialog job={applyJob} open={dialogOpen} onClose={handleDialogClose} />
    </div>
  )
}

// useSearchParams() must be inside a Suspense boundary in the App Router.
// JobsContent holds all the filter+fetch logic; JobsPage wraps it.
export default function JobsPage() {
  return (
    <Suspense fallback={<JobGridSkeleton />}>
      <JobsContent />
    </Suspense>
  )
}
