/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Profile Service (src/services/profile.service.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for user profile management and resume uploads.
 *
 * FUNCTIONS:
 *   getProfile()    — fetch profile with user email
 *   updateProfile() — upsert profile fields (roles, skills, location, remotePref)
 *   uploadResume()  — upload resume to Cloudinary, store private URL in DB
 *
 * SECURITY:
 *   - Resume URLs are private Cloudinary authenticated URLs (not public)
 *   - passwordHash is never returned — we only include user.email
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../utils/prisma'
import { AppError } from '../middleware/errorHandler'
import { uploadBuffer } from '../integrations/cloudinary'
import { ProfileWithEmail } from '../types'

// ─── getProfile ───────────────────────────────────────────────────────────────

/**
 * Returns the user's profile including their email.
 *
 * If the profile row doesn't exist yet (newly registered user who hasn't
 * completed onboarding), returns a safe default shape so the frontend
 * doesn't have to handle null.
 *
 * @param userId - The authenticated user's ID
 */
export async function getProfile(userId: string): Promise<ProfileWithEmail | object> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      user: {
        select: { email: true }, // never return passwordHash
      },
    },
  })

  if (!profile) {
    // Return a safe default for users who haven't set up their profile yet
    return {
      userId,
      roles: [],
      skills: [],
      location: null,
      remotePref: 'any',
      resumeUrl: null,
    }
  }

  return profile as ProfileWithEmail
}

// ─── updateProfile ────────────────────────────────────────────────────────────

/**
 * Creates or updates the user's profile.
 * Uses upsert so the first PUT creates the profile row, subsequent PUTs update it.
 *
 * Only includes fields that are explicitly provided in the input — undefined
 * fields are omitted from the update to avoid overwriting existing values.
 *
 * @param userId - The authenticated user's ID
 * @param input  - Partial profile fields to update
 */
export async function updateProfile(
  userId: string,
  input: {
    roles?: string[]
    location?: string
    remotePref?: string
    skills?: string[]
  }
): Promise<ProfileWithEmail> {
  // Build update data only from defined fields to avoid overwriting with undefined
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (input.roles !== undefined) updateData.roles = input.roles
  if (input.location !== undefined) updateData.location = input.location
  if (input.remotePref !== undefined) updateData.remotePref = input.remotePref
  if (input.skills !== undefined) updateData.skills = input.skills

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: updateData,
    include: {
      user: {
        select: { email: true },
      },
    },
  })

  return profile as ProfileWithEmail
}

// ─── uploadResume ─────────────────────────────────────────────────────────────

/**
 * Uploads a resume file to Cloudinary and stores the private URL in the DB.
 *
 * SECURITY:
 *   - access_mode: 'authenticated' — Cloudinary will not serve this file publicly
 *   - public_id uses userId — overwrites any previous upload for this user
 *   - overwrite: true — ensures only one resume file per user in Cloudinary
 *
 * @param userId - The authenticated user's ID
 * @param file   - The multer file object from memoryStorage
 * @throws AppError(500) if Cloudinary upload fails
 */
export async function uploadResume(
  userId: string,
  file: Express.Multer.File
): Promise<{ resumeUrl: string }> {
  let result
  try {
    result = await uploadBuffer(file.buffer, {
      folder: 'jobhunt/resumes',
      public_id: userId,
      resource_type: 'raw',
      access_mode: 'authenticated',
      overwrite: true,
    })
  } catch {
    throw new AppError('Resume upload failed', 500)
  }

  // Save the private URL to the profile (create profile row if it doesn't exist)
  await prisma.profile.upsert({
    where: { userId },
    create: { userId, resumeUrl: result.secure_url },
    update: { resumeUrl: result.secure_url },
  })

  return { resumeUrl: result.secure_url }
}
