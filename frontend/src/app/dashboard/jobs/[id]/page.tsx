'use client'

import { useState, useCallback, use } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { ArrowLeft, DollarSign, Calendar, MapPin, Globe } from 'lucide-react'
import { JobDetailSkeleton } from '@/features/jobs/components/JobDetailSkeleton'
import { AtsScorePanel } from '@/features/jobs/components/AtsScorePanel'
import { JobDetailActionBar } from '@/features/jobs/components/JobDetailActionBar'
import { ApplyDialog } from '@/features/jobs/components/ApplyDialog'
import { SourceBadge } from '@/features/jobs/components/JobCardBadges'
import { TechStackTags } from '@/features/jobs/components/TechStackTags'
import { useJob } from '@/features/jobs/hooks/useJob'
import type { Job } from '@/types/jobs'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

function JobNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-4">
      <p className="text-2xl font-semibold text-foreground">Job not found</p>
      <p className="text-sm text-muted-foreground">
        This job may have been removed or the link is invalid.
      </p>
      <Link
        href="/dashboard/jobs"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to job listings
      </Link>
    </div>
  )
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = use(params)
  const { data, isLoading, isError } = useJob(id)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleApply = useCallback(() => {
    if (!data?.job) return
    window.open(data.job.applyUrl, '_blank', 'noopener,noreferrer')
    setDialogOpen(true)
  }, [data])

  const handleSave = useCallback(() => {
    setDialogOpen(true)
  }, [])

  if (isLoading) return <JobDetailSkeleton />
  if (isError || !data) return <JobNotFound />

  const { job } = data
  const postedAgo = formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })

  const jobForDialog = job as Job

  return (
    <>
      <JobDetailActionBar job={jobForDialog} onApply={handleApply} onSave={handleSave} />

      <motion.div
        data-testid="job-detail"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-3xl px-4 py-8 space-y-8"
      >
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to jobs
        </Link>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={job.source} />
            {job.remote && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Globe className="size-3" />
                Remote
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-foreground leading-tight">{job.title}</h1>
          <p className="text-base font-semibold text-muted-foreground">{job.company}</p>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {job.location}
              </span>
            )}
            {job.salaryRange && (
              <span className="flex items-center gap-1">
                <DollarSign className="size-3.5" />
                {job.salaryRange}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {postedAgo}
            </span>
          </div>
        </div>

        <AtsScorePanel atsScore={job.atsScore} />

        {job.requirements.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
              Requirements
            </h2>
            <ul className="space-y-2">
              {job.requirements.map((req, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {req}
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.techStack.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
              Tech Stack
            </h2>
            <TechStackTags techStack={job.techStack} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
            Description
          </h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
            {job.description}
          </pre>
        </section>
      </motion.div>

      <ApplyDialog
        job={jobForDialog}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
