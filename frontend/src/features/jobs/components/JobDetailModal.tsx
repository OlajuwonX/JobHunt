'use client'

import { useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Bookmark, MapPin, DollarSign, Calendar, Globe } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AtsScorePanel } from './AtsScorePanel'
import { TechStackTags } from './TechStackTags'
import { SourceBadge, MatchScoreBadge } from './JobCardBadges'
import { JobDetailSkeleton } from './JobDetailSkeleton'
import { useJob } from '../hooks/useJob'

interface JobDetailModalProps {
  jobId: string | null
  open: boolean
  onClose: () => void
  onApply: (applyUrl: string) => void
  onSave: () => void
}

export function JobDetailModal({ jobId, open, onClose, onApply, onSave }: JobDetailModalProps) {
  const { data, isLoading, isError } = useJob(jobId ?? '', { enabled: open && !!jobId })

  const job = data?.job

  const handleApply = useCallback(() => {
    if (!job) return
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    onApply(job.applyUrl)
  }, [job, onApply])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl! max-h-[90vh] flex flex-col p-0 gap-0">
        {isLoading || !job ? (
          <div className="p-6">
            {isError ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Could not load job details.
              </p>
            ) : (
              <JobDetailSkeleton />
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge source={job.source} />
                    {job.remote && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Globe className="size-3" />
                        Remote
                      </span>
                    )}
                    {job.matchScore !== undefined && <MatchScoreBadge score={job.matchScore} />}
                  </div>
                  <DialogTitle className="text-lg font-bold leading-snug text-foreground">
                    {job.title}
                  </DialogTitle>
                  <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {job.location}
                      </span>
                    )}
                    {job.salaryRange && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="size-3" />
                        {job.salaryRange}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onSave}>
                  <Bookmark className="size-3.5" />
                  Save
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleApply}>
                  Apply
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <AtsScorePanel atsScore={job.atsScore} />

              {job.techStack.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wide">
                    Skills
                  </h2>
                  <TechStackTags techStack={job.techStack} />
                </section>
              )}

              {job.requirements.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wide">
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

              <section>
                <h2 className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wide">
                  Description
                </h2>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:mb-3 [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
