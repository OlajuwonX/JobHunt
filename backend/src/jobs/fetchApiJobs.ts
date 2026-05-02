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
 *
 * POST-FETCH NOTIFICATION:
 * After each successful batch, the cron scores newly inserted jobs against
 * each user's profile and emits 'new-jobs' via Socket.io to matched users.
 * This is best-effort — errors never crash the cron.
 */

import cron from 'node-cron'
import prisma from '../utils/prisma'
import { normalize } from '../integrations/normalizer'
import { batchUpsert, scoreJob } from '../services/jobs.service'
import { RawJob } from '../integrations/types'
import { getIO } from '../utils/socket'

// ─── Import API Adapters ──────────────────────────────────────────────────────
import { greenhouseAdapter } from '../integrations/api/greenhouse'
import { ashbyAdapter } from '../integrations/api/ashby'
import { remotiveAdapter } from '../integrations/api/remotive'
import { arbeitnowAdapter } from '../integrations/api/arbeitnow'
import { jobicyAdapter } from '../integrations/api/jobicy'
import { themuseAdapter } from '../integrations/api/themuse'
import { weworkremotelyAdapter } from '../integrations/api/weworkremotely'

// All adapters in one array — easy to add/remove without changing runApiFetch()
// NOTE: Lever adapter removed — Lever's v0 public API deprecated (all slugs 404 as of 2026).
//       Replaced with Ashby (ashbyhq.com), the modern ATS now used by Notion, OpenAI, Ramp, etc.
const API_ADAPTERS = [
  greenhouseAdapter,
  ashbyAdapter,
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
 *   6. Emit 'new-jobs' Socket.io events to matched users (best-effort)
 *   7. Log summary stats
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

  // ── Emit new-jobs notifications to matched users ───────────────────────────
  // Best-effort: wrapped in try/catch so a failure never crashes the cron job.
  // Only runs if any jobs were actually inserted in this run.
  if (inserted > 0) {
    try {
      await emitNewJobsToMatchedUsers(normalized)
    } catch (err) {
      console.warn('[FetchApiJobs] new-jobs emit block failed (non-fatal):', err)
    }
  }

  console.log('[FetchApiJobs] Finished at', new Date().toISOString(), '\n')
}

/**
 * Scores newly inserted jobs against each user with a profile and emits
 * 'new-jobs' Socket.io events to users who have >= 1 job with score >= 40.
 *
 * This is intentionally best-effort:
 *   - No single user failure stops other users from being notified
 *   - getIO() errors are caught — they happen if no socket server is running
 *
 * PERFORMANCE NOTE:
 * We only query profiles once and score in-memory. Scoring is O(jobs × users)
 * but each scoreJob() call is sub-millisecond so this stays fast.
 */
async function emitNewJobsToMatchedUsers(
  newJobs: ReturnType<typeof normalize>[]
): Promise<void> {
  // Only users who have set at least one role (meaningful profile)
  const profiles = await prisma.profile.findMany({
    where: { roles: { isEmpty: false } },
    select: {
      userId: true,
      roles: true,
      skills: true,
      remotePref: true,
      location: true,
    },
  })

  if (profiles.length === 0) return

  for (const profile of profiles) {
    try {
      // Count how many of the new jobs score >= 40 for this user
      const matchingCount = newJobs.filter((job) => {
        const score = scoreJob(
          {
            title: job.title,
            techStack: job.techStack,
            remote: job.remote,
            postedAt: job.postedAt,
            country: job.country,
          },
          {
            roles: profile.roles,
            skills: profile.skills,
            remotePref: profile.remotePref,
            location: profile.location,
          }
        )
        return score >= 40
      }).length

      if (matchingCount > 0) {
        try {
          getIO()
            .to(profile.userId)
            .emit('new-jobs', {
              count: matchingCount,
              message: `${matchingCount} new job${matchingCount === 1 ? '' : 's'} match your profile`,
            })
        } catch {
          // Socket.io not initialized (e.g. during tests) — silently ignore
        }
      }
    } catch (err) {
      // Never let one user's failure stop notifications for others
      console.warn(`[FetchApiJobs] Failed to emit for user ${profile.userId}:`, err)
    }
  }
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
