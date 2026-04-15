/**
 * MyJobMag Scraper (src/integrations/scrapers/myjobmag.ts)
 *
 * MyJobMag (myjobmag.com) is a multi-country African job board covering:
 *   - Nigeria (myjobmag.com)
 *   - Ghana
 *   - South Africa
 *   - Kenya
 *
 * This gives us pan-African coverage beyond just Nigerian roles.
 * The site covers ALL industries: tech, banking, healthcare, NGOs, government, FMCG.
 *
 * RESILIENCE RULES (mandatory for all scrapers):
 * 1. Wrap ENTIRE function in try/catch — return [] on any error
 * 2. Zero-result guard with warn log
 * 3. Skip malformed individual cards silently
 * 4. Never throw
 * 5. Sleep 2000ms between page requests
 *
 * NOTE: Selectors here are best-effort based on common patterns.
 * If this scraper returns 0 results, inspect the live site HTML and update selectors.
 * The zero-result guard will catch this safely — it won't crash the system.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { JobAdapter, RawJob } from '../types'
import { sleep } from '../../utils/sleep'
import { stripHtml } from '../../utils/stripHtml'

const MYJOBMAG_BASE = 'https://www.myjobmag.com'
const PAGES_TO_SCRAPE = 3

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

export const myjobmagAdapter: JobAdapter = {
  source: 'myjobmag',

  async fetch(): Promise<RawJob[]> {
    // RESILIENCE RULE 1: Wrap entire function in try/catch
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          // MyJobMag pagination uses /jobs?page=n format
          const url = page === 1 ? `${MYJOBMAG_BASE}/jobs` : `${MYJOBMAG_BASE}/jobs?page=${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 15000,
          })

          const $ = cheerio.load(response.data)

          // NOTE: Selectors here are best-effort based on common patterns.
          // If this scraper returns 0 results, inspect the live site HTML and update selectors.
          // The zero-result guard will catch this safely — it won't crash the system.

          // MyJobMag typically renders jobs as list items with job-specific classes
          const jobCards = $(
            '.job-listing, .job-item, article.job, li.job, .vacancy-item, [data-job]'
          )

          // RESILIENCE RULE 2: Zero-result guard
          if (jobCards.length === 0) {
            console.warn(
              `[MyJobMag] No job cards found on page ${page}. HTML structure may have changed. ` +
                'Inspect the live site and update selectors in scrapers/myjobmag.ts'
            )
            continue
          }

          jobCards.each((_index, element) => {
            try {
              const card = $(element)
              // Try multiple selector patterns for title — sites change their CSS classes
              const title =
                card.find('h2, h3, .job-title, .title, a.job-link').first().text().trim() || ''

              // Try multiple selector patterns for company name
              const company =
                card.find('.company, .employer, .company-name, .recruiter').first().text().trim() ||
                ''

              // RESILIENCE RULE 3: Skip if essential fields are missing
              if (!title || !company) return

              // Extract the listing URL
              const relativeUrl = card.find('a').first().attr('href') || ''
              const jobUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : `${MYJOBMAG_BASE}${relativeUrl}`

              if (!jobUrl || jobUrl === MYJOBMAG_BASE) return

              // Extract location information
              const location =
                card.find('.location, .job-location, .city').first().text().trim() || 'Nigeria'

              // Extract any short description shown in the listing
              const rawDesc =
                card.find('.description, .summary, .excerpt').first().text().trim() || ''

              const description = rawDesc
                ? stripHtml(rawDesc)
                : `${title} at ${company} in ${location}. Visit the listing for full details.`

              allJobs.push({
                title,
                company,
                location,
                remote: location.toLowerCase().includes('remote'),
                description,
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                postedAt: new Date(), // MyJobMag dates are in relative format — use current date
                source: 'myjobmag',
              })
            } catch {
              // Skip malformed cards silently
            }
          })

          console.log(`[MyJobMag] Scraped ${allJobs.length} total jobs after page ${page}.`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[MyJobMag] Failed to scrape page ${page}: ${message}`)
        }

        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn(
          '[MyJobMag] Zero jobs scraped. The site structure may have changed — check selectors.'
        )
      }

      return allJobs
    } catch (fatalError) {
      // RESILIENCE RULE 1: Return [] instead of throwing on fatal errors
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[MyJobMag] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
