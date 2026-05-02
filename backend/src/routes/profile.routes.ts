/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Profile Routes (src/routes/profile.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Full paths (mounted at /api/v1/profile):
 *   GET   /api/v1/profile         — get current user's profile
 *   PUT   /api/v1/profile         — update roles, location, skills, preferences
 *   POST  /api/v1/profile/resume  — upload resume (PDF/DOCX) to Cloudinary
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { getProfile, updateProfile, uploadResume } from '../controllers/profile.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { resumeUpload } from '../middleware/upload.middleware'

const router = Router()

// All profile routes require authentication
router.use(requireAuth)

router.get('/', getProfile)
router.put('/', updateProfile)
// resumeUpload middleware runs first — populates req.file from multipart/form-data
router.post('/resume', resumeUpload, uploadResume)

export default router
