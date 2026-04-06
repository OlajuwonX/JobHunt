/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs Controller (src/controllers/jobs.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles job listing and detail retrieval.
 * The actual DB queries and scoring logic live in src/services/jobs.service.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { AppError } from '../middleware/errorHandler'
import { sendSuccess } from '../utils/response'
// import * as jobsService from '../services/jobs.service'

// ─── Query Parameter Validation ───────────────────────────────────────────────
// Validate and coerce query string parameters.
// Note: query params arrive as strings, so we use z.coerce.number() to
// automatically convert "20" (string) to 20 (number).
const jobFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  source: z.enum(['greenhouse', 'lever']).optional(),
  status: z.enum(['applied', 'saved', 'none']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  remote: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
})

/**
 * GET /api/v1/jobs
 * Returns a paginated, filtered list of jobs matched to the user's profile.
 */
export const getJobs = asyncHandler(async (req: Request, res: Response) => {
  // Validate and parse query params
  const filters = jobFiltersSchema.parse(req.query)
  const userId = req.user!.id

  // Fetch jobs from service
  // const result = await jobsService.getJobsForUser(userId, filters)
  // TODO: uncomment when service is ready

  // Placeholder response while service is being built
  sendSuccess(res, {
    items: [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  })
})

/**
 * GET /api/v1/jobs/:id
 * Returns full detail for a single job including the user's ATS score.
 */
export const getJobById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  if (!id) {
    throw new AppError('Job ID is required', 400)
  }

  // Fetches job + ats score for this user
  // const job = await jobsService.getJobWithScore(id, userId)
  // if (!job) throw new AppError('Job not found', 404)
  // TODO: uncomment when service is ready

  sendSuccess(res, { id, message: 'Job detail — coming soon' })
})
