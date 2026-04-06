/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Routes (src/routes/dashboard.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Provides aggregated stats for the user's application dashboard.
 *
 * Full paths (mounted at /api/v1/dashboard):
 *   GET  /api/v1/dashboard  — returns stats + chart data in one call
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     stats: { today: 3, thisMonth: 27, total: 142 },
 *     bySource: { greenhouse: 18, lever: 9 },
 *     dailyChart: [{ date: '2026-04-01', count: 2 }, ...],
 *     monthlyChart: [{ month: 'Jan', count: 12 }, ...]
 *   }
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { getDashboard } from '../controllers/dashboard.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

router.get('/', getDashboard)

export default router
