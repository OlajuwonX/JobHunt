import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createApplication } from '../../../services/jobs.service'

export const useApplyJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}
