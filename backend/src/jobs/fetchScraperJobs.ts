/**
 * Scraper Jobs Cron (src/jobs/fetchScraperJobs.ts)
 *
 * Runs all 4 scraper adapters SEQUENTIALLY and saves results to the database.
 * Scheduled daily at 06:00 AM server time (4 hours after API fetch).
 *
 * WHY SEQUENTIAL INSTEAD OF PARALLEL?
 * Nigerian job sites (Jobberman, MyJobMag, HotNigerianJobs, NgCareers) have
 * limited infrastructure. Sending parallel HTTP requests would:
 *   1. Look like a DDoS attack — trigger IP bans
 *   2. Overwhelm small servers — get rate-limited or throttled
 *   3. Cause connection timeouts under load
 *
 * Sequential + 3s sleep between scrapers is polite and reliable.
 * Total runtime: 4 scrapers × ~30s each + 3s gaps ≈ 2–3 minutes.
 *
 * WHY 06:00 AM (NOT 02:00 AM)?
 * We run API adapters at 02:00 AM. Scrapers run 4 hours later because:
 *   - Separating them avoids peak load on our DB at the same time
 *   - If the API fetch is still running (unlikely), scrapers don't compete
 *   - Nigerian job sites may update their listings mid-morning — 06:00 catches early updates
 *
 * RESILIENCE:
 * Each scraper is wrapped in its own try/catch inside their fetch() methods.
 * Even if one scraper's website is completely down, the loop continues.
 * We add an extra 3s sleep between scrapers as a courtesy gap.
 */

import cron from 'node-cron'
import prisma from '../utils/prisma'
import { sleep } from '../utils/sleep'
import { normalize } from '../integrations/normalizer'
import { batchUpsert } from '../services/jobs.service'
import { RawJob } from '../integrations/types'

// ngcareers.com now permanently redirects to jobberman.com — jobs appear as 'jobberman' source
const SCRAPER_SOURCES = ['jobberman', 'myjobmag', 'hotnigerianjobs']

// ─── Import Scraper Adapters ──────────────────────────────────────────────────
import { jobbermanAdapter } from '../integrations/scrapers/jobberman'
import { myjobmagAdapter } from '../integrations/scrapers/myjobmag'
import { hotnigerianjobsAdapter } from '../integrations/scrapers/hotnigerianjobs'
import { ngcareersAdapter } from '../integrations/scrapers/ngcareers'

// All scrapers in order — we run them sequentially
const SCRAPER_ADAPTERS = [
  jobbermanAdapter,
  myjobmagAdapter,
  hotnigerianjobsAdapter,
  ngcareersAdapter,
]

/**
 * Main function: runs scrapers one-by-one, normalizes results, upserts to DB.
 *
 * FLOW:
 *   For each scraper:
 *     1. Call adapter.fetch() — returns RawJob[] (empty array on failure)
 *     2. Log count
 *     3. Collect jobs
 *     4. Sleep 3 seconds before next scraper
 *   After all scrapers:
 *     5. Normalize all collected raw jobs
 *     6. Batch upsert into database
 *     7. Log summary
 */
export async function runScraperFetch(): Promise<void> {
  console.log('\n[FetchScraperJobs] Starting scraper fetch at', new Date().toISOString())

  const allRawJobs: RawJob[] = []

  // Run scrapers SEQUENTIALLY — not parallel (see file header for why)
  for (let i = 0; i < SCRAPER_ADAPTERS.length; i++) {
    const adapter = SCRAPER_ADAPTERS[i]

    console.log(`[FetchScraperJobs] Running scraper: ${adapter.source}`)

    try {
      // Each adapter's fetch() already has internal try/catch — it returns []
      // on failure instead of throwing. We add a guard here just in case.
      const jobs = await adapter.fetch()
      console.log(`[FetchScraperJobs] ${adapter.source}: ${jobs.length} jobs`)
      allRawJobs.push(...jobs)
    } catch (error) {
      // Should not reach here since adapters catch internally, but just in case
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[FetchScraperJobs] Unexpected error from ${adapter.source}: ${message}`)
    }

    // Sleep 3 seconds between scrapers (be polite to the target sites)
    // Skip the sleep after the last scraper (no next one to be polite to)
    if (i < SCRAPER_ADAPTERS.length - 1) {
      console.log('[FetchScraperJobs] Waiting 3s before next scraper...')
      await sleep(3000)
    }
  }

  console.log(`[FetchScraperJobs] Total raw jobs collected: ${allRawJobs.length}`)

  if (allRawJobs.length === 0) {
    console.warn(
      '[FetchScraperJobs] No jobs scraped from any source. ' +
        'Check if scraper selectors need updating.'
    )
    return
  }

  // Normalize all raw jobs
  const normalized = allRawJobs.map(normalize)

  // Batch upsert (50 at a time — memory safe, fast)
  const { inserted } = await batchUpsert(normalized)

  console.log(
    `[FetchScraperJobs] Complete. Processed: ${normalized.length}, DB operations: ${inserted}`
  )
  console.log('[FetchScraperJobs] Finished at', new Date().toISOString(), '\n')
}

/**
 * Dev convenience: runs scrapers immediately on startup if no scraped jobs exist yet.
 *
 * Mirrors fetchApiJobs.runIfEmpty() but checks specifically for Nigerian scraper data.
 * This handles the case where API jobs were fetched on a previous run (table is non-empty)
 * but scrapers never ran — without this check, scrapers would only run at 06:00 AM.
 */
export async function runScraperIfNeeded(): Promise<void> {
  const count = await prisma.job.count({
    where: { source: { in: SCRAPER_SOURCES } },
  })

  if (count === 0) {
    console.log('[FetchScraperJobs] No scraped jobs found — running initial scraper fetch now...')
    await runScraperFetch()
  } else {
    console.log(`[FetchScraperJobs] ${count} scraped jobs already in DB — skipping initial fetch.`)
  }
}

// ─── Schedule Cron ────────────────────────────────────────────────────────────
// Run at 06:00 AM every day — 4 hours after the API fetch cron
cron.schedule('0 6 * * *', async () => {
  try {
    await runScraperFetch()
  } catch (error) {
    console.error('[FetchScraperJobs] Cron failed:', error)
  }
})

console.log('[FetchScraperJobs] Cron scheduled: daily at 06:00 AM')
