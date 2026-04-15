/**
 * The Muse API Adapter (src/integrations/api/themuse.ts)
 *
 * The Muse (themuse.com) is a career platform known for company culture profiles
 * and job listings. They offer a free tier API that allows up to 500 requests/day.
 *
 * AUTHENTICATION:
 * The Muse requires an API key. Obtain a free key at:
 *   https://www.themuse.com/developers/api/v2
 * Set it in your .env file as: THE_MUSE_API_KEY=your_key_here
 *
 * If the key is not configured, this adapter skips gracefully (returns []).
 * This is safe behavior — the cron will just use data from other sources.
 *
 * PAGINATION:
 * The Muse uses 0-based page numbers (page=0 is the first page).
 * Each page returns ~20 jobs. We fetch pages 0–9 = 200 jobs maximum.
 * We stay conservative (200 max) to avoid hitting the 500/day free tier limit.
 *
 * API ENDPOINT:
 *   GET https://www.themuse.com/api/public/jobs?page={n}&descending=true&api_key={key}
 *
 * KEY RESPONSE FIELDS:
 *   id: numeric job ID
 *   name: job title
 *   company.name: employer name
 *   locations: array of { name: "City, Country" }
 *   publication_date: ISO 8601 datetime
 *   refs.landing_page: URL to the job listing
 *   contents: HTML job description
 *   categories: array of { name: "Category" } (job type/level)
 *   levels: array of { name: "Level" } (e.g. "Mid Level", "Senior Level")
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'
import { sleep } from '../../utils/sleep'

const MUSE_BASE = 'https://www.themuse.com/api/public/jobs'
const PAGES_TO_FETCH = 10 // Pages 0-9 = max 200 jobs (stay under 500/day free tier)

interface MuseJob {
  id: number
  name: string // job title
  company: {
    id: number
    name: string
  }
  locations: Array<{ name: string }>
  publication_date: string // ISO 8601
  refs: {
    landing_page: string // URL to the job listing
  }
  contents?: string // HTML description
  categories?: Array<{ name: string }>
  levels?: Array<{ name: string }>
}

interface MuseResponse {
  results: MuseJob[]
  total: number
  page: number
  page_count: number
}

export const themuseAdapter: JobAdapter = {
  source: 'themuse',

  async fetch(): Promise<RawJob[]> {
    const apiKey = process.env.THE_MUSE_API_KEY

    // Graceful skip if API key is not configured.
    // This is intentional — The Muse is optional. Other sources provide coverage.
    if (!apiKey) {
      console.info('[TheMuse] THE_MUSE_API_KEY not set — skipping TheMuse adapter.')
      return []
    }

    const allJobs: RawJob[] = []

    for (let page = 0; page < PAGES_TO_FETCH; page++) {
      try {
        const response = await axios.get<MuseResponse>(MUSE_BASE, {
          params: {
            page,
            descending: true, // newest first
            api_key: apiKey,
          },
          timeout: 8000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.results ?? []

        // Stop paginating if we've reached the last page
        if (jobs.length === 0) {
          console.log(`[TheMuse] No jobs on page ${page}, stopping pagination.`)
          break
        }

        for (const job of jobs) {
          if (!job.name || !job.company?.name || !job.refs?.landing_page) continue

          const description = job.contents ? stripHtml(job.contents) : 'No description provided.'

          // Extract location — The Muse provides an array; take the first one
          const location = job.locations?.[0]?.name ?? null
          const isRemote =
            location?.toLowerCase().includes('remote') ||
            job.name.toLowerCase().includes('remote') ||
            false

          allJobs.push({
            title: job.name,
            company: job.company.name,
            location,
            remote: isRemote,
            description,
            applyUrl: job.refs.landing_page,
            sourceUrl: job.refs.landing_page,
            postedAt: new Date(job.publication_date),
            source: 'themuse',
            externalId: String(job.id),
          })
        }

        console.log(`[TheMuse] Fetched ${jobs.length} jobs from page ${page}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[TheMuse] Failed to fetch page ${page}: ${message}`)
        // On a 403 (bad API key), there's no point continuing — stop paginating
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          console.warn('[TheMuse] Got 403 — API key may be invalid or expired.')
          break
        }
      }

      // Be respectful to The Muse — 500ms between pages
      await sleep(500)
    }

    if (allJobs.length === 0) {
      console.warn('[TheMuse] Zero jobs fetched. Check your API key.')
    }

    console.log(`[TheMuse] Total jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
