/**
 * API Jobs Cron (src/jobs/fetchApiJobs.ts)
 *
 * Runs all 7 API adapters and saves their results to the database.
 * Scheduled daily at 02:00 AM server time.
 *
 * WHY PARALLEL EXECUTION FOR API ADAPTERS?
 * API adapters call external HTTP endpoints — the bottleneck is network I/O.
 * Running them in parallel (Promise.allSettled) means we wait for the SLOWEST
 * adapter instead of the SUM of all adapter times.
 *   Sequential: 7 adapters × 5s avg = 35 seconds
 *   Parallel:   7 adapters × 5s max = 5 seconds
 *
 * WHY Promise.allSettled INSTEAD OF Promise.all?
 * Promise.all would FAIL ENTIRELY if any single adapter throws.
 * Promise.allSettled collects BOTH successes and failures:
 *   - Fulfilled: adapter returned jobs → we insert them
 *   - Rejected:  adapter threw an error → we log it and continue
 * This means one broken adapter never prevents data from 6 others.
 *
 * runIfEmpty():
 * Called once at server startup. If the jobs table is empty (fresh install
 * or after a DB reset), it triggers an immediate fetch instead of waiting
 * until 02:00 AM. This makes the dev experience much better.
 */

import cron from 'node-cron'
import prisma from '../utils/prisma'
import { normalize } from '../integrations/normalizer'
import { batchUpsert } from '../services/jobs.service'
import { RawJob } from '../integrations/types'

// ─── Import API Adapters ──────────────────────────────────────────────────────
import { greenhouseAdapter } from '../integrations/api/greenhouse'
import { leverAdapter } from '../integrations/api/lever'
import { remotiveAdapter } from '../integrations/api/remotive'
import { arbeitnowAdapter } from '../integrations/api/arbeitnow'
import { jobicyAdapter } from '../integrations/api/jobicy'
import { themuseAdapter } from '../integrations/api/themuse'
import { weworkremotelyAdapter } from '../integrations/api/weworkremotely'

// All adapters in one array — easy to add/remove without changing runApiFetch()
const API_ADAPTERS = [
  greenhouseAdapter,
  leverAdapter,
  remotiveAdapter,
  arbeitnowAdapter,
  jobicyAdapter,
  themuseAdapter,
  weworkremotelyAdapter,
]

/**
 * Main function: runs all API adapters in parallel, normalizes, and upserts.
 *
 * FLOW:
 *   1. Run all adapters in parallel with Promise.allSettled
 *   2. Log which adapters failed
 *   3. Collect all raw jobs from successful adapters
 *   4. Normalize each raw job (compute hash, extract tech stack, etc.)
 *   5. Batch upsert into the database
 *   6. Log summary stats
 */
export async function runApiFetch(): Promise<void> {
  console.log('\n[FetchApiJobs] Starting API job fetch at', new Date().toISOString())

  // Run all adapters in parallel
  // Promise.allSettled never rejects — it always resolves with an array
  // of { status: 'fulfilled', value } or { status: 'rejected', reason }
  const results = await Promise.allSettled(API_ADAPTERS.map((adapter) => adapter.fetch()))

  const allRawJobs: RawJob[] = []

  results.forEach((result, index) => {
    const adapterName = API_ADAPTERS[index].source
    if (result.status === 'fulfilled') {
      console.log(`[FetchApiJobs] ✓ ${adapterName}: ${result.value.length} jobs`)
      allRawJobs.push(...result.value)
    } else {
      // Log the failure but don't stop — other adapters may have succeeded
      console.warn(`[FetchApiJobs] ✗ ${adapterName} failed:`, result.reason)
    }
  })

  console.log(`[FetchApiJobs] Total raw jobs collected: ${allRawJobs.length}`)

  if (allRawJobs.length === 0) {
    console.warn(
      '[FetchApiJobs] No jobs collected from any API adapter. Check adapters and network.'
    )
    return
  }

  // Normalize all raw jobs (compute hashes, extract tech stack, clean descriptions)
  const normalized = allRawJobs.map(normalize)

  // Batch upsert into the database (50 at a time)
  const { inserted } = await batchUpsert(normalized)

  console.log(
    `[FetchApiJobs] Complete. Processed: ${normalized.length}, DB operations: ${inserted}`
  )
  console.log('[FetchApiJobs] Finished at', new Date().toISOString(), '\n')
}

/**
 * Dev convenience: runs an immediate fetch if the jobs table is empty.
 *
 * WHY THIS EXISTS:
 * On a fresh install, the cron won't run until 02:00 AM.
 * Without seed data, developers stare at an empty job feed all day.
 * This function checks the count and triggers a fetch immediately if needed.
 *
 * Called once from src/index.ts after the server starts listening.
 */
export async function runIfEmpty(): Promise<void> {
  const count = await prisma.job.count()

  if (count === 0) {
    console.log('[FetchApiJobs] Jobs table is empty — running initial API fetch now...')
    await runApiFetch()
  } else {
    console.log(`[FetchApiJobs] Jobs table has ${count} jobs — skipping initial fetch.`)
  }
}

// ─── Schedule Cron ────────────────────────────────────────────────────────────
// Schedule to run at 02:00 AM every day.
// Cron syntax: "0 2 * * *" = minute 0, hour 2, any day, any month, any weekday
//
// WHY 02:00 AM?
// Low server load at night. External APIs (Greenhouse, Lever) are also quieter.
// 02:00 is early enough that fresh jobs are ready when users log in at 09:00.
cron.schedule('0 2 * * *', async () => {
  try {
    await runApiFetch()
  } catch (error) {
    // Even if the cron handler throws, we log it gracefully
    // (node-cron doesn't crash the server on handler errors)
    console.error('[FetchApiJobs] Cron failed:', error)
  }
})

console.log('[FetchApiJobs] Cron scheduled: daily at 02:00 AM')
