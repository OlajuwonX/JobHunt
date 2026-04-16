/**
 * NgCareers Scraper — Extended Jobberman Pages (src/integrations/scrapers/ngcareers.ts)
 *
 * NgCareers (ngcareers.com) permanently redirects to Jobberman (jobberman.com)
 * as of 2026. The domain was acquired by Jobberman.
 *
 * This scraper has been updated to scrape additional Jobberman pages (4–6) so we
 * get MORE Nigerian jobs beyond what the primary Jobberman scraper fetches (pages 1–3).
 * Jobs are stored with source="jobberman" since that is the actual data source.
 *
 * WHY KEEP THIS SEPARATE SCRAPER?
 * Each page of Jobberman has ~16 different job listings. Splitting across two scrapers
 * lets us collect more jobs while staying within polite request limits per scraper.
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

const JOBBERMAN_BASE = 'https://www.jobberman.com'
// Pages 4–6 to complement the Jobberman scraper which covers pages 1–3
const START_PAGE = 4
const END_PAGE = 6

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive',
}

/**
 * Parse the __gtmDataLayer variable from the page HTML.
 * Returns the items array from the view_item_list event, or [] on any error.
 */
function parseGtmItems(html: string): Array<{
  item_name: string
  affiliation: string
  location_id: string
  item_category: string
}> {
  try {
    const match = html.match(/const __gtmDataLayer\s*=\s*(\[.*?\]);/s)
    if (!match) return []

    const data = JSON.parse(match[1]) as Array<{
      event?: string
      ecommerce?: {
        items?: Array<{
          item_name: string
          affiliation: string
          location_id: string
          item_category: string
        }>
      }
    }>

    const listEvent = data.find((d) => d.event === 'view_item_list' && d.ecommerce?.items?.length)
    return listEvent?.ecommerce?.items ?? []
  } catch {
    return []
  }
}

export const ngcareersAdapter: JobAdapter = {
  // source remains "jobberman" since ngcareers.com now IS jobberman.com
  source: 'jobberman',

  async fetch(): Promise<RawJob[]> {
    try {
      const allJobs: RawJob[] = []

      for (let page = START_PAGE; page <= END_PAGE; page++) {
        try {
          const url = `${JOBBERMAN_BASE}/jobs?page=${page}`

          const response = await axios.get<string>(url, {
            headers: BROWSER_HEADERS,
            timeout: 20000,
          })

          const html = response.data
          const $ = cheerio.load(html)

          // Extract prerender listing URLs (unique, in order)
          const listingUrls: string[] = []
          $('link[rel="prerender"]').each((_i, el) => {
            const href = $(el).attr('href') || ''
            if (href.includes('/listings/') && !listingUrls.includes(href)) {
              listingUrls.push(href)
            }
          })

          // Extract job metadata from __gtmDataLayer
          const gtmItems = parseGtmItems(html)

          if (listingUrls.length === 0 || gtmItems.length === 0) {
            console.warn(
              `[NgCareers/Jobberman] Page ${page}: no data found ` +
                `(${listingUrls.length} URLs, ${gtmItems.length} gtm items). ` +
                'Jobberman may have changed their HTML structure.'
            )
            continue
          }

          const count = Math.min(listingUrls.length, gtmItems.length)

          for (let i = 0; i < count; i++) {
            try {
              const item = gtmItems[i]
              const jobUrl = listingUrls[i]

              const title = item.item_name?.trim()
              const company = item.affiliation?.trim()
              const location = item.location_id?.trim() || 'Nigeria'
              const category = item.item_category?.trim() || ''

              if (!title || !company) continue

              const description =
                `${title} at ${company} in ${location}. ` +
                (category ? `Category: ${category}. ` : '') +
                'Visit the listing for full details.'

              allJobs.push({
                title,
                company,
                location,
                remote:
                  location.toLowerCase().includes('remote') ||
                  location.toLowerCase().includes('work from home'),
                description,
                applyUrl: jobUrl,
                sourceUrl: jobUrl,
                postedAt: new Date(),
                source: 'jobberman',
              })
            } catch {
              // Skip malformed items silently
            }
          }

          console.log(
            `[NgCareers/Jobberman] Page ${page}: ${count} jobs. Total so far: ${allJobs.length}`
          )
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[NgCareers/Jobberman] Failed to scrape page ${page}: ${message}`)
        }

        if (page < END_PAGE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn(
          '[NgCareers/Jobberman] Zero jobs scraped. ' +
            'Jobberman may have fewer than 4 pages of listings right now.'
        )
      }

      return allJobs
    } catch (fatalError) {
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[NgCareers/Jobberman] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
