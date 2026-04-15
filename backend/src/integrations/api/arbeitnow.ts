/**
 * Arbeitnow API Adapter (src/integrations/api/arbeitnow.ts)
 *
 * Arbeitnow (arbeitnow.com) is an European job board focused on visa-sponsored,
 * English-speaking jobs. They provide a free public API.
 *
 * PAGINATION:
 * Arbeitnow paginates results. Each page returns ~25 jobs.
 * We fetch 5 pages for ~125 jobs per run.
 * More pages = more coverage but slower cron run — 5 is a good balance.
 *
 * API ENDPOINT:
 *   GET https://arbeitnow.com/api/job-board-api?page={n}
 *
 * KEY RESPONSE FIELDS:
 *   slug: unique job identifier (used as externalId)
 *   company_name: employer name
 *   title: job title
 *   description: HTML description — we must strip this
 *   tags: array of skill/category tags
 *   job_types: array of employment types ["full_time", "contract"]
 *   location: city/country string
 *   remote: boolean
 *   url: the job listing URL
 *   created_at: Unix timestamp (seconds, not milliseconds)
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'
import { sleep } from '../../utils/sleep'

const ARBEITNOW_URL = 'https://arbeitnow.com/api/job-board-api'
const PAGES_TO_FETCH = 5

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string // HTML
  tags: string[]
  job_types: string[]
  location: string
  remote: boolean
  url: string
  created_at: number // Unix timestamp in SECONDS (not milliseconds)
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[]
  links: {
    first: string
    last: string
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export const arbeitnowAdapter: JobAdapter = {
  source: 'arbeitnow',

  async fetch(): Promise<RawJob[]> {
    const allJobs: RawJob[] = []

    for (let page = 1; page <= PAGES_TO_FETCH; page++) {
      try {
        const response = await axios.get<ArbeitnowResponse>(ARBEITNOW_URL, {
          params: { page },
          timeout: 8000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.data ?? []

        // Stop paginating if this page returned no results
        if (jobs.length === 0) {
          console.log(`[Arbeitnow] No jobs on page ${page}, stopping pagination.`)
          break
        }

        for (const job of jobs) {
          if (!job.title || !job.company_name || !job.url) continue

          const description = stripHtml(job.description || '')

          allJobs.push({
            title: job.title,
            company: job.company_name,
            location: job.location || null,
            remote: job.remote ?? false,
            description: description || 'No description provided.',
            applyUrl: job.url,
            sourceUrl: job.url,
            // Arbeitnow uses Unix seconds — multiply by 1000 to convert to milliseconds for Date()
            postedAt: new Date(job.created_at * 1000),
            source: 'arbeitnow',
            externalId: job.slug,
          })
        }

        console.log(`[Arbeitnow] Fetched ${jobs.length} jobs from page ${page}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Arbeitnow] Failed to fetch page ${page}: ${message}`)
        // Don't break — try the next page
      }

      // Polite delay between page requests
      await sleep(500)
    }

    if (allJobs.length === 0) {
      console.warn('[Arbeitnow] Zero jobs fetched across all pages.')
    }

    console.log(`[Arbeitnow] Total jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
