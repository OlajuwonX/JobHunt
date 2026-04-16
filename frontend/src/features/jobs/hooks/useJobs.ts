import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getJobs } from '../../../services/jobs.service'
import type { JobFilters } from '../../../types/jobs'

export const useJobs = (filters: JobFilters) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => getJobs(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
