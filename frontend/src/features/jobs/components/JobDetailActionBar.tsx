'use client'

import { ExternalLink, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MatchScoreBadge } from './JobCardBadges'
import type { Job } from '@/types/jobs'

interface JobDetailActionBarProps {
  job: Job
  onApply: () => void
  onSave: () => void
}

export function JobDetailActionBar({ job, onApply, onSave }: JobDetailActionBarProps) {
  return (
    <div
      className={cn(
        'sticky top-14 z-10 bg-background/80 backdrop-blur-sm border-b border-border',
        'py-3 px-4'
      )}
    >
      <div className="mx-auto max-w-3xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
          {job.matchScore !== undefined && <MatchScoreBadge score={job.matchScore} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onSave}>
            <Bookmark className="size-3.5" />
            Save
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onApply}>
            Apply
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
