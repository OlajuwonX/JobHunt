/**
 * NgCareers Scraper (src/integrations/scrapers/ngcareers.ts)
 *
 * NgCareers (ngcareers.com) is a Nigerian job board that covers professional and
 * graduate-level roles across all industries. It's known for mid-level to senior
 * professional jobs in Nigeria, including banking, consulting, NGOs, and tech.
 *
 * WHAT MAKES NGCAREERS DIFFERENT?
 * - Strong coverage of entry-level and graduate trainee positions
 * - Non-profit and development sector jobs (NGOs, UN agencies, international orgs)
 * - Professional services (consulting, law, accounting)
 * These complement Jobberman (which focuses more on corporate/tech roles).
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

const NGCAREERS_BASE = 'https://ngcareers.com'
const PAGES_TO_SCRAPE = 3

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

export const ngcareersAdapter: JobAdapter = {
  source: 'ngcareers',

  async fetch(): Promise<RawJob[]> {
    // RESILIENCE RULE 1: Wrap entire function in try/catch
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          // NgCareers pagination format — may use ?page= or /page/N depending on their routing
          const url = page === 1 ? `${NGCAREERS_BASE}/jobs` : `${NGCAREERS_BASE}/jobs?page=${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 15000,
          })

          const $ = cheerio.load(response.data)

          // NOTE: Selectors here are best-effort based on common patterns.
          // If this scraper returns 0 results, inspect the live site HTML and update selectors.
          // The zero-result guard will catch this safely — it won't crash the system.

          // NgCareers typically lists jobs in cards or list items
          const jobCards = $(
            '.job-listing, .job-card, .job-item, article.job, li.job, ' +
              '.vacancy, [class*="job-"], [class*="vacancy-"]'
          )

          // RESILIENCE RULE 2: Zero-result guard
          if (jobCards.length === 0) {
            console.warn(
              `[NgCareers] No job cards found on page ${page}. HTML structure may have changed. ` +
                'Inspect the live site and update selectors in scrapers/ngcareers.ts'
            )
            continue
          }

          jobCards.each((_index, element) => {
            try {
              const card = $(element)

              // Extract title — try common selector patterns
              const title =
                card
                  .find('h2, h3, .job-title, .title, a.job-link, a[href*="/jobs/"]')
                  .first()
                  .text()
                  .trim() || ''

              // Extract company name
              const company =
                card
                  .find('.company-name, .employer, .company, .recruiter, [class*="company"]')
                  .first()
                  .text()
                  .trim() || ''

              // RESILIENCE RULE 3: Skip if title or company is missing
              if (!title || !company) return

              // Extract job URL
              const relativeUrl =
                card.find('a[href*="/jobs/"], a[href*="/job/"], a').first().attr('href') || ''

              const jobUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : relativeUrl
                  ? `${NGCAREERS_BASE}${relativeUrl}`
                  : ''

              if (!jobUrl || jobUrl === NGCAREERS_BASE) return

              // Extract location
              const location =
                card
                  .find('.location, .job-location, [class*="location"], .city')
                  .first()
                  .text()
                  .trim() || 'Nigeria'

              // Extract description snippet if available
              const rawDesc =
                card.find('.description, .summary, .excerpt, p').first().text().trim() || ''

              const description = rawDesc
                ? stripHtml(rawDesc)
                : `${title} at ${company} in ${location}. Visit the listing for full details.`

              // Extract deadline/date if shown
              // NgCareers often shows "Deadline: March 30, 2025" on listing cards
              const deadlineText =
                card.find('.deadline, .closing-date, [class*="deadline"]').first().text().trim() ||
                ''

              // Try to parse the deadline as a date — fall back to now if parsing fails
              let postedAt = new Date()
              if (deadlineText) {
                // Extract the date part from "Deadline: March 30, 2025"
                const dateMatch = deadlineText.match(/(\w+ \d+,?\s*\d{4})/)
                if (dateMatch) {
                  const parsed = new Date(dateMatch[1])
                  if (!isNaN(parsed.getTime())) {
                    postedAt = parsed
                  }
                }
              }

              allJobs.push({
                title,
                company,
                location,
                remote: location.toLowerCase().includes('remote'),
                description,
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                postedAt,
                source: 'ngcareers',
              })
            } catch {
              // Skip malformed cards silently
            }
          })

          console.log(`[NgCareers] Scraped ${allJobs.length} total jobs after page ${page}.`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[NgCareers] Failed to scrape page ${page}: ${message}`)
        }

        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn(
          '[NgCareers] Zero jobs scraped. The site structure may have changed — check selectors.'
        )
      }

      return allJobs
    } catch (fatalError) {
      // RESILIENCE RULE 1: Never throw — return [] on fatal errors
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[NgCareers] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
