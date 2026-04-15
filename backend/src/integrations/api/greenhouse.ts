/**
 * Greenhouse API Adapter (src/integrations/api/greenhouse.ts)
 *
 * Greenhouse is a popular applicant tracking system (ATS) used by tech companies.
 * Companies publish their job boards via the Greenhouse API — no API key required.
 *
 * HOW THE GREENHOUSE API WORKS:
 * Each company has a "slug" (URL-friendly name, e.g. "stripe", "airbnb").
 * The public API endpoint is:
 *   GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *
 * The ?content=true param tells Greenhouse to include the full job description.
 * Without it, you only get metadata (title, location) — no description.
 *
 * WHY LOOP OVER COMPANIES?
 * Greenhouse doesn't have a single "all jobs" endpoint. Each company is separate.
 * We maintain a list of 40+ company slugs and fetch each one individually.
 * This is a common approach for Greenhouse-based job aggregation.
 *
 * RATE LIMITING STRATEGY:
 * We sleep 300ms between each company to avoid looking like a bot.
 * Even with 40 companies × 300ms = 12 seconds total — acceptable for a nightly cron.
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'
import { sleep } from '../../utils/sleep'

// Load company slugs from the JSON data file
// Using require() because JSON imports need assertion flags in ESM — require is simpler
import greehouseCompanies from '../data/greenhouse-companies.json'

const GREENHOUSE_BASE = 'https://boards-api.greenhouse.io/v1/boards'

// TypeScript interface matching what Greenhouse actually returns in the API response
interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  // content is the full HTML description — only present when ?content=true
  content?: string
  absolute_url: string // the Greenhouse job listing URL
  updated_at: string // ISO 8601 datetime string
  departments?: Array<{ name: string }>
  offices?: Array<{ name: string }>
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
  meta?: { total: number }
}

export const greenhouseAdapter: JobAdapter = {
  source: 'greenhouse',

  async fetch(): Promise<RawJob[]> {
    const allJobs: RawJob[] = []

    for (const slug of greehouseCompanies) {
      try {
        const url = `${GREENHOUSE_BASE}/${slug}/jobs?content=true`

        const response = await axios.get<GreenhouseResponse>(url, {
          timeout: 8000, // 8 seconds — if the company's board is slow, skip it
          headers: {
            // Identify ourselves politely — some servers reject requests without a User-Agent
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.jobs ?? []

        for (const job of jobs) {
          // Skip jobs with no title or apply URL — they're not useful
          if (!job.title || !job.absolute_url) continue

          // Strip HTML from the content field — Greenhouse returns full HTML descriptions
          const description = job.content ? stripHtml(job.content) : 'No description provided.'

          allJobs.push({
            title: job.title,
            company: slug.charAt(0).toUpperCase() + slug.slice(1), // Capitalize the slug
            location: job.location?.name ?? null,
            remote: job.location?.name?.toLowerCase().includes('remote') ?? false,
            description,
            applyUrl: job.absolute_url,
            sourceUrl: job.absolute_url,
            postedAt: new Date(job.updated_at),
            source: 'greenhouse',
            externalId: String(job.id),
          })
        }
      } catch (error) {
        // One company failing should NEVER stop us from fetching the others.
        // This catch is intentionally inside the loop.
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Greenhouse] Failed to fetch jobs for "${slug}": ${message}`)
        // Continue to the next company
      }

      // Polite delay between companies — avoids triggering Greenhouse's rate limiter
      await sleep(300)
    }

    if (allJobs.length === 0) {
      console.warn('[Greenhouse] Zero jobs fetched across all companies. Check network or slugs.')
    }

    console.log(
      `[Greenhouse] Fetched ${allJobs.length} jobs from ${greehouseCompanies.length} companies.`
    )
    return allJobs
  },
}
