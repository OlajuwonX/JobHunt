/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications Routes (src/routes/applications.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tracks job applications per user.
 *
 * Full paths (mounted at /api/v1/applications):
 *   GET    /api/v1/applications      — list the user's applications
 *   POST   /api/v1/applications      — create a new application record
 *   PATCH  /api/v1/applications/:id  — update application status
 *   DELETE /api/v1/applications/:id  — remove an application record
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from '../controllers/applications.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.use(requireAuth)

router.get('/', getApplications)
router.post('/', createApplication)
router.patch('/:id', updateApplication)
router.delete('/:id', deleteApplication)

export default router
