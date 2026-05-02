/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Controller (src/controllers/dashboard.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles HTTP request/response for the dashboard statistics endpoint.
 * Delegates all computation to dashboardService.
 *
 * Endpoint:
 *   GET /api/v1/dashboard — full dashboard stats in one call
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess } from '../utils/response'
import * as dashboardService from '../services/dashboard.service'

/**
 * GET /api/v1/dashboard
 * Returns all dashboard statistics for the authenticated user.
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const stats = await dashboardService.getDashboardStats(userId)
  sendSuccess(res, stats)
})
