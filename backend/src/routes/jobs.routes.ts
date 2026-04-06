/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs Routes (src/routes/jobs.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Full paths (mounted at /api/v1/jobs):
 *   GET  /api/v1/jobs       — paginated, filtered job feed for the logged-in user
 *   GET  /api/v1/jobs/:id   — full job detail including ATS score + suggestions
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { getJobs, getJobById } from '../controllers/jobs.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// All job routes require authentication — no browsing without a profile
router.use(requireAuth)

// GET /api/v1/jobs
// Returns a paginated list of jobs matched to the user's profile.
// Supported query params:
//   ?page=1          — page number (default: 1)
//   ?limit=20        — items per page (default: 20, max: 50)
//   ?source=lever    — filter by job source (greenhouse | lever)
//   ?status=applied  — filter by application status (applied | saved | none)
//   ?minScore=70     — filter by minimum ATS score (0–100)
//   ?remote=true     — filter remote-only jobs
router.get('/', getJobs)

// GET /api/v1/jobs/:id
// Returns full detail for a single job plus the user's ATS score and suggestions.
router.get('/:id', getJobById)

export default router
