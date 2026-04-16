import { useQuery } from '@tanstack/react-query'
import { getJob } from '../../../services/jobs.service'

export const useJob = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
    staleTime: 10 * 60 * 1000,
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
  })
}
