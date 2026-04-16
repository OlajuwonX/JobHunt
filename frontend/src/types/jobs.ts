export type JobSource =
  | 'greenhouse'
  | 'lever'
  | 'remotive'
  | 'arbeitnow'
  | 'jobicy'
  | 'themuse'
  | 'weworkremotely'
  | 'jobberman'
  | 'myjobmag'
  | 'hotnigerianjobs'
  | 'ngcareers'

export type JobCategory =
  | 'tech'
  | 'finance'
  | 'sales'
  | 'marketing'
  | 'healthcare'
  | 'design'
  | 'operations'
  | 'hr'
  | 'legal'
  | 'education'
  | 'other'

export interface Job {
  id: string
  title: string
  company: string
  source: JobSource
  location: string | null
  remote: boolean
  description: string
  requirements: string[]
  techStack: string[]
  applyUrl: string
  sourceUrl: string | null
  salaryRange: string | null
  postedAt: string
  createdAt: string
  matchScore?: number
  category: JobCategory
  country: string
}

export interface JobDetail extends Job {
  atsScore: {
    score: number
    suggestions: string[]
    scoredAt: string
  } | null
}

export interface JobFilters {
  page?: number
  limit?: number
  source?: string
  remote?: boolean
  q?: string
  category?: string
  country?: string
  since?: string
  minScore?: number
}

export interface JobsResponse {
  items: Job[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface JobDetailResponse {
  job: JobDetail
  application: {
    id: string
    status: string
    appliedAt: string
  } | null
}
