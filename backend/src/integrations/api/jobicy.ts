/**
 * Jobicy API Adapter (src/integrations/api/jobicy.ts)
 *
 * Jobicy (jobicy.com) is a remote job board with a free public API.
 *
 * API ENDPOINT:
 *   GET https://jobicy.com/api/v2/remote-jobs?count=50&page={n}
 *
 * NOTE: The industry filter parameter (?industry=) was removed because
 * Jobicy changed their accepted industry slug values and now returns 400 errors
 * for the slugs that previously worked (engineering, sales, finance, design, hr).
 * Fetching all jobs with pagination is more reliable and gives better coverage.
 *
 * KEY RESPONSE FIELDS:
 *   id: unique job ID
 *   url: the Jobicy listing URL
 *   jobTitle: the job title
 *   companyName: employer name
 *   jobGeo: location / geography (e.g. "Worldwide", "USA Only")
 *   jobType: employment type array (e.g. ["Full-Time"])
 *   pubDate: ISO 8601 publication date
 *   jobDescription: HTML description — must be stripped
 *   annualSalaryMin/annualSalaryMax: salary range (sometimes present)
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'

const JOBICY_BASE = 'https://jobicy.com/api/v2/remote-jobs'
// Jobicy free API does not support pagination (?page= returns 400).
// Max count allowed per request appears to be 50 (their documented limit).
const JOBS_PER_REQUEST = 50

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  companyLogo?: string
  jobGeo: string
  jobIndustry: string[]
  jobType: string[]
  pubDate: string
  jobDescription: string
  annualSalaryMin?: number
  annualSalaryMax?: number
  salaryCurrency?: string
}

interface JobicyResponse {
  apiVersion: string
  jobCount: number
  jobs: JobicyJob[] // NOTE: key is "jobs" not "results"
}

function formatSalary(min?: number, max?: number, currency?: string): string | undefined {
  if (!min && !max) return undefined
  const symbol = currency === 'USD' ? '$' : (currency ?? '')
  if (min && max) return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()}`
  if (min) return `From ${symbol}${min.toLocaleString()}`
  if (max) return `Up to ${symbol}${max.toLocaleString()}`
  return undefined
}

export const jobicyAdapter: JobAdapter = {
  source: 'jobicy',

  async fetch(): Promise<RawJob[]> {
    const allJobs: RawJob[] = []

    try {
      // Jobicy free API: single request, no pagination (?page= returns 400)
      const response = await axios.get<JobicyResponse>(JOBICY_BASE, {
        params: { count: JOBS_PER_REQUEST },
        timeout: 10000,
        headers: {
          'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
        },
      })

      const jobs = response.data?.jobs ?? []

      for (const job of jobs) {
        if (!job.jobTitle || !job.companyName || !job.url) continue

        const description = stripHtml(job.jobDescription || '')

        allJobs.push({
          title: job.jobTitle,
          company: job.companyName,
          location: job.jobGeo || 'Remote',
          remote: true,
          description: description || 'No description provided.',
          applyUrl: job.url,
          sourceUrl: job.url,
          postedAt: new Date(job.pubDate),
          source: 'jobicy',
          externalId: String(job.id),
          logoUrl: job.companyLogo,
          salaryRange: formatSalary(job.annualSalaryMin, job.annualSalaryMax, job.salaryCurrency),
        })
      }

      console.log(`[Jobicy] Fetched ${allJobs.length} jobs.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[Jobicy] Failed to fetch jobs: ${message}`)
    }

    if (allJobs.length === 0) {
      console.warn('[Jobicy] Zero jobs fetched. Check API endpoint.')
    }

    console.log(`[Jobicy] Total jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
