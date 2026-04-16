/**
 * Jobberman Scraper (src/integrations/scrapers/jobberman.ts)
 *
 * Jobberman (jobberman.com) is Nigeria's leading job board and one of the
 * largest in Africa. It covers ALL industries — tech, banking, FMCG, healthcare,
 * telecoms, government, and more.
 *
 * WHY THIS APPROACH?
 * Jobberman is a React SPA — job cards are not in the raw HTML body.
 * However, two things ARE in the raw HTML:
 *   1. `__gtmDataLayer` — a JSON array injected into the page with all job metadata
 *      (title, company, location, category, id) for Google Tag Manager.
 *   2. `<link rel="prerender">` tags — listing URLs for the top jobs on the page.
 *
 * These are injected server-side in the same order, so we can zip them together
 * to get full job records without fetching each individual listing page.
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
const PAGES_TO_SCRAPE = 3

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
    // The dataLayer is injected as: const __gtmDataLayer = [{...}];
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

export const jobbermanAdapter: JobAdapter = {
  source: 'jobberman',

  async fetch(): Promise<RawJob[]> {
    try {
      const allJobs: RawJob[] = []

      for (let page = 1; page <= PAGES_TO_SCRAPE; page++) {
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
              `[Jobberman] Page ${page}: no data found ` +
                `(${listingUrls.length} URLs, ${gtmItems.length} gtm items). ` +
                'Jobberman may have changed their HTML structure.'
            )
            continue
          }

          // Zip: prerender URLs and gtmDataLayer items are in the same order
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

          console.log(`[Jobberman] Page ${page}: ${count} jobs. Total so far: ${allJobs.length}`)
        } catch (pageError) {
          const message = pageError instanceof Error ? pageError.message : String(pageError)
          console.warn(`[Jobberman] Failed to scrape page ${page}: ${message}`)
        }

        if (page < PAGES_TO_SCRAPE) {
          await sleep(2000)
        }
      }

      if (allJobs.length === 0) {
        console.warn('[Jobberman] Zero jobs scraped. Check if the site structure has changed.')
      }

      return allJobs
    } catch (fatalError) {
      const message = fatalError instanceof Error ? fatalError.message : String(fatalError)
      console.warn(`[Jobberman] Fatal error during scraping: ${message}`)
      return []
    }
  },
}
