/**
 * Jobicy API Adapter (src/integrations/api/jobicy.ts)
 *
 * Jobicy (jobicy.com) is a remote job board with a free public API.
 * Jobs are organized by industry. We fetch multiple industries to maximize coverage.
 *
 * WHY INDUSTRY-BASED FETCHING?
 * Jobicy's API doesn't have a single "all jobs" endpoint at the free tier.
 * By fetching each industry separately, we get comprehensive coverage
 * across different job types: engineering, design, sales, finance, etc.
 *
 * API ENDPOINT:
 *   GET https://jobicy.com/api/v2/remote-jobs?count=50&industry={industry}
 *
 * KEY RESPONSE FIELDS:
 *   id: unique job ID (for deduplication across industry fetches)
 *   url: the Jobicy listing URL
 *   jobTitle: the job title
 *   companyName: employer name
 *   jobGeo: location / geography requirement (e.g. "Worldwide", "USA Only")
 *   jobIndustry: category array
 *   jobType: employment type array (e.g. ["full-time"])
 *   pubDate: ISO 8601 publication date
 *   jobDescription: HTML description — must be stripped
 *   annualSalaryMin/annualSalaryMax: salary range (sometimes present)
 *   salaryCurrency: currency for salary values
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'

const JOBICY_BASE = 'https://jobicy.com/api/v2/remote-jobs'

// Industries to fetch from Jobicy
const INDUSTRIES = ['engineering', 'sales', 'finance', 'design', 'marketing', 'hr']

// TypeScript interface matching Jobicy's API response
interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  companyLogo?: string
  jobGeo: string // e.g. "Worldwide", "USA Only", "Remote"
  jobIndustry: string[]
  jobType: string[]
  pubDate: string // ISO 8601 date
  jobDescription: string // HTML
  annualSalaryMin?: number
  annualSalaryMax?: number
  salaryCurrency?: string
}

interface JobicyResponse {
  status: string
  requestsPerDay: number
  results: JobicyJob[]
}

/**
 * Formats a salary range string from Jobicy's min/max/currency fields.
 * Returns null if salary info is not available.
 */
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
    // Deduplicate across industries using a Map keyed by Jobicy's job ID
    const jobMap = new Map<number, RawJob>()

    for (const industry of INDUSTRIES) {
      try {
        const response = await axios.get<JobicyResponse>(JOBICY_BASE, {
          params: { count: 50, industry },
          timeout: 8000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.results ?? []

        for (const job of jobs) {
          // Skip duplicates (same job appearing in multiple industries)
          if (jobMap.has(job.id)) continue
          if (!job.jobTitle || !job.companyName || !job.url) continue

          const description = stripHtml(job.jobDescription || '')

          jobMap.set(job.id, {
            title: job.jobTitle,
            company: job.companyName,
            location: job.jobGeo || 'Remote',
            remote: true, // Jobicy is remote-only
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

        console.log(`[Jobicy] Fetched ${jobs.length} jobs for industry: ${industry}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Jobicy] Failed to fetch industry "${industry}": ${message}`)
      }
    }

    const allJobs = Array.from(jobMap.values())

    if (allJobs.length === 0) {
      console.warn('[Jobicy] Zero jobs fetched across all industries.')
    }

    console.log(`[Jobicy] Total unique jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
