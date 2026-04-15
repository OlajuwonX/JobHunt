/**
 * Jobs Service Unit Tests (tests/services/jobs.service.test.ts)
 *
 * Tests the business logic in src/services/jobs.service.ts.
 * We mock Prisma so tests don't touch the real database — they're fast and isolated.
 *
 * WHAT WE TEST:
 *   - scoreJob()             — in-memory match scoring
 *   - batchUpsert()          — deduplication logic (mocked Prisma)
 *   - getJobsForUser()       — pagination + filter logic (mocked Prisma)
 *   - getJobWithScore()      — job detail + ATS score merge (mocked Prisma)
 *   - getUserJobApplication() — application lookup (mocked Prisma)
 *
 * HOW MOCKING WORKS:
 * jest.mock('../utils/prisma') replaces the Prisma singleton with a mock object.
 * We then set the return values for each test: prisma.job.findMany.mockResolvedValue(...)
 * This means the test never hits PostgreSQL — it's pure function testing.
 */

import {
  scoreJob,
  batchUpsert,
  getJobsForUser,
  getJobWithScore,
  getUserJobApplication,
} from '../../src/services/jobs.service'
import { NormalizedJob } from '../../src/types'

// Mock the Prisma client — MUST be before any imports that use prisma
jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    job: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    application: {
      findUnique: jest.fn(),
    },
  },
}))

// Import the mocked prisma to set return values in tests
import prisma from '../../src/utils/prisma'

// Cast to get jest mock types for type-safe mock setup
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ─── Test Fixtures ──────────────────────────────────────────────────────────────

const makeNormalizedJob = (overrides: Partial<NormalizedJob> = {}): NormalizedJob => ({
  jobHash: 'abc123hash',
  title: 'Senior Backend Engineer',
  company: 'Stripe',
  source: 'greenhouse',
  location: 'Remote, US',
  remote: true,
  description:
    'We are looking for a backend engineer with Python, PostgreSQL, and Redis experience.',
  requirements: ['5+ years experience', 'Distributed systems knowledge'],
  techStack: ['Python', 'PostgreSQL', 'Redis', 'AWS'],
  applyUrl: 'https://greenhouse.io/stripe/jobs/123',
  sourceUrl: 'https://greenhouse.io/stripe/jobs/123',
  postedAt: new Date('2024-01-15'),
  salaryRange: '$180k - $250k',
  ...overrides,
})

const makeJobDbRow = (overrides = {}) => ({
  id: 'clx_job_123',
  title: 'Senior Backend Engineer',
  company: 'Stripe',
  source: 'greenhouse',
  location: 'Remote, US',
  remote: true,
  description: 'We need a Python expert with PostgreSQL and Redis experience.',
  requirements: ['5+ years experience'],
  techStack: ['Python', 'PostgreSQL', 'Redis'],
  applyUrl: 'https://example.com/apply',
  sourceUrl: 'https://example.com/job',
  salaryRange: null,
  postedAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  atsScores: [],
  ...overrides,
})

// ─── scoreJob() Tests ──────────────────────────────────────────────────────────

describe('scoreJob()', () => {
  it('should return 100 for a perfect match (role + all skills + remote pref)', () => {
    const job = {
      title: 'Senior Backend Engineer',
      techStack: ['Python', 'PostgreSQL', 'Redis'],
      remote: true,
      description: 'Backend role with Python, PostgreSQL, Redis',
    }
    const profile = {
      roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL', 'Redis'],
      remotePref: 'remote',
      location: 'US',
    }

    const score = scoreJob(job, profile)
    // Role match: 40, Skills: 3/3 × 40 = 40, Remote: 20 → 100
    expect(score).toBe(100)
  })

  it('should return 0 for no match at all', () => {
    const job = {
      title: 'Marketing Manager',
      techStack: ['Salesforce', 'HubSpot'],
      remote: false,
      description: 'Marketing role',
    }
    const profile = {
      roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL'],
      remotePref: 'remote', // wants remote but job is not
      location: 'US',
    }

    const score = scoreJob(job, profile)
    // Role: 0, Skills: 0/2 × 40 = 0, Remote: mismatch = 0 → 0
    expect(score).toBe(0)
  })

  it('should give partial score for partial skill match', () => {
    const job = {
      title: 'Backend Engineer', // matches role → 40 pts
      techStack: ['Python', 'Docker'], // user has Python only → 1/2 match
      remote: false,
      description: 'Backend role',
    }
    const profile = {
      roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL'], // 1 out of 2 matches
      remotePref: 'any', // flexible → 10 pts
      location: null,
    }

    const score = scoreJob(job, profile)
    // Role: 40, Skills: 1/2 × 40 = 20, Remote (any): 10 → 70
    expect(score).toBe(70)
  })

  it('should give 20 pts for remote preference match (both sides)', () => {
    const remoteJob = { title: 'Engineer', techStack: [], remote: true, description: '' }
    const onsiteJob = { title: 'Engineer', techStack: [], remote: false, description: '' }

    const remoteProfile = { roles: [], skills: [], remotePref: 'remote', location: null }
    const onsiteProfile = { roles: [], skills: [], remotePref: 'onsite', location: null }

    // Remote user + remote job = 20
    expect(scoreJob(remoteJob, remoteProfile)).toBe(20)
    // Onsite user + onsite job = 20
    expect(scoreJob(onsiteJob, onsiteProfile)).toBe(20)
    // Remote user + onsite job = 0 (mismatch)
    expect(scoreJob(onsiteJob, remoteProfile)).toBe(0)
  })

  it('should give 10 pts for flexible remote preference', () => {
    const job = { title: 'Engineer', techStack: [], remote: true, description: '' }
    const profile = { roles: [], skills: [], remotePref: 'any', location: null }

    expect(scoreJob(job, profile)).toBe(10)
  })

  it('should handle empty profile gracefully without throwing', () => {
    const job = {
      title: 'Software Engineer',
      techStack: ['Python'],
      remote: true,
      description: 'A role',
    }
    const emptyProfile = { roles: [], skills: [], remotePref: 'any', location: null }

    // Should not throw — just return the remote preference score
    expect(() => scoreJob(job, emptyProfile)).not.toThrow()
    expect(scoreJob(job, emptyProfile)).toBe(10) // only remote flex match
  })

  it('should be case-insensitive for role matching', () => {
    const job = { title: 'SENIOR BACKEND ENGINEER', techStack: [], remote: false, description: '' }
    const profile = {
      roles: ['backend engineer'],
      skills: [],
      remotePref: 'onsite',
      location: null,
    }

    const score = scoreJob(job, profile)
    // Role match (case-insensitive): 40, Remote onsite match: 20 → 60
    expect(score).toBe(60)
  })

  it('should never exceed 100', () => {
    const job = {
      title: 'Senior Backend Engineer',
      techStack: ['Python', 'PostgreSQL', 'Redis', 'AWS', 'Docker'],
      remote: true,
      description: '',
    }
    const profile = {
      roles: ['Backend Engineer', 'Senior Engineer'],
      skills: ['Python', 'PostgreSQL', 'Redis', 'AWS', 'Docker'],
      remotePref: 'remote',
      location: null,
    }

    const score = scoreJob(job, profile)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

// ─── batchUpsert() Tests ───────────────────────────────────────────────────────

describe('batchUpsert()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return { inserted: 0, skipped: 0 } for empty array', async () => {
    const result = await batchUpsert([])
    expect(result).toEqual({ inserted: 0, skipped: 0 })
    // Prisma should not be called at all for empty input
    expect(mockPrisma.job.upsert).not.toHaveBeenCalled()
  })

  it('should call prisma.job.upsert for each job in the batch', async () => {
    const jobs = [
      makeNormalizedJob({ jobHash: 'hash1' }),
      makeNormalizedJob({ jobHash: 'hash2' }),
      makeNormalizedJob({ jobHash: 'hash3' }),
    ]

    // Mock upsert to return a resolved value (simulating a successful DB write)
    ;(mockPrisma.job.upsert as jest.Mock).mockResolvedValue({ id: 'clx_123' })

    const result = await batchUpsert(jobs)

    // Should have called upsert 3 times (one per job)
    expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(3)
    // All 3 succeeded → inserted = 3
    expect(result.inserted).toBe(3)
  })

  it('should continue processing when one upsert fails', async () => {
    const jobs = [
      makeNormalizedJob({ jobHash: 'hash1' }),
      makeNormalizedJob({ jobHash: 'hash2' }),
      makeNormalizedJob({ jobHash: 'hash3' }),
    ]

    // Second upsert fails, others succeed
    ;(mockPrisma.job.upsert as jest.Mock)
      .mockResolvedValueOnce({ id: 'clx_1' })
      .mockRejectedValueOnce(new Error('Unique constraint failed'))
      .mockResolvedValueOnce({ id: 'clx_3' })

    const result = await batchUpsert(jobs)

    // All 3 were attempted
    expect(mockPrisma.job.upsert).toHaveBeenCalledTimes(3)
    // 2 succeeded, 1 failed — inserted should be 2
    expect(result.inserted).toBe(2)
  })

  it('should pass correct create fields to prisma upsert', async () => {
    const job = makeNormalizedJob()
    ;(mockPrisma.job.upsert as jest.Mock).mockResolvedValue({ id: 'clx_123' })

    await batchUpsert([job])

    const upsertCall = (mockPrisma.job.upsert as jest.Mock).mock.calls[0][0]

    // Verify the where clause uses jobHash for deduplication
    expect(upsertCall.where).toEqual({ jobHash: job.jobHash })
    // Verify update is empty (first-source-wins)
    expect(upsertCall.update).toEqual({})
    // Verify create includes all required fields
    expect(upsertCall.create).toMatchObject({
      title: job.title,
      company: job.company,
      source: job.source,
      remote: job.remote,
    })
  })
})

// ─── getJobsForUser() Tests ────────────────────────────────────────────────────

describe('getJobsForUser()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return paginated jobs with pagination metadata', async () => {
    const mockJobs = [makeJobDbRow(), makeJobDbRow({ id: 'clx_456' })]

    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(42)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null) // no profile

    const result = await getJobsForUser('user_123', { page: 1, limit: 20 })

    expect(result.jobs).toHaveLength(2)
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    })
  })

  it('should run count and findMany in parallel (both called)', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    await getJobsForUser('user_123', {})

    // Both count and findMany must be called — parallel execution
    expect(mockPrisma.job.count).toHaveBeenCalledTimes(1)
    expect(mockPrisma.job.findMany).toHaveBeenCalledTimes(1)
  })

  it('should add matchScore when user has a profile', async () => {
    const mockJob = makeJobDbRow({
      title: 'Backend Engineer',
      techStack: ['Python', 'PostgreSQL'],
      remote: true,
    })

    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([mockJob])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue({
      roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL'],
      remotePref: 'remote',
      location: null,
    })

    const result = await getJobsForUser('user_123', {})

    expect(result.jobs[0].matchScore).toBeDefined()
    expect(typeof result.jobs[0].matchScore).toBe('number')
    expect(result.jobs[0].matchScore).toBeGreaterThan(0)
  })

  it('should not add matchScore when user has no profile', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([makeJobDbRow()])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getJobsForUser('user_123', {})

    expect(result.jobs[0].matchScore).toBeUndefined()
  })

  it('should cap limit at 50 even if caller requests more', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    await getJobsForUser('user_123', { limit: 999 }) // try to request 999

    // findMany should be called with take: 50 (capped)
    const findManyCall = (mockPrisma.job.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.take).toBe(50)
  })

  it('should apply remote filter to the where clause', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    await getJobsForUser('user_123', { remote: true })

    const countCall = (mockPrisma.job.count as jest.Mock).mock.calls[0][0]
    expect(countCall.where).toMatchObject({ remote: true })
  })

  it('should apply search (q) filter to where clause using OR condition', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    await getJobsForUser('user_123', { q: 'engineer' })

    const countCall = (mockPrisma.job.count as jest.Mock).mock.calls[0][0]
    // Should have an OR clause for title and company
    expect(countCall.where.OR).toBeDefined()
    expect(countCall.where.OR).toHaveLength(2)
  })

  it('should calculate correct hasPrev and hasNext', async () => {
    ;(mockPrisma.job.count as jest.Mock).mockResolvedValue(100)
    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    // Page 2 of 5 (100 items / 20 per page = 5 pages)
    const result = await getJobsForUser('user_123', { page: 2, limit: 20 })

    expect(result.pagination.hasNext).toBe(true)
    expect(result.pagination.hasPrev).toBe(true)
  })
})

// ─── getJobWithScore() Tests ───────────────────────────────────────────────────

describe('getJobWithScore()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null when job is not found', async () => {
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getJobWithScore('nonexistent_id', 'user_123')
    expect(result).toBeNull()
  })

  it('should return job with atsScore null when no score has been computed', async () => {
    const mockJob = makeJobDbRow({ atsScores: [] })
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getJobWithScore('clx_job_123', 'user_123')

    expect(result).not.toBeNull()
    expect(result!.atsScore).toBeNull()
  })

  it('should return the cached ATS score when available', async () => {
    const mockJob = makeJobDbRow({
      atsScores: [
        {
          score: 85,
          suggestions: ['Add TypeScript to your profile'],
          scoredAt: new Date('2024-01-16'),
        },
      ],
    })
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getJobWithScore('clx_job_123', 'user_123')

    expect(result!.atsScore).not.toBeNull()
    expect(result!.atsScore!.score).toBe(85)
    expect(result!.atsScore!.suggestions).toHaveLength(1)
  })

  it('should include matchScore when user has a profile', async () => {
    const mockJob = makeJobDbRow({
      title: 'Backend Engineer',
      techStack: ['Python'],
      atsScores: [],
    })
    ;(mockPrisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue({
      roles: ['Backend Engineer'],
      skills: ['Python'],
      remotePref: 'remote',
      location: null,
    })

    const result = await getJobWithScore('clx_job_123', 'user_123')

    expect(result!.matchScore).toBeDefined()
    expect(result!.matchScore).toBeGreaterThan(0)
  })
})

// ─── getUserJobApplication() Tests ────────────────────────────────────────────

describe('getUserJobApplication()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null when user has not applied', async () => {
    ;(mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getUserJobApplication('user_123', 'job_456')
    expect(result).toBeNull()
  })

  it('should return the application when found', async () => {
    const mockApp = { id: 'app_123', status: 'applied', appliedAt: new Date() }
    ;(mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(mockApp)

    const result = await getUserJobApplication('user_123', 'job_456')
    expect(result).toEqual(mockApp)
  })

  it('should query using the composite unique index (userId + jobId)', async () => {
    ;(mockPrisma.application.findUnique as jest.Mock).mockResolvedValue(null)

    await getUserJobApplication('user_123', 'job_456')

    const findUniqueCall = (mockPrisma.application.findUnique as jest.Mock).mock.calls[0][0]
    expect(findUniqueCall.where).toEqual({
      userId_jobId: { userId: 'user_123', jobId: 'job_456' },
    })
  })
})
