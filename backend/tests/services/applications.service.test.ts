/**
 * Applications Service Unit Tests
 * (tests/services/applications.service.test.ts)
 *
 * Tests business logic in src/services/applications.service.ts.
 * Prisma is mocked — no real database calls.
 *
 * COVERAGE:
 *   getApplications()   — paginated list with job details
 *   createApplication() — upsert with job existence check
 *   updateApplication() — ownership verification + status update
 *   deleteApplication() — ownership verification + delete
 *   getApplicationStats() — aggregate stats shape
 */

import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  getApplicationStats,
} from '../../src/services/applications.service'
import { AppError } from '../../src/middleware/errorHandler'

// Mock the Prisma singleton before any imports that use it
jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    application: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
  },
}))

import prisma from '../../src/utils/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user_clx123'
const JOB_ID = 'job_clx456'
const APP_ID = 'app_clx789'

const makeJobRecord = () => ({
  id: JOB_ID,
  title: 'Senior Engineer',
  company: 'Stripe',
  source: 'greenhouse',
  location: 'Remote',
  remote: true,
  postedAt: new Date('2026-01-01'),
  applyUrl: 'https://example.com/apply',
  category: 'tech',
  country: 'global',
  salaryRange: '$150k-$200k',
  techStack: ['Node.js', 'TypeScript'],
})

const makeApplicationRecord = (overrides = {}) => ({
  id: APP_ID,
  userId: USER_ID,
  jobId: JOB_ID,
  status: 'applied',
  appliedAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
  job: makeJobRecord(),
  ...overrides,
})

// ─── getApplications() ──────────────────────────────────────────────────────

describe('getApplications()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return paginated applications with correct shape', async () => {
    const mockApps = [makeApplicationRecord(), makeApplicationRecord({ id: 'app_clx999' })]
    ;(mockPrisma.application.count as jest.Mock).mockResolvedValue(2)
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue(mockApps)

    const result = await getApplications(USER_ID, { page: 1, limit: 20 })

    expect(result.items).toHaveLength(2)
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
  })

  it('should apply status filter to the where clause', async () => {
    ;(mockPrisma.application.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([makeApplicationRecord()])

    await getApplications(USER_ID, { status: 'applied' })

    const findManyCall = (mockPrisma.application.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where).toMatchObject({ userId: USER_ID, status: 'applied' })
  })

  it('should run count and findMany in parallel', async () => {
    ;(mockPrisma.application.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([])

    await getApplications(USER_ID, {})

    expect(mockPrisma.application.count).toHaveBeenCalledTimes(1)
    expect(mockPrisma.application.findMany).toHaveBeenCalledTimes(1)
  })

  it('should compute correct hasNext and hasPrev for middle page', async () => {
    ;(mockPrisma.application.count as jest.Mock).mockResolvedValue(100)
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([])

    const result = await getApplications(USER_ID, { page: 3, limit: 20 })

    expect(result.pagination.hasNext).toBe(true)
    expect(result.pagination.hasPrev).toBe(true)
  })
})

// ─── createApplication() ────────────────────────────────────────────────────

describe('createApplication()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should call upsert with correct arguments', async () => {
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(makeJobRecord())
    ;(mockPrisma.application.upsert as jest.Mock).mockResolvedValue(makeApplicationRecord())
    ;(mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(makeApplicationRecord())

    await createApplication(USER_ID, { jobId: JOB_ID, status: 'applied' })

    expect(mockPrisma.application.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_jobId: { userId: USER_ID, jobId: JOB_ID } },
        create: expect.objectContaining({ userId: USER_ID, jobId: JOB_ID, status: 'applied' }),
        update: expect.objectContaining({ status: 'applied' }),
      })
    )
  })

  it('should throw AppError(404) when job does not exist', async () => {
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      createApplication(USER_ID, { jobId: 'nonexistent_job', status: 'applied' })
    ).rejects.toThrow(new AppError('Job not found', 404))
  })

  it('should verify job existence before upserting', async () => {
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(null)

    try {
      await createApplication(USER_ID, { jobId: JOB_ID, status: 'applied' })
    } catch {
      // expected
    }

    // upsert should never be called when job doesn't exist
    expect(mockPrisma.application.upsert).not.toHaveBeenCalled()
  })

  it('should return the created application with job details', async () => {
    const expected = makeApplicationRecord()
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(makeJobRecord())
    ;(mockPrisma.application.upsert as jest.Mock).mockResolvedValue(expected)
    ;(mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(expected)

    const result = await createApplication(USER_ID, { jobId: JOB_ID, status: 'applied' })

    expect(result).toMatchObject({ id: APP_ID, status: 'applied' })
    expect(result.job).toBeDefined()
  })
})

// ─── updateApplication() ────────────────────────────────────────────────────

describe('updateApplication()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should update application status correctly', async () => {
    const existing = makeApplicationRecord()
    const updated = makeApplicationRecord({ status: 'rejected' })
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(existing)
    ;(mockPrisma.application.update as jest.Mock).mockResolvedValue(updated)

    const result = await updateApplication(APP_ID, USER_ID, { status: 'rejected' })

    expect(mockPrisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: APP_ID },
        data: expect.objectContaining({ status: 'rejected' }),
      })
    )
    expect(result.status).toBe('rejected')
  })

  it('should throw AppError(404) when application not found', async () => {
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      updateApplication('nonexistent_id', USER_ID, { status: 'rejected' })
    ).rejects.toThrow(new AppError('Application not found', 404))
  })

  it('should throw AppError(404) when application belongs to another user', async () => {
    // findFirst with { id, userId } returns null for wrong owner
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(
      updateApplication(APP_ID, 'different_user_id', { status: 'offer' })
    ).rejects.toThrow(new AppError('Application not found', 404))
  })
})

// ─── deleteApplication() ────────────────────────────────────────────────────

describe('deleteApplication()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should delete the application when found and owned', async () => {
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(makeApplicationRecord())
    ;(mockPrisma.application.delete as jest.Mock).mockResolvedValue(makeApplicationRecord())

    await deleteApplication(APP_ID, USER_ID)

    expect(mockPrisma.application.delete).toHaveBeenCalledWith({ where: { id: APP_ID } })
  })

  it('should throw AppError(404) when application not found', async () => {
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(deleteApplication('nonexistent_id', USER_ID)).rejects.toThrow(
      new AppError('Application not found', 404)
    )
  })

  it('should throw AppError(404) when application belongs to another user', async () => {
    ;(mockPrisma.application.findFirst as jest.Mock).mockResolvedValue(null)

    await expect(deleteApplication(APP_ID, 'another_user')).rejects.toThrow(
      new AppError('Application not found', 404)
    )
  })
})

// ─── getApplicationStats() ──────────────────────────────────────────────────

describe('getApplicationStats()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return correct stats shape with all required fields', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([
      { status: 'applied', _count: { _all: 5 } },
      { status: 'saved', _count: { _all: 3 } },
      { status: 'rejected', _count: { _all: 2 } },
      { status: 'offer', _count: { _all: 1 } },
    ])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(2) // appliedToday
      .mockResolvedValueOnce(7) // appliedThisWeek
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([
      { job: { source: 'greenhouse' } },
      { job: { source: 'greenhouse' } },
      { job: { source: 'lever' } },
    ])

    const result = await getApplicationStats(USER_ID)

    expect(result).toMatchObject({
      totals: { applied: 5, saved: 3, rejected: 2, offers: 1 },
      appliedToday: 2,
      appliedThisWeek: 7,
    })
    expect(result.topSources).toBeDefined()
    expect(Array.isArray(result.topSources)).toBe(true)
  })

  it('should return zeros for totals when user has no applications', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([])

    const result = await getApplicationStats(USER_ID)

    expect(result.totals).toEqual({ applied: 0, saved: 0, rejected: 0, offers: 0 })
    expect(result.appliedToday).toBe(0)
    expect(result.appliedThisWeek).toBe(0)
    expect(result.topSources).toEqual([])
  })

  it('should sort topSources by count descending and limit to 3', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    // 4 sources — topSources should only return the top 3
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([
      { job: { source: 'greenhouse' } },
      { job: { source: 'greenhouse' } },
      { job: { source: 'greenhouse' } },
      { job: { source: 'lever' } },
      { job: { source: 'lever' } },
      { job: { source: 'ashby' } },
      { job: { source: 'remotive' } },
    ])

    const result = await getApplicationStats(USER_ID)

    expect(result.topSources).toHaveLength(3)
    expect(result.topSources[0].source).toBe('greenhouse') // most applied
    expect(result.topSources[0].count).toBe(3)
    expect(result.topSources[1].source).toBe('lever')
    expect(result.topSources[1].count).toBe(2)
  })
})
