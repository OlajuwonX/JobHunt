import { api } from '../lib/api'
import type { JobFilters, JobsResponse, JobDetailResponse } from '../types/jobs'

export const getJobs = (filters: JobFilters): Promise<JobsResponse> =>
  api.get('/jobs', { params: filters }).then((r) => r.data.data)

export const getJob = (id: string): Promise<JobDetailResponse> =>
  api.get(`/jobs/${id}`).then((r) => r.data.data)

export const createApplication = (data: {
  jobId: string
  status: 'applied' | 'saved'
}): Promise<{ id: string; status: string; appliedAt: string }> =>
  api.post('/applications', data).then((r) => r.data.data)
