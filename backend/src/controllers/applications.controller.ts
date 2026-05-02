/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications Controller (src/controllers/applications.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles HTTP request/response for application tracking endpoints.
 * Validates input with Zod, delegates business logic to applicationsService.
 *
 * Endpoints:
 *   GET    /api/v1/applications/stats — application statistics
 *   GET    /api/v1/applications       — list with pagination + status filter
 *   POST   /api/v1/applications       — create/upsert application
 *   PATCH  /api/v1/applications/:id   — update status
 *   DELETE /api/v1/applications/:id   — remove record
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess, sendCreated } from '../utils/response'
import * as applicationsService from '../services/applications.service'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const getApplicationsQuerySchema = z.object({
  status: z.enum(['applied', 'saved', 'rejected', 'offer']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const createApplicationSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
  status: z.enum(['applied', 'saved']).default('applied'),
})

const updateApplicationSchema = z.object({
  status: z.enum(['applied', 'saved', 'rejected', 'offer']),
})

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/applications/stats
 * Returns aggregate statistics for the current user's applications.
 */
export const getApplicationStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const stats = await applicationsService.getApplicationStats(userId)
  sendSuccess(res, stats)
})

/**
 * GET /api/v1/applications
 * Returns paginated list of applications with optional status filter.
 */
export const getApplications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const filters = getApplicationsQuerySchema.parse(req.query)
  const result = await applicationsService.getApplications(userId, filters)
  sendSuccess(res, result)
})

/**
 * POST /api/v1/applications
 * Creates or updates an application record (upsert by userId + jobId).
 */
export const createApplication = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const input = createApplicationSchema.parse(req.body)
  const application = await applicationsService.createApplication(userId, input)
  sendCreated(res, application)
})

/**
 * PATCH /api/v1/applications/:id
 * Updates the status of an existing application.
 */
export const updateApplication = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const id = String(req.params.id)
  const input = updateApplicationSchema.parse(req.body)
  const application = await applicationsService.updateApplication(id, userId, input)
  sendSuccess(res, application)
})

/**
 * DELETE /api/v1/applications/:id
 * Removes an application record.
 */
export const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const id = String(req.params.id)
  await applicationsService.deleteApplication(id, userId)
  sendSuccess(res, { message: 'Application removed' })
})
