/**
 * Remotive API Adapter (src/integrations/api/remotive.ts)
 *
 * Remotive (remotive.com) is a job board that lists ONLY remote jobs.
 * They provide a free public API — no authentication required.
 *
 * WHY MULTIPLE CATEGORIES?
 * Remotive organizes jobs by category. A single API call only returns jobs in one
 * category. To cover all job types (not just tech), we fetch multiple categories
 * and merge the results. This gives us marketing, finance, design, and support
 * jobs in addition to software engineering.
 *
 * DEDUPLICATION ACROSS CATEGORIES:
 * A job might be listed under both "software-dev" and "data" categories.
 * We deduplicate by Remotive's internal ID using a Set to avoid counting
 * the same job twice. This is an in-memory dedup; the final DB dedup
 * uses jobHash via upsert.
 *
 * ALL REMOTIVE JOBS ARE REMOTE BY DEFINITION:
 * The entire platform is remote-only, so we hardcode remote=true for all Remotive jobs.
 *
 * API DOCS: https://remotive.com/api/remote-jobs
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'

const REMOTIVE_BASE = 'https://remotive.com/api/remote-jobs'

// All job categories we fetch from Remotive.
// Slugs verified from: GET https://remotive.com/api/remote-jobs/categories
// Previous slugs (software-dev, devops-sysadmin, etc.) no longer work after Remotive's 2024 redesign.
const CATEGORIES = [
  'software-development',
  'devops',
  'design',
  'finance',
  'marketing',
  'customer-service',
  'product',
  'data',
  'sales-business',
  'human-resources',
  'ai-ml',
  'writing',
]

// TypeScript interface matching Remotive's API response
interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo?: string
  category: string
  job_type: string // "full_time", "contract", "part_time"
  publication_date: string // ISO 8601 date string
  candidate_required_location: string
  salary?: string
  description: string // HTML description
}

interface RemotiveResponse {
  job_count: number
  jobs: RemotiveJob[]
}

export const remotiveAdapter: JobAdapter = {
  source: 'remotive',

  async fetch(): Promise<RawJob[]> {
    // Use a Map keyed by Remotive's job ID to deduplicate across categories
    const jobMap = new Map<number, RawJob>()

    for (const category of CATEGORIES) {
      try {
        const response = await axios.get<RemotiveResponse>(REMOTIVE_BASE, {
          params: { category, limit: 100 },
          timeout: 8000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        const jobs = response.data?.jobs ?? []

        for (const job of jobs) {
          // Skip if we've already seen this job (from a previous category)
          if (jobMap.has(job.id)) continue

          // Skip jobs with missing essential fields
          if (!job.title || !job.company_name || !job.url) continue

          const description = stripHtml(job.description || '')

          jobMap.set(job.id, {
            title: job.title,
            company: job.company_name,
            location: job.candidate_required_location || 'Remote',
            remote: true, // All Remotive jobs are remote — it's remote-only platform
            description: description || 'No description provided.',
            applyUrl: job.url,
            sourceUrl: job.url,
            postedAt: new Date(job.publication_date),
            source: 'remotive',
            externalId: String(job.id),
            logoUrl: job.company_logo,
            salaryRange: job.salary || undefined,
          })
        }

        console.log(`[Remotive] Fetched ${jobs.length} jobs for category: ${category}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Remotive] Failed to fetch category "${category}": ${message}`)
        // Continue to next category — one failure doesn't stop others
      }
    }

    const allJobs = Array.from(jobMap.values())

    if (allJobs.length === 0) {
      console.warn('[Remotive] Zero jobs fetched across all categories.')
    }

    console.log(`[Remotive] Total unique jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
