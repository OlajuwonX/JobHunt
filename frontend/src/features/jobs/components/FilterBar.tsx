'use client'

import { useRef, useCallback, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SOURCE_LABELS, CATEGORY_LABELS } from '@/lib/jobs'
import type { JobFilters } from '@/types/jobs'

const SOURCES = Object.keys(SOURCE_LABELS) as Array<keyof typeof SOURCE_LABELS>
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>

interface FilterBarProps {
  filters: JobFilters
  onFilterChange: (key: string, value: string | undefined) => void
}

type RemoteMode = 'all' | 'remote' | 'onsite'

function getRemoteMode(remote: boolean | undefined): RemoteMode {
  if (remote === true) return 'remote'
  if (remote === false) return 'onsite'
  return 'all'
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track the last seen external value so we can sync during render without a useEffect (React docs pattern for "adjusting state on prop change").
  const [prevQ, setPrevQ] = useState(filters.q)
  const [searchValue, setSearchValue] = useState(filters.q ?? '')

  if (prevQ !== filters.q) {
    setPrevQ(filters.q)
    setSearchValue(filters.q ?? '')
  }

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchValue(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onFilterChange('q', value || undefined)
      }, 400)
    },
    [onFilterChange]
  )

  const handleRemoteToggle = useCallback(
    (mode: RemoteMode) => {
      if (mode === 'all') onFilterChange('remote', undefined)
      else if (mode === 'remote') onFilterChange('remote', 'true')
      else onFilterChange('remote', 'false')
    },
    [onFilterChange]
  )

  const remoteMode = getRemoteMode(filters.remote)

  return (
    <div
      data-testid="filter-bar"
      className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search jobs, companies..."
            value={searchValue}
            onChange={handleSearch}
            className="pl-8 h-8 text-sm w-full"
          />
        </div>

        <Select
          value={filters.source ?? ''}
          onValueChange={(val) => onFilterChange('source', val || undefined)}
        >
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Sources</SelectItem>
            {SOURCES.map((src) => (
              <SelectItem key={src} value={src}>
                {SOURCE_LABELS[src]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.category ?? ''}
          onValueChange={(val) => onFilterChange('category', val || undefined)}
        >
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.country ?? ''}
          onValueChange={(val) => onFilterChange('country', val || undefined)}
        >
          <SelectTrigger className="h-8 w-35 text-sm">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Countries</SelectItem>
            <SelectItem value="nigeria">Nigeria</SelectItem>
            <SelectItem value="global">Global</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-lg border border-input overflow-hidden">
          {(
            [
              { mode: 'all', label: 'All' },
              { mode: 'remote', label: 'Remote' },
              { mode: 'onsite', label: 'On-site' },
            ] as Array<{ mode: RemoteMode; label: string }>
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleRemoteToggle(mode)}
              className={cn(
                'h-8 px-3 text-xs font-medium transition-colors',
                remoteMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
