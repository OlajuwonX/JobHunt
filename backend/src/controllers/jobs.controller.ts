/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs Controller (src/controllers/jobs.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles all job-related HTTP request/response logic.
 * Business logic lives in jobs.service.ts — controllers are thin:
 *   1. Validate the request (Zod)
 *   2. Call the service
 *   3. Return the response
 *
 * ENDPOINTS:
 *   GET  /api/v1/jobs         → getJobs    — paginated, filtered job feed
 *   GET  /api/v1/jobs/:id     → getJobById — full job detail with ATS score
 *   POST /api/v1/jobs/fetch   → triggerFetch — admin trigger for immediate fetch
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { AppError } from '../middleware/errorHandler'
import { sendSuccess } from '../utils/response'
import * as jobsService from '../services/jobs.service'
import { runApiFetch } from '../jobs/fetchApiJobs'
import { runScraperFetch } from '../jobs/fetchScraperJobs'

// ─── Validation Schemas ────────────────────────────────────────────────────────

/**
 * All supported job sources — matches the JobSource union type in src/types/index.ts.
 * Zod validates that the ?source= query param is one of these exact strings.
 * Adding a new source: add it here AND in src/types/index.ts AND src/integrations/types.ts.
 */
const JOB_SOURCE_ENUM = z.enum([
  'greenhouse',
  'lever',
  'remotive',
  'arbeitnow',
  'jobicy',
  'themuse',
  'weworkremotely',
  'jobberman',
  'myjobmag',
  'hotnigerianjobs',
  'ngcareers',
])

/**
 * Validates query parameters for GET /api/v1/jobs.
 * Note: query params arrive as strings. z.coerce.number() converts "20" → 20.
 * z.coerce.boolean() converts "true" → true, "false" → false.
 */
const jobFiltersSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),

  // Filters
  source: JOB_SOURCE_ENUM.optional(),
  remote: z.coerce.boolean().optional(),

  // Full-text search — searches title and company name
  q: z.string().max(100).optional(),

  // Category filter (stored in the techStack or for future category field)
  category: z.string().max(50).optional(),

  // Date filter — show jobs posted after this date
  // z.coerce.date() converts a string like "2024-01-01" to a Date object
  since: z.coerce.date().optional(),

  // Minimum match score — filter out low-relevance jobs (0–100)
  minScore: z.coerce.number().min(0).max(100).optional(),
})

// ─── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/jobs
 *
 * Returns a paginated, filtered list of jobs matched to the logged-in user.
 * Jobs are sorted by postedAt DESC (newest first).
 * If the user has a profile with skills/roles, each job gets a matchScore (0–100).
 *
 * Query params:
 *   ?page=1           — page number (default: 1)
 *   ?limit=20         — items per page (default: 20, max: 50)
 *   ?source=remotive  — filter by source platform
 *   ?remote=true      — remote jobs only
 *   ?q=engineer       — search title and company (case-insensitive)
 *   ?since=2024-01-01 — jobs posted after this date
 *   ?minScore=70      — only jobs with match score >= 70
 */
export const getJobs = asyncHandler(async (req: Request, res: Response) => {
  // Parse and validate query params — throws ZodError if invalid (caught by errorHandler)
  const filters = jobFiltersSchema.parse(req.query)
  const userId = req.user!.id

  const result = await jobsService.getJobsForUser(userId, {
    page: filters.page,
    limit: filters.limit,
    source: filters.source,
    remote: filters.remote,
    q: filters.q,
    category: filters.category,
    since: filters.since,
    minScore: filters.minScore,
  })

  sendSuccess(res, {
    items: result.jobs,
    pagination: result.pagination,
  })
})

/**
 * GET /api/v1/jobs/:id
 *
 * Returns full detail for a single job including:
 *   - Full description
 *   - Extracted requirements and tech stack
 *   - User's in-memory match score
 *   - Cached ATS score (if the background cron has run for this user+job)
 *   - Whether the user has already applied
 *
 * Returns 404 if the job doesn't exist.
 */
export const getJobById = asyncHandler(async (req: Request, res: Response) => {
  // req.params is typed as ParamsDictionary (Record<string, string>) — safe to access as string
  const id = req.params['id'] as string
  const userId = req.user!.id

  if (!id) {
    throw new AppError('Job ID is required', 400)
  }

  const job = await jobsService.getJobWithScore(id, userId)

  if (!job) {
    throw new AppError('Job not found', 404)
  }

  // Also check if user has applied for this job
  const application = await jobsService.getUserJobApplication(userId, id)

  sendSuccess(res, {
    job,
    application, // null if not applied, or { id, status, appliedAt } if applied
  })
})

/**
 * POST /api/v1/jobs/fetch
 *
 * Manually triggers an immediate job fetch from all sources (APIs + scrapers).
 * Responds with 202 Accepted immediately — the actual fetch runs in background.
 *
 * WHY 202 ACCEPTED?
 * 202 means "I received your request and will process it, but it's not done yet."
 * The fetch takes 2–5 minutes (scrapers are slow). We don't want to hold the
 * HTTP connection open that long — that would time out.
 * Instead: respond immediately, run the fetch in background via setImmediate().
 *
 * SECURITY NOTE:
 * In production this should be restricted to admin users.
 * For MVP, requireAuth (any logged-in user) is sufficient.
 * Add role check: if (req.user!.role !== 'admin') throw new AppError('Forbidden', 403)
 */
export const triggerFetch = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id

  // Log who triggered the fetch for audit purposes
  console.log(
    `[triggerFetch] Manual fetch triggered by user: ${userId} at ${new Date().toISOString()}`
  )

  // Respond immediately with 202 Accepted
  // The frontend can poll the job count or use a loading state
  sendSuccess(
    res,
    {
      message: 'Job fetch started in background. New jobs will appear within 5 minutes.',
      triggeredAt: new Date().toISOString(),
    },
    202
  )

  // Run both fetches in the background after the response is sent
  // setImmediate() defers execution until the current event loop cycle completes
  // (i.e., after res.json() finishes — after the HTTP response is sent)
  setImmediate(() => {
    // Run API adapters first (parallel), then scrapers (sequential)
    runApiFetch()
      .then(() => runScraperFetch())
      .then(() => {
        console.log(`[triggerFetch] Background fetch completed at ${new Date().toISOString()}`)
      })
      .catch((error: unknown) => {
        console.error('[triggerFetch] Background fetch failed:', error)
      })
  })
})
