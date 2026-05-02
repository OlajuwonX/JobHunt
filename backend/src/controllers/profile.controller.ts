/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Profile Controller (src/controllers/profile.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Handles HTTP request/response for profile management endpoints.
 * Validates input with Zod, delegates business logic to profileService.
 *
 * Endpoints:
 *   GET  /api/v1/profile         — get current user's profile
 *   PUT  /api/v1/profile         — update roles, location, skills, preferences
 *   POST /api/v1/profile/resume  — upload resume (PDF/DOCX) to Cloudinary
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess } from '../utils/response'
import { AppError } from '../middleware/errorHandler'
import * as profileService from '../services/profile.service'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  roles: z.array(z.string().min(1)).max(10).optional(),
  location: z.string().max(100).optional(),
  remotePref: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
  skills: z.array(z.string().min(1)).max(50).optional(),
})

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/profile
 * Returns the current user's profile (including email).
 * Returns safe defaults if the profile hasn't been created yet.
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const profile = await profileService.getProfile(userId)
  sendSuccess(res, profile)
})

/**
 * PUT /api/v1/profile
 * Creates or updates the user's profile preferences.
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const input = updateProfileSchema.parse(req.body)
  const profile = await profileService.updateProfile(userId, input)
  sendSuccess(res, profile)
})

/**
 * POST /api/v1/profile/resume
 * Uploads a resume file (PDF/DOCX) to Cloudinary and stores the private URL.
 *
 * Requires multer resumeUpload middleware to run first (applied in the route).
 * req.file is populated by multer — if missing, the user sent no file.
 */
export const uploadResume = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id

  if (!req.file) {
    throw new AppError('No resume file provided', 400)
  }

  const result = await profileService.uploadResume(userId, req.file)
  sendSuccess(res, result)
})
