/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs Routes (src/routes/jobs.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Full paths (mounted at /api/v1/jobs in app.ts):
 *
 *   GET  /api/v1/jobs         — paginated, filtered job feed for the logged-in user
 *   GET  /api/v1/jobs/:id     — full job detail with ATS score and application status
 *   POST /api/v1/jobs/fetch   — admin: manually trigger immediate job fetch
 *
 * ROUTE ORDER MATTERS:
 * '/fetch' MUST be defined before '/:id'. If '/:id' came first, Express would
 * match GET /jobs/fetch as a request for job with id="fetch" — wrong behavior.
 * Express matches routes in the order they're defined, top to bottom.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { getJobs, getJobById, triggerFetch } from '../controllers/jobs.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// All job routes require the user to be logged in
// requireAuth middleware reads the JWT from the HTTP-only cookie and sets req.user
router.use(requireAuth)

// GET /api/v1/jobs
// Returns a paginated list of jobs matched to the user's profile.
// Supported query params:
//   ?page=1           — page number (default: 1)
//   ?limit=20         — items per page (default: 20, max: 50)
//   ?source=lever     — filter by job source (greenhouse | lever | remotive | ...)
//   ?remote=true      — filter remote-only jobs
//   ?q=engineer       — full-text search on title and company (case-insensitive)
//   ?category=design  — filter by job category
//   ?since=2024-01-01 — show only jobs posted after this date
//   ?minScore=70      — show only jobs with match score >= 70
router.get('/', getJobs)

// POST /api/v1/jobs/fetch
// Manually triggers an immediate job ingestion from all sources.
// IMPORTANT: Must be defined BEFORE /:id to prevent "fetch" being treated as a job ID.
// Responds 202 immediately; actual fetch runs in background via setImmediate().
router.post('/fetch', triggerFetch)

// GET /api/v1/jobs/:id
// Returns full detail for a single job plus ATS score and application status.
router.get('/:id', getJobById)

export default router
