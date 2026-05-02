/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Applications Service (src/services/applications.service.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Business logic for application tracking.
 * Controllers call these functions — no Prisma in controllers.
 *
 * FUNCTIONS:
 *   getApplications()   — paginated list with job details
 *   createApplication() — upsert (create or update) an application record
 *   updateApplication() — change status (applied → rejected | offer)
 *   deleteApplication() — remove an application record
 *   getApplicationStats() — aggregate stats for the stats widget
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../utils/prisma'
import { AppError } from '../middleware/errorHandler'
import { ApplicationWithJob, ApplicationStats } from '../types'

// ─── Prisma select for job fields inside an application ─────────────────────
const JOB_IN_APPLICATION_SELECT = {
  id: true,
  title: true,
  company: true,
  source: true,
  location: true,
  remote: true,
  postedAt: true,
  applyUrl: true,
  category: true,
  country: true,
  salaryRange: true,
  techStack: true,
}

// ─── getApplications ─────────────────────────────────────────────────────────

/**
 * Returns a paginated list of the user's applications with job details.
 *
 * @param userId  - The authenticated user's ID
 * @param filters - Optional status filter + pagination params
 */
export async function getApplications(
  userId: string,
  filters: { status?: string; page?: number; limit?: number }
): Promise<{
  items: ApplicationWithJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}> {
  const page = filters.page ?? 1
  const limit = Math.min(filters.limit ?? 20, 50)
  const skip = (page - 1) * limit

  const where: { userId: string; status?: string } = { userId }
  if (filters.status) {
    where.status = filters.status
  }

  // Run count and list in parallel for performance
  const [total, items] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: {
        job: {
          select: JOB_IN_APPLICATION_SELECT,
        },
      },
      orderBy: { appliedAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  return {
    items: items as ApplicationWithJob[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

// ─── createApplication ────────────────────────────────────────────────────────

/**
 * Creates or updates an application record for the given user and job.
 * Uses upsert — if the user already has a record for this job, it updates
 * the status instead of throwing a unique constraint error.
 *
 * @param userId - The authenticated user's ID
 * @param input  - { jobId, status }
 * @throws AppError(404) if the job does not exist
 */
export async function createApplication(
  userId: string,
  input: { jobId: string; status: 'applied' | 'saved' }
): Promise<ApplicationWithJob> {
  // Verify the job exists before creating a record
  const job = await prisma.job.findUnique({ where: { id: input.jobId } })
  if (!job) {
    throw new AppError('Job not found', 404)
  }

  // Upsert: create if new, update status if already exists
  await prisma.application.upsert({
    where: { userId_jobId: { userId, jobId: input.jobId } },
    create: {
      userId,
      jobId: input.jobId,
      status: input.status,
    },
    update: {
      status: input.status,
      updatedAt: new Date(),
    },
  })

  // Fetch the full application with job details for the response
  const application = await prisma.application.findUnique({
    where: { userId_jobId: { userId, jobId: input.jobId } },
    include: {
      job: {
        select: JOB_IN_APPLICATION_SELECT,
      },
    },
  })

  // application will always exist at this point (we just upserted it)
  return application as ApplicationWithJob
}

// ─── updateApplication ────────────────────────────────────────────────────────

/**
 * Updates the status of an existing application.
 * Ownership is verified: if the application belongs to a different user,
 * we return 404 (not 403) to avoid leaking that the record exists.
 *
 * @param id     - The application's ID
 * @param userId - The authenticated user's ID
 * @param input  - { status }
 * @throws AppError(404) if not found or not owned by this user
 */
export async function updateApplication(
  id: string,
  userId: string,
  input: { status: string }
): Promise<ApplicationWithJob> {
  // Check existence and ownership in one query
  const existing = await prisma.application.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    throw new AppError('Application not found', 404)
  }

  const updated = await prisma.application.update({
    where: { id },
    data: {
      status: input.status,
      updatedAt: new Date(),
    },
    include: {
      job: {
        select: JOB_IN_APPLICATION_SELECT,
      },
    },
  })

  return updated as ApplicationWithJob
}

// ─── deleteApplication ────────────────────────────────────────────────────────

/**
 * Removes an application record.
 * Ownership is verified: returns 404 for both not-found and wrong-owner cases
 * to avoid leaking that the record exists.
 *
 * @param id     - The application's ID
 * @param userId - The authenticated user's ID
 * @throws AppError(404) if not found or not owned by this user
 */
export async function deleteApplication(id: string, userId: string): Promise<void> {
  const existing = await prisma.application.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    throw new AppError('Application not found', 404)
  }

  await prisma.application.delete({ where: { id } })
}

// ─── getApplicationStats ──────────────────────────────────────────────────────

/**
 * Returns aggregate statistics for the user's application dashboard.
 *
 * Runs all queries in parallel with Promise.all for performance.
 *
 * @param userId - The authenticated user's ID
 */
export async function getApplicationStats(userId: string): Promise<ApplicationStats> {
  // Start of today (midnight UTC)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Start of current ISO week (Monday midnight)
  const weekStart = getMondayOf(new Date())

  const [statusGroups, appliedToday, appliedThisWeek, allApplications] = await Promise.all([
    // 1. Count by status
    prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),

    // 2. Count applications submitted today
    prisma.application.count({
      where: { userId, appliedAt: { gte: todayStart } },
    }),

    // 3. Count applications submitted this week
    prisma.application.count({
      where: { userId, appliedAt: { gte: weekStart } },
    }),

    // 4. All applications with job source for topSources calculation
    prisma.application.findMany({
      where: { userId },
      include: { job: { select: { source: true } } },
    }),
  ])

  // Reduce groupBy result into flat totals object
  const totals = { applied: 0, saved: 0, rejected: 0, offers: 0 }
  for (const group of statusGroups) {
    if (group.status === 'applied') totals.applied = group._count._all
    else if (group.status === 'saved') totals.saved = group._count._all
    else if (group.status === 'rejected') totals.rejected = group._count._all
    else if (group.status === 'offer') totals.offers = group._count._all
  }

  // Group by source and find top 3
  const sourceMap = new Map<string, number>()
  for (const app of allApplications) {
    const source = app.job.source
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1)
  }

  const topSources = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    totals,
    appliedToday,
    appliedThisWeek,
    topSources,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the Monday of the week containing the given date, at midnight.
 */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
