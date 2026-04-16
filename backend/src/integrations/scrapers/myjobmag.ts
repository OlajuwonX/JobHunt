/**
 * MyJobMag Scraper (src/integrations/scrapers/myjobmag.ts)
 *
 * MyJobMag (myjobmag.com) is a multi-country African job board covering Nigeria,
 * Ghana, South Africa, and Kenya. Strong coverage across ALL industries.
 *
 * ACTUAL HTML STRUCTURE (inspected April 2026):
 * Jobs are in a <ul class="job-list"> and each job is a <li class="job-list-li">:
 *
 *   <li class="job-list-li">
 *     <ul>
 *       <li class="job-logo"> <a href="/jobs-at/company-slug"> ... </a> </li>
 *       <li class="job-info">
 *         <ul>
 *           <li class="mag-b">
 *             <h2><a href="/job/job-slug">Title at Company Name</a></h2>
 *           </li>
 *           <li class="job-desc">Description excerpt...</li>
 *           <li class="job-item">
 *             <ul>
 *               <li id="job-date">16 April</li>
 *             </ul>
 *           </li>
 *         </ul>
 *       </li>
 *     </ul>
 *   </li>
 *
 * KEY NOTES:
 * - Title and company are BOTH in the h2 link text as "Title at Company"
 * - Split on " at " to separate them (last occurrence to handle titles with "at")
 * - Location is NOT shown in the listing card — default to "Nigeria"
 * - Pagination: /jobs for page 1, /jobs/page/2 for page 2
 *
 * RESILIENCE RULES:
 * 1. Wrap ENTIRE function in try/catch — return [] on any error
 * 2. Zero-result guard with warn log
 * 3. Skip malformed individual cards silently
 * 4. Never throw
 * 5. Sleep 2000ms between page requests
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
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

/**
 * Split "Job Title at Company Name" into title and company.
 * Uses the LAST occurrence of " at " to handle titles like "Developer at Scale at Acme".
 * Returns { title, company } — company defaults to "Nigerian Employer" if not found.
 */
function parseTitleCompany(text: string): { title: string; company: string } {
  const lastAt = text.lastIndexOf(' at ')
  if (lastAt === -1) {
    return { title: text.trim(), company: 'Nigerian Employer' }
  }
  return {
    title: text.slice(0, lastAt).trim(),
    company: text.slice(lastAt + 4).trim(),
  }
}

export const myjobmagAdapter: JobAdapter = {
  source: 'myjobmag',

  async fetch(): Promise<RawJob[]> {
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          // MyJobMag pagination: /jobs for page 1, /jobs/page/2 for page 2+
          const url = page === 1 ? `${MYJOBMAG_BASE}/jobs` : `${MYJOBMAG_BASE}/jobs/page/${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 20000,
          })

          const $ = cheerio.load(response.data)

          // Each job is a <li class="job-list-li"> inside <ul class="job-list">
          const jobItems = $('li.job-list-li')

          if (jobItems.length === 0) {
            console.warn(
              `[MyJobMag] No job items found on page ${page}. ` +
                'Site structure may have changed — inspect li.job-list-li selector.'
            )
            continue
          }

          jobItems.each((_index, element) => {
            try {
              const item = $(element)

              // Title and company are both in the h2 link text: "Title at Company"
              const linkEl = item.find('li.mag-b h2 a')
              const fullText = linkEl.text().trim()
              if (!fullText || fullText.length < 3) return

              const { title, company } = parseTitleCompany(fullText)
              if (!title || !company) return

              // Job URL: href is relative like /job/slug
              const relHref = linkEl.attr('href') || ''
              if (!relHref) return
              const jobUrl = relHref.startsWith('http') ? relHref : `${MYJOBMAG_BASE}${relHref}`

              // Description snippet
              const rawDesc = item.find('li.job-desc').first().text().trim()
              const description = rawDesc
                ? stripHtml(rawDesc)
                : `${title} at ${company} in Nigeria. Visit the listing for full details.`

              // Location not shown in listing cards — default to Nigeria
              const location = 'Nigeria'

              allJobs.push({
                title,
                company,
                location,
                remote: false,
                description,
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                postedAt: new Date(),
                source: 'myjobmag',
              })
            } catch {
              // Skip malformed items silently
            }
          })

          console.log(`[MyJobMag] Page ${page}: ${jobItems.length} items. Total: ${allJobs.length}`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[MyJobMag] Failed to scrape page ${page}: ${message}`)
        }

        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn('[MyJobMag] Zero jobs scraped. Check if site structure has changed.')
      }

      return allJobs
    } catch (fatalError) {
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[MyJobMag] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
