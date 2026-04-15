/**
 * Lever API Adapter (src/integrations/api/lever.ts)
 *
 * Lever is another popular ATS (Applicant Tracking System) used by tech companies.
 * Like Greenhouse, Lever provides a public API endpoint for each company's job board.
 * No API key is required — this is intentional on Lever's part (they want jobs discovered).
 *
 * HOW THE LEVER API WORKS:
 * Each company has a slug (e.g. "netflix", "canva").
 * The public API endpoint is:
 *   GET https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * The ?mode=json param ensures we get a JSON response instead of HTML.
 * Without it, the API returns an HTML page (old legacy behavior).
 *
 * KEY FIELDS FROM LEVER:
 *   - text: the job title
 *   - categories.location: where the job is based
 *   - categories.commitment: employment type (Full-time, Part-time, Contract)
 *   - descriptionPlain: plain-text description (Lever provides this pre-stripped)
 *   - applyUrl: the external apply link
 *   - hostedUrl: the Lever-hosted listing URL (sourceUrl)
 *   - createdAt: timestamp in milliseconds (Unix epoch × 1000)
 *
 * SLEEP STRATEGY:
 * Same as Greenhouse — 300ms between companies to be polite.
 */

import axios from 'axios'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'
import { sleep } from '../../utils/sleep'
import leverCompanies from '../data/lever-companies.json'

const LEVER_BASE = 'https://api.lever.co/v0/postings'

// TypeScript interface matching Lever's API response shape
interface LeverPosting {
  id: string
  text: string // job title
  categories: {
    location?: string
    commitment?: string // e.g. "Full-time", "Contract"
    team?: string
    department?: string
  }
  description?: string // HTML description
  descriptionPlain?: string // plain text description (preferred)
  applyUrl: string // external application URL
  hostedUrl: string // the Lever-hosted listing page
  createdAt: number // Unix timestamp in milliseconds
}

export const leverAdapter: JobAdapter = {
  source: 'lever',

  async fetch(): Promise<RawJob[]> {
    const allJobs: RawJob[] = []

    for (const slug of leverCompanies) {
      try {
        const url = `${LEVER_BASE}/${slug}?mode=json`

        const response = await axios.get<LeverPosting[]>(url, {
          timeout: 8000,
          headers: {
            'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
          },
        })

        // Lever returns an array directly (not wrapped in an object like Greenhouse)
        const postings = Array.isArray(response.data) ? response.data : []

        for (const posting of postings) {
          if (!posting.text || !posting.hostedUrl) continue

          // Lever provides descriptionPlain (already stripped) — use it if available
          // Fall back to stripping the HTML description if plain text is missing
          const description = posting.descriptionPlain
            ? posting.descriptionPlain
            : posting.description
              ? stripHtml(posting.description)
              : 'No description provided.'

          const location = posting.categories?.location ?? null
          const isRemote =
            location?.toLowerCase().includes('remote') ||
            posting.text.toLowerCase().includes('remote') ||
            false

          allJobs.push({
            title: posting.text,
            company: slug.charAt(0).toUpperCase() + slug.slice(1),
            location,
            remote: isRemote,
            description,
            applyUrl: posting.applyUrl || posting.hostedUrl,
            sourceUrl: posting.hostedUrl,
            // Lever stores createdAt as milliseconds — convert to Date
            postedAt: new Date(posting.createdAt),
            source: 'lever',
            externalId: posting.id,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[Lever] Failed to fetch jobs for "${slug}": ${message}`)
      }

      await sleep(300)
    }

    if (allJobs.length === 0) {
      console.warn('[Lever] Zero jobs fetched across all companies. Check network or slugs.')
    }

    console.log(`[Lever] Fetched ${allJobs.length} jobs from ${leverCompanies.length} companies.`)
    return allJobs
  },
}
