/**
 * Jobberman Scraper (src/integrations/scrapers/jobberman.ts)
 *
 * Jobberman (jobberman.com) is Nigeria's leading job board and one of the
 * largest in Africa. It covers ALL industries — tech, banking, FMCG, healthcare,
 * telecoms, government, and more. It's critical for Nigerian market coverage.
 *
 * WHY SCRAPING INSTEAD OF AN API?
 * Jobberman does not offer a free public API. Web scraping is the only way
 * to access their listings. We use cheerio, which is like jQuery but for
 * server-side HTML parsing.
 *
 * HOW CHEERIO WORKS:
 * 1. We fetch the raw HTML of the page with axios
 * 2. We load it into cheerio: const $ = cheerio.load(html)
 * 3. We query elements like jQuery: $('.job-card .title').text()
 * 4. We extract the data we need
 *
 * RESILIENCE RULES (mandatory for all scrapers):
 * 1. Wrap ENTIRE function in try/catch — return [] on any error
 * 2. Zero-result guard: if no cards found, warn and return []
 * 3. Skip individual cards where title or company is empty
 * 4. Never throw — the cron must continue even if this scraper completely fails
 * 5. Sleep 2000ms between page requests (be polite)
 *
 * NOTE ON SELECTORS:
 * Selectors here are best-effort based on common patterns.
 * If this scraper returns 0 results, inspect the live site HTML and update selectors.
 * The zero-result guard will catch this safely — it won't crash the system.
 *
 * APPLY URL STRATEGY:
 * On Jobberman, users apply ON THE JOBBERMAN PAGE (not an external link).
 * So applyUrl = sourceUrl = the Jobberman listing URL.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { JobAdapter, RawJob } from '../types'
import { sleep } from '../../utils/sleep'
import { stripHtml } from '../../utils/stripHtml'

const JOBBERMAN_BASE = 'https://www.jobberman.com'
const PAGES_TO_SCRAPE = 3

// Standard browser headers to avoid basic bot detection
// Without these, many sites return 403 Forbidden or Cloudflare challenge pages
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
}

export const jobbermanAdapter: JobAdapter = {
  source: 'jobberman',

  async fetch(): Promise<RawJob[]> {
    // RESILIENCE RULE 1: Wrap the ENTIRE function in try/catch
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          const url = `${JOBBERMAN_BASE}/jobs?page=${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 15000, // Scrapers need more time than APIs
          })

          // Load the HTML into cheerio for jQuery-like querying
          const $ = cheerio.load(response.data)

          // NOTE: Selectors here are best-effort based on common patterns.
          // If this scraper returns 0 results, inspect the live site HTML and update selectors.
          // The zero-result guard will catch this safely — it won't crash the system.

          // Target the job listing cards on the page
          // Jobberman typically wraps each job in an article or div with a job-related class
          const jobCards = $('article.job-listing, .job-listing-card, [data-job-id]')

          // RESILIENCE RULE 2: Zero-result guard
          if (jobCards.length === 0) {
            console.warn(
              `[Jobberman] No job cards found on page ${page}. HTML structure may have changed. ` +
                'Inspect the live site and update selectors in scrapers/jobberman.ts'
            )
            // Try an alternative selector set before giving up on this page
            const altCards = $('li.job-item, .job-card, .listing-item')
            if (altCards.length === 0) {
              // Nothing found with any selector — skip this page
              continue
            }
          }

          // Iterate each job card and extract data
          jobCards.each((_index, element) => {
            try {
              const card = $(element)

              // Extract job title — try multiple possible selectors
              const title =
                card.find('.job-title, h2.title, .listing-title, h3').first().text().trim() ||
                card.find('a[data-title]').attr('data-title')?.trim() ||
                ''

              // Extract company name — try multiple possible selectors
              const company =
                card.find('.company-name, .employer-name, .recruiter-name').first().text().trim() ||
                card.find('[data-company]').attr('data-company')?.trim() ||
                ''

              // RESILIENCE RULE 3: Skip cards without title or company
              if (!title || !company) return

              // Extract the relative URL of the job listing
              const relativeUrl =
                card.find('a.job-title-link, a[data-job-url], a').first().attr('href') || ''
              const jobUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : `${JOBBERMAN_BASE}${relativeUrl}`

              // Skip if no URL found (can't link user to the job)
              if (!jobUrl || jobUrl === JOBBERMAN_BASE) return

              // Extract location
              const location =
                card.find('.location, .job-location, [data-location]').first().text().trim() ||
                'Nigeria'

              // Extract any description snippet shown in the listing card
              const descriptionSnippet =
                card
                  .find('.job-description, .description-snippet, .summary')
                  .first()
                  .text()
                  .trim() || ''

              const description = descriptionSnippet
                ? stripHtml(descriptionSnippet)
                : `${title} at ${company} in ${location}. Visit the listing for full details.`

              allJobs.push({
                title,
                company,
                location,
                remote: location.toLowerCase().includes('remote'),
                description,
                // On Jobberman, the listing URL is also the apply URL
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                // Jobberman listing dates are embedded in relative format ("3 days ago")
                // and are unreliable to parse. We use current date as a safe fallback.
                // This means sorting by postedAt is approximate for Jobberman jobs.
                postedAt: new Date(),
                source: 'jobberman',
              })
            } catch {
              // RESILIENCE RULE 3: Skip individual malformed cards silently
              // One bad card should never stop processing the rest
            }
          })

          console.log(`[Jobberman] Scraped ${allJobs.length} total jobs after page ${page}.`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[Jobberman] Failed to scrape page ${page}: ${message}`)
        }

        // RESILIENCE RULE 5: Sleep between page requests
        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn(
          '[Jobberman] Zero jobs scraped across all pages. ' +
            'The site structure may have changed — check selectors.'
        )
      }

      return allJobs
    } catch (fatalError) {
      // RESILIENCE RULE 1: Catch fatal errors and return [] instead of throwing
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[Jobberman] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
