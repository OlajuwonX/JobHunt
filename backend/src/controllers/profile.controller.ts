/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Profile Controller (src/controllers/profile.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess } from '../utils/response'

const updateProfileSchema = z.object({
  roles: z.array(z.string().min(1)).max(10).optional(),
  location: z.string().max(100).optional(),
  remotePref: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
  skills: z.array(z.string().min(1)).max(50).optional(),
})

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  // const profile = await profileService.getProfile(userId)
  sendSuccess(res, { userId, message: 'Profile — coming soon' })
})

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  const input = updateProfileSchema.parse(req.body)
  // const profile = await profileService.updateProfile(userId, input)
  sendSuccess(res, { userId, input, message: 'Profile update — coming soon' })
})

export const uploadResume = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id
  // File will be in req.file (after multer middleware processes it)
  // const result = await profileService.uploadResume(userId, req.file)
  sendSuccess(res, { userId, message: 'Resume upload — coming soon' })
})
