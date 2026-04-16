/**
 * HotNigerianJobs Scraper (src/integrations/scrapers/hotnigerianjobs.ts)
 *
 * HotNigerianJobs (hotnigerianjobs.com) focuses on government jobs, corporate
 * roles (banks, telecoms, oil & gas), and public sector opportunities —
 * categories underrepresented on tech-focused platforms.
 *
 * ACTUAL HTML STRUCTURE (inspected April 2026):
 * The /jobs/today/ page lists jobs as flat sequences of <span> elements:
 *
 *   <span class='jobheader'>
 *     <h1>
 *       <a href='/hotjobs/ID/slug.html' title='Permanent Link: Job Title'>
 *         Job Title
 *       </a>
 *     </h1>
 *   </span>
 *   <span class='semibio'>Posted on Thu 16th Apr, 2026</span>
 *   ...next job...
 *
 * KEY NOTES:
 * - URL to scrape: /jobs/today/ (not the homepage)
 * - Each job entry is a span.jobheader (NOT a parent container per job)
 * - Title is in h1 > a text. Company is NOT a separate element.
 * - Company is embedded in the title: "Role Title at Company Name"
 *   — split on LAST " at " to extract company
 * - Date is in the NEXT span.semibio sibling: "Posted on Thu 16th Apr, 2026"
 * - Location is not shown in the listing — default to "Nigeria"
 *
 * RESILIENCE RULES:
 * 1. Wrap ENTIRE function in try/catch — return [] on any error
 * 2. Zero-result guard with warn log
 * 3. Skip malformed individual items silently
 * 4. Never throw
 * 5. Sleep 2000ms between page requests
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { JobAdapter, RawJob } from '../types'
import { sleep } from '../../utils/sleep'

const HNJ_BASE = 'https://www.hotnigerianjobs.com'
const PAGES_TO_SCRAPE = 2

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

/**
 * Split "Job Title at Company Name" into title and company.
 * Uses the LAST occurrence of " at " to handle titles like "Engineer at Scale at Acme".
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

/**
 * Parse "Posted on Thu 16th Apr, 2026" into a Date object.
 * Falls back to new Date() if parsing fails.
 */
function parseHnjDate(semibioText: string): Date {
  try {
    // Extract the date portion after "Posted on "
    const match = semibioText.match(/Posted on\s+\w+\s+(\d+\w+\s+\w+,?\s*\d{4})/)
    if (match) {
      // "16th Apr, 2026" → remove ordinal suffixes → "16 Apr 2026"
      const cleaned = match[1].replace(/(\d+)(st|nd|rd|th)/, '$1').replace(',', '')
      const parsed = new Date(cleaned)
      if (!isNaN(parsed.getTime())) return parsed
    }
  } catch {
    // Fall through to default
  }
  return new Date()
}

export const hotnigerianjobsAdapter: JobAdapter = {
  source: 'hotnigerianjobs',

  async fetch(): Promise<RawJob[]> {
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
        try {
          // Page 1 = today's jobs. Page 2+ = paginated archive.
          const url = page === 1 ? `${HNJ_BASE}/jobs/today/` : `${HNJ_BASE}/jobs/today/${page}/`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 20000,
          })

          const $ = cheerio.load(response.data)

          // Each job is a span.jobheader containing h1 > a
          const jobHeaders = $('span.jobheader')

          if (jobHeaders.length === 0) {
            console.warn(
              `[HotNigerianJobs] No span.jobheader elements found on page ${page}. ` +
                'Site structure may have changed.'
            )
            continue
          }

          jobHeaders.each((_index, element) => {
            try {
              const header = $(element)

              // Title link is in h1 > a
              const linkEl = header.find('h1 a')
              const title = linkEl.text().trim()
              if (!title || title.length < 3) return

              // Job URL: href like /hotjobs/12345/slug.html
              const relHref = linkEl.attr('href') || ''
              if (!relHref) return
              const jobUrl = relHref.startsWith('http') ? relHref : `${HNJ_BASE}${relHref}`

              // Company: parsed from title text ("Role at Company Name")
              const { title: jobTitle, company } = parseTitleCompany(title)

              // Date: the next span.semibio after this span.jobheader
              const semibioText = header.next('span.semibio').text().trim()
              const postedAt = semibioText ? parseHnjDate(semibioText) : new Date()

              const description =
                `${jobTitle} at ${company} in Nigeria. ` +
                'Visit the listing for full job details and application instructions.'

              allJobs.push({
                title: jobTitle,
                company,
                location: 'Nigeria',
                remote: false,
                description,
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                postedAt,
                source: 'hotnigerianjobs',
              })
            } catch {
              // Skip malformed items silently
            }
          })

          console.log(
            `[HotNigerianJobs] Page ${page}: ${jobHeaders.length} headers. Total: ${allJobs.length}`
          )
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
          '[HotNigerianJobs] Zero jobs scraped. ' +
            'Check span.jobheader selector or if /jobs/today/ URL is still valid.'
        )
      }

      return allJobs
    } catch (fatalError) {
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[HotNigerianJobs] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
