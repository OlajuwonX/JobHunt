import { useQuery } from '@tanstack/react-query'
import { getJob } from '../../../services/jobs.service'

export const useJob = (id: string) => {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
    staleTime: 10 * 60 * 1000,
    enabled: !!id,
  })
}
