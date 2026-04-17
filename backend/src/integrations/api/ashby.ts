/**
 * Ashby ATS Adapter (src/integrations/api/ashby.ts)
 *
 * Ashby (ashbyhq.com) is a modern ATS (Applicant Tracking System) widely adopted
 * by tech startups that previously used Lever. Many high-profile companies migrated
 * to Ashby: Notion, OpenAI, Perplexity, Ramp, Supabase, Replit, Cursor, etc.
 *
 * This adapter replaces the Lever adapter, whose v0 public API is no longer functional
 * (all company slugs return 404 as of 2026 — Lever has deprecated public API access).
 *
 * HOW THE ASHBY API WORKS:
 * Each company has a job board at:
 *   GET https://api.ashbyhq.com/posting-api/job-board/{slug}
 * No API key required. Returns all active postings as JSON.
 *
 * KEY RESPONSE FIELDS:
 *   id: job UUID
 *   title: job title
 *   location: city/country string
 *   workplaceType: "Remote" | "OnSite" | "Hybrid"
 *   isRemote: boolean (sometimes null — fall back to workplaceType)
 *   publishedAt: ISO 8601 datetime
 *   jobUrl: the Ashby-hosted listing URL
 *   applyUrl: direct application URL
 *   descriptionHtml: HTML job description
 *   department / team: category info
 *
 * COMPANY NAME:
 * Ashby doesn't include company name in the job response — we derive it from the slug.
 * We title-case the slug (e.g. "deel" → "Deel", "open-ai" → "Open AI").
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'
import { sleep } from '../../utils/sleep'
import ashbyCompanies from '../data/ashby-companies.json'

const ASHBY_BASE = 'https://api.ashbyhq.com/posting-api/job-board'

interface AshbyJob {
  id: string
  title: string
  department?: string
  team?: string
  employmentType?: string
  location?: string
  isRemote?: boolean | null
  workplaceType?: string | null // "Remote" | "OnSite" | "Hybrid"
  publishedAt: string
  jobUrl: string
  applyUrl: string
  descriptionHtml?: string
}

interface AshbyResponse {
  jobs: AshbyJob[]
}

/**
 * Converts a slug to a display company name.
 * "deel" → "Deel"
 * "open-ai" → "Open Ai" (close enough for display)
 */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const ashbyAdapter: JobAdapter = {
  source: 'ashby',

  async fetch(): Promise<RawJob[]> {
    const allJobs: RawJob[] = []

    for (const slug of ashbyCompanies) {
      try {
        const url = `${ASHBY_BASE}/${slug}`

        const response = await axios.get<AshbyResponse>(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.jobs ?? []
        const companyName = slugToName(slug)

        for (const job of jobs) {
          if (!job.title || !job.jobUrl) continue

          const description = job.descriptionHtml
            ? stripHtml(job.descriptionHtml)
            : 'No description provided.'

          const location = job.location ?? null
          const isRemote =
            job.isRemote === true ||
            job.workplaceType?.toLowerCase() === 'remote' ||
            location?.toLowerCase().includes('remote') ||
            false

          allJobs.push({
            title: job.title,
            company: companyName,
            location,
            remote: isRemote,
            description,
            applyUrl: job.applyUrl || job.jobUrl,
            sourceUrl: job.jobUrl,
            postedAt: new Date(job.publishedAt),
            source: 'ashby',
            externalId: job.id,
          })
        }

        console.log(`[Ashby] ${slug}: ${jobs.length} jobs`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Ashby] Failed to fetch jobs for "${slug}": ${message}`)
      }

      await sleep(300)
    }

    if (allJobs.length === 0) {
      console.warn('[Ashby] Zero jobs fetched across all companies. Check slugs.')
    }

    console.log(`[Ashby] Fetched ${allJobs.length} jobs from ${ashbyCompanies.length} companies.`)
    return allJobs
  },
}
