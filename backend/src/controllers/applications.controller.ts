/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications Controller (src/controllers/applications.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { sendSuccess, sendCreated } from '../utils/response'

const createApplicationSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
  status: z.enum(['applied', 'saved']).default('applied'),
})

const updateApplicationSchema = z.object({
  status: z.enum(['applied', 'saved', 'rejected', 'offer']),
})

export const getApplications = asyncHandler(async (req: Request, res: Response) => {
  const _userId = req.user!.id
  // const applications = await applicationsService.getApplications(_userId)
  sendSuccess(res, { items: [], message: 'Applications — coming soon' })
})

export const createApplication = asyncHandler(async (req: Request, res: Response) => {
  const _userId = req.user!.id
  const _input = createApplicationSchema.parse(req.body)
  // const application = await applicationsService.createApplication(_userId, _input)
  sendCreated(res, { message: 'Application created — coming soon' })
})

export const updateApplication = asyncHandler(async (req: Request, res: Response) => {
  const _userId = req.user!.id
  const { id } = req.params
  const _input = updateApplicationSchema.parse(req.body)
  // const application = await applicationsService.updateApplication(id, _userId, _input)
  sendSuccess(res, { id, message: 'Application updated — coming soon' })
})

export const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  const _userId = req.user!.id
  const { id: _id } = req.params
  // await applicationsService.deleteApplication(_id, _userId)
  sendSuccess(res, { message: 'Application removed' })
})
