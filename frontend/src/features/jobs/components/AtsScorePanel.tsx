'use client'

import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { atsColor } from '@/lib/jobs'
import type { JobDetail } from '@/types/jobs'

interface AtsScorePanelProps {
  atsScore: JobDetail['atsScore']
}

export function AtsScorePanel({ atsScore }: AtsScorePanelProps) {
  if (!atsScore) {
    return (
      <div className="rounded-xl bg-muted/50 border border-border p-5">
        <p className="text-sm font-semibold text-foreground mb-1">ATS Score</p>
        <p className="text-sm text-muted-foreground">
          Scoring pending &mdash; save this job to trigger AI scoring.
        </p>
      </div>
    )
  }

  const { score, suggestions, scoredAt } = atsScore
  const colorClass = atsColor(score)
  const scoredAgo = formatDistanceToNow(new Date(scoredAt), { addSuffix: true })

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">ATS Score</p>
        <span className="text-xs text-muted-foreground">Scored {scoredAgo}</span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold',
            colorClass
          )}
        >
          {score}
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', colorClass.split(' ')[0])}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {score >= 70
              ? 'Strong match — you are well-suited for this role'
              : score >= 40
                ? 'Moderate match — some gaps to address'
                : 'Weak match — significant gaps detected'}
          </p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wide">
            Suggestions
          </p>
          <ul className="space-y-1.5">
            {suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50 translate-y-1" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
