'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { JobsResponse } from '@/types/jobs'

interface PaginationProps {
  pagination: JobsResponse['pagination']
  onPageChange: (page: number) => void
  onPrefetch: (page: number) => void
}

function buildPageRange(current: number, total: number): Array<number | '...'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const range: Array<number | '...'> = []

  range.push(1)

  if (current > 4) range.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) range.push(i)

  if (current < total - 3) range.push('...')

  range.push(total)

  return range
}

export function Pagination({ pagination, onPageChange, onPrefetch }: PaginationProps) {
  const { page, totalPages, hasPrev, hasNext } = pagination

  if (totalPages <= 1) return null

  const pages = buildPageRange(page, totalPages)

  return (
    <nav className="flex items-center justify-center gap-1 py-6" aria-label="Pagination">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {pages.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground select-none">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="icon-sm"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn('min-w-8 text-xs', p === page && 'pointer-events-none')}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon-sm"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        onMouseEnter={() => hasNext && onPrefetch(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}
