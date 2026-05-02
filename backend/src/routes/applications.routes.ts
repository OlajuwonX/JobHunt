/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications Routes (src/routes/applications.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tracks job applications per user.
 *
 * Full paths (mounted at /api/v1/applications):
 *   GET    /api/v1/applications/stats  — aggregate stats for the dashboard widget
 *   GET    /api/v1/applications        — list the user's applications (paginated)
 *   POST   /api/v1/applications        — create/upsert a new application record
 *   PATCH  /api/v1/applications/:id    — update application status
 *   DELETE /api/v1/applications/:id    — remove an application record
 *
 * NOTE: /stats MUST be registered BEFORE /:id routes to avoid Express
 * treating 'stats' as an :id param value.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import {
  getApplicationStats,
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from '../controllers/applications.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

// /stats must come before /:id — order matters in Express routing
router.get('/stats', getApplicationStats)
router.get('/', getApplications)
router.post('/', createApplication)
router.patch('/:id', updateApplication)
router.delete('/:id', deleteApplication)

export default router
