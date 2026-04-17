'use client'

import { formatDistanceToNow } from 'date-fns'
import { Bookmark, ExternalLink } from 'lucide-react'
import {
  LinearCard,
  LinearCardTitle,
  LinearCardBadge,
  LinearCardFooter,
  LinearCardButton,
} from './LinearCard'
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
    <LinearCard data-testid="job-card">
      {/* Invisible click target for viewing job detail */}
      <button
        type="button"
        onClick={() => onView(job)}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View ${job.title} at ${job.company}`}
      />

      {/* Source + match score row */}
      <div className="flex items-center justify-between gap-2">
        <SourceBadge source={job.source} />
        {job.matchScore !== undefined && <MatchScoreBadge score={job.matchScore} />}
      </div>

      {/* Title + company + location */}
      <div className="space-y-0.5">
        <LinearCardTitle>{job.title}</LinearCardTitle>
        <p className="text-xs font-medium text-muted-foreground truncate">{job.company}</p>
        <LocationChips location={job.location} remote={job.remote} />
      </div>

      {/* Tech stack tags */}
      <TechStackTags techStack={job.techStack} />

      {/* Salary + posted date */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {job.salaryRange ? (
          <span className="font-medium text-foreground truncate max-w-[55%]">{job.salaryRange}</span>
        ) : (
          <span />
        )}
        <span className="shrink-0">{postedAgo}</span>
      </div>

      {/* Actions */}
      <LinearCardFooter>
        <LinearCardButton
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSave(job)
          }}
        >
          <Bookmark className="size-3.5" />
          Save
        </LinearCardButton>
        <LinearCardButton
          variant="default"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onApply(job)
          }}
        >
          Apply
          <ExternalLink className="size-3.5" />
        </LinearCardButton>
      </LinearCardFooter>
    </LinearCard>
  )
}

// Re-export LinearCard primitives for convenience
export { LinearCard, LinearCardTitle, LinearCardBadge, LinearCardFooter, LinearCardButton }
