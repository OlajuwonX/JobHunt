/**
 * HotNigerianJobs Scraper (src/integrations/scrapers/hotnigerianjobs.ts)
 *
 * HotNigerianJobs (hotnigerianjobs.com) is one of the older Nigerian job boards.
 * It focuses on government jobs, corporate roles (banks, telecoms, oil & gas),
 * and public sector opportunities — categories underrepresented on modern job boards.
 *
 * WHY IS THIS VALUABLE?
 * Many Nigerian job seekers are looking for:
 *   - Government/civil service positions (Ministry, NNPC, CBN, etc.)
 *   - Parastatals and state-owned enterprises
 *   - Traditional corporate roles (banks: GTBank, Zenith; Telcos: MTN, Airtel)
 * These don't appear on tech-focused platforms like Greenhouse or Lever.
 *
 * OLDER SITE = SIMPLER HTML:
 * HotNigerianJobs uses a simpler HTML structure than modern SPA job boards.
 * This makes it easier to scrape reliably — fewer dynamic React components
 * that would require a full browser (Puppeteer) to render.
 *
 * RESILIENCE RULES (mandatory for all scrapers):
 * 1. Wrap ENTIRE function in try/catch — return [] on any error
 * 2. Zero-result guard with warn log
 * 3. Skip malformed individual items silently
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

const HNJ_BASE = 'https://www.hotnigerianjobs.com'
const PAGES_TO_SCRAPE = 2 // Older site, simpler pagination

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

export const hotnigerianjobsAdapter: JobAdapter = {
  source: 'hotnigerianjobs',

  async fetch(): Promise<RawJob[]> {
    // RESILIENCE RULE 1: Wrap entire function in try/catch
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          // HotNigerianJobs homepage lists recent jobs — also try pagination
          const url = page === 1 ? HNJ_BASE : `${HNJ_BASE}/jobs/page/${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 15000,
          })

          const $ = cheerio.load(response.data)

          // NOTE: Selectors here are best-effort based on common patterns.
          // If this scraper returns 0 results, inspect the live site HTML and update selectors.
          // The zero-result guard will catch this safely — it won't crash the system.

          // HotNigerianJobs uses a traditional table or list layout for job entries
          // Try multiple selector patterns to account for their layout style
          const jobItems = $(
            '.job-entry, .vacancy, table.job-table tr:not(:first-child), ' +
              '.entry-title, article, .post, li.job'
          )

          // RESILIENCE RULE 2: Zero-result guard
          if (jobItems.length === 0) {
            console.warn(
              `[HotNigerianJobs] No job items found on page ${page}. HTML structure may have changed. ` +
                'Inspect the live site and update selectors in scrapers/hotnigerianjobs.ts'
            )
            continue
          }

          jobItems.each((_index, element) => {
            try {
              const item = $(element)

              // Older Nigerian job sites often use table rows or simple div structures
              // Try various selector patterns
              const title =
                item.find('a, h2, h3, .title, td.job-title').first().text().trim() ||
                item.find('a').attr('title')?.trim() ||
                ''

              // Company name extraction — older sites sometimes embed this differently
              const company =
                item
                  .find('.company, .employer, .organization, td:nth-child(2)')
                  .first()
                  .text()
                  .trim() ||
                item.find('[data-company]').attr('data-company')?.trim() ||
                'Nigerian Employer'

              // RESILIENCE RULE 3: Skip if essential fields are missing
              if (!title || title.length < 3) return

              // Extract job URL
              const relativeUrl = item.find('a').first().attr('href') || ''
              const jobUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : relativeUrl
                  ? `${HNJ_BASE}${relativeUrl}`
                  : ''

              if (!jobUrl) return

              // Location extraction — many Nigerian jobs just say "Nigeria" or a state
              const location =
                item.find('.location, .city, .state, td.location').first().text().trim() ||
                'Nigeria'

              // Description snippet or generate a placeholder
              const rawDesc = item.find('.description, .summary, p').first().text().trim() || ''

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
                postedAt: new Date(),
                source: 'hotnigerianjobs',
              })
            } catch {
              // Skip malformed items silently
            }
          })

          console.log(`[HotNigerianJobs] Scraped ${allJobs.length} total jobs after page ${page}.`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[HotNigerianJobs] Failed to scrape page ${page}: ${message}`)
        }

        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn(
          '[HotNigerianJobs] Zero jobs scraped. The site structure may have changed — check selectors.'
        )
      }

      return allJobs
    } catch (fatalError) {
      // RESILIENCE RULE 1: Never throw — return [] on fatal errors
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[HotNigerianJobs] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
