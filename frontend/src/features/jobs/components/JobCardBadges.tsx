'use client'

import { MapPin, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_COLORS, SOURCE_LABELS } from '@/lib/jobs'
import type { Job } from '@/types/jobs'

interface SourceBadgeProps {
  source: Job['source']
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const colorClass = SOURCE_COLORS[source] ?? 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  )
}

interface MatchScoreBadgeProps {
  score: number
}

export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      {score}% match
    </span>
  )
}

interface LocationChipsProps {
  location: string | null
  remote: boolean
}

export function LocationChips({ location, remote }: LocationChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {location && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3" />
          {location}
        </span>
      )}
      {remote && (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Globe className="size-3" />
          Remote
        </span>
      )}
    </div>
  )
}
