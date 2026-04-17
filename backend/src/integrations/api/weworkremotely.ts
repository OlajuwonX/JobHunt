/**
 * WeWorkRemotely RSS Adapter (src/integrations/api/weworkremotely.ts)
 *
 * WeWorkRemotely (weworkremotely.com) is one of the largest remote job boards.
 * They publish RSS feeds for each job category — RSS is a standard format for
 * syndicated content (like podcast feeds). We parse these feeds using the
 * rss-parser npm package instead of writing our own XML parser.
 *
 * WHY RSS AND NOT THEIR API?
 * WeWorkRemotely doesn't have a public REST API at the free tier.
 * Their RSS feeds are the official, supported way to access their job listings.
 *
 * TITLE FORMAT:
 * WeWorkRemotely titles look like: "CompanyName: Job Title"
 * We split on the FIRST ": " (colon + space) to separate company and title.
 * Example: "Stripe: Senior Backend Engineer" → company="Stripe", title="Senior Backend Engineer"
 * Edge case: if no ": " found, the entire string becomes the title (no company extracted).
 *
 * DEDUPLICATION ACROSS FEEDS:
 * The main feed (remote-jobs.rss) includes ALL categories.
 * The category feeds (programming, design, etc.) are subsets.
 * A job could appear in both the main feed and a category feed.
 * We deduplicate by the RSS `guid` field (unique identifier per item).
 *
 * ALL WWR JOBS ARE REMOTE BY DEFINITION:
 * The entire platform is remote-only. remote=true for all jobs.
 *
 * FEEDS WE PARSE:
 *   - Main feed (all categories)
 *   - Programming / Development
 *   - Finance & Legal
 *   - Sales & Marketing
 *   - Customer Support
 *   - Design
 */

import Parser from 'rss-parser'
import { JobAdapter, RawJob } from '../types'
import { stripHtml } from '../../utils/stripHtml'

// Initialize the RSS parser
// rss-parser is a lightweight npm package that handles RSS/Atom XML parsing
const parser = new Parser({
  timeout: 10000, // 10 seconds per feed
  headers: {
    'User-Agent': 'JobHunt-Aggregator/1.0 (contact: admin@jobhunt.com)',
  },
})

// The RSS feeds to parse — multiple categories for comprehensive coverage.
// NOTE: remote-finance-legal-jobs.rss returns 403 Forbidden — removed from list.
//       The main feed already includes finance/legal jobs, so no coverage is lost.
const WWR_FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss', // Main feed (all categories)
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
]

/**
 * Parses the WWR title format "Company: Job Title" into separate company and title.
 * Returns { company: string, title: string }
 *
 * We split on the FIRST ": " only (not all colons).
 * Example: "Stripe: Senior Engineer: Platform" → company="Stripe", title="Senior Engineer: Platform"
 */
function parseTitleAndCompany(raw: string): { company: string; title: string } {
  const separatorIndex = raw.indexOf(': ')
  if (separatorIndex === -1) {
    // No separator found — treat entire string as title, company unknown
    return { company: 'Unknown Company', title: raw.trim() }
  }
  return {
    company: raw.slice(0, separatorIndex).trim(),
    title: raw.slice(separatorIndex + 2).trim(), // +2 to skip the ": "
  }
}

export const weworkremotelyAdapter: JobAdapter = {
  source: 'weworkremotely',

  async fetch(): Promise<RawJob[]> {
    // Deduplicate by RSS guid (each WWR job has a unique guid)
    const seen = new Set<string>()
    const allJobs: RawJob[] = []

    for (const feedUrl of WWR_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl)
        const items = feed.items ?? []

        for (const item of items) {
          // Skip if we've already seen this job (appears in multiple feeds)
          const guid = item.guid || item.link || ''
          if (!guid || seen.has(guid)) continue
          seen.add(guid)

          // Skip items with no title or link
          if (!item.title || !item.link) continue

          const { company, title } = parseTitleAndCompany(item.title)

          // The item content is often HTML — strip it for clean storage
          const rawDescription = item['content:encoded'] || item.content || item.summary || ''
          const description = stripHtml(rawDescription) || 'No description provided.'

          allJobs.push({
            title,
            company,
            // WWR typically doesn't specify location beyond "Remote"
            location: 'Remote',
            remote: true, // WeWorkRemotely is 100% remote-only
            description,
            applyUrl: item.link,
            sourceUrl: item.link,
            // RSS pubDate is already a date string — parse it
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            source: 'weworkremotely',
            externalId: guid,
          })
        }

        console.log(`[WeWorkRemotely] Fetched ${items.length} items from feed: ${feedUrl}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[WeWorkRemotely] Failed to parse feed "${feedUrl}": ${message}`)
        // Continue to next feed
      }
    }

    if (allJobs.length === 0) {
      console.warn('[WeWorkRemotely] Zero jobs fetched across all feeds.')
    }

    console.log(`[WeWorkRemotely] Total unique jobs fetched: ${allJobs.length}`)
    return allJobs
  },
}
