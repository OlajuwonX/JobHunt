/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Controller (src/controllers/dashboard.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess } from '../utils/response'

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const _userId = req.user!.id
  // const stats = await dashboardService.getDashboardStats(userId)
  sendSuccess(res, {
    stats: { today: 0, thisMonth: 0, total: 0 },
    bySource: { greenhouse: 0, lever: 0 },
    dailyChart: [],
    monthlyChart: [],
  })
})
