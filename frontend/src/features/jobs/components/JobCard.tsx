'use client'

import { formatDistanceToNow } from 'date-fns'
import { Bookmark, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SourceBadge, MatchScoreBadge, LocationChips } from './JobCardBadges'
import { TechStackTags } from './TechStackTags'
import type { Job } from '@/types/jobs'

interface JobCardProps {
  job: Job
  onView: (job: Job) => void
  onApply: (job: Job) => void
  onSave: (job: Job) => void
}

export function JobCard({ job, onView, onApply, onSave }: JobCardProps) {
  const postedAgo = formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })

  return (
    <div
      data-testid="job-card"
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10',
        'transition-shadow duration-200 hover:shadow-md hover:ring-foreground/20'
      )}
    >
      <button
        type="button"
        onClick={() => onView(job)}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View ${job.title} at ${job.company}`}
      />

      <div className="flex items-start justify-between gap-2">
        <SourceBadge source={job.source} />
        {job.matchScore !== undefined && <MatchScoreBadge score={job.matchScore} />}
      </div>

      <div className="space-y-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
          {job.title}
        </h3>
        <p className="text-xs font-medium text-muted-foreground">{job.company}</p>
        <LocationChips location={job.location} remote={job.remote} />
      </div>

      <TechStackTags techStack={job.techStack} />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {job.salaryRange ? (
          <span className="font-medium text-foreground">{job.salaryRange}</span>
        ) : (
          <span />
        )}
        <span>{postedAgo}</span>
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="relative z-10 flex items-center gap-1.5 text-xs"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSave(job)
          }}
        >
          <Bookmark className="size-3.5" />
          Save
        </Button>
        <Button
          size="sm"
          className="relative z-10 flex items-center gap-1.5 text-xs"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onApply(job)
          }}
        >
          Apply
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
