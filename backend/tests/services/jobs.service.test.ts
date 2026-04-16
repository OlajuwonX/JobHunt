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
      findMany: jest.fn(),
      createMany: jest.fn(),
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
  fuzzyHash: 'fuzzyhash_senior_backend_engineer_stripe_remote',
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
  category: 'tech', // required by updated NormalizedJob type
  country: 'global', // required by updated NormalizedJob type
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
  category: 'tech', // intelligence layer field
  country: 'global', // intelligence layer field
  ...overrides,
})

// ─── scoreJob() Tests ──────────────────────────────────────────────────────────
//
// NEW FORMULA (B16 intelligence layer):
//   Role match:    0–30 pts  (expanded via ROLE_SYNONYMS)
//   Skills match:  0–40 pts  (8 pts per skill, capped at 40 — need 5+ skills to max out)
//   Remote pref:   0–15 pts  (15 for perfect match, 7 for 'any', 0 for mismatch)
//   Country match: 0–10 pts  (Nigerian user + Nigerian job, or global user + global job)
//   Recency bonus: 0–5 pts   (job posted < 3 days ago)
//   Max total: 100 pts

describe('scoreJob()', () => {
  it('should return 100 for a perfect match (role + 5 skills + remote + country + recency)', () => {
    // Perfect 100 requires all 5 signal groups to score their maximum:
    //   role:     30 pts (frontend via synonym expansion matches 'react engineer')
    //   skills:   40 pts (5 skills × 8 = 40, hits the cap)
    //   remote:   15 pts (user wants remote, job is remote)
    //   country:  10 pts (Nigerian user + Nigerian job)
    //   recency:   5 pts (posted within last 3 days)
    const job = {
      title: 'React Engineer', // 'react' is in frontend synonyms → role match
      techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
      remote: true,
      postedAt: new Date(), // today → recency bonus triggers
      country: 'nigeria' as string,
    }
    const profile = {
      roles: ['frontend developer'], // expands to include 'react' → matches title
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
      remotePref: 'remote',
      location: 'Lagos, Nigeria', // Nigerian city → isUserNigerian = true
    }

    const score = scoreJob(job, profile)
    // role(30) + skills(40) + remote(15) + country(10) + recency(5) = 100
    expect(score).toBe(100)
  })

  it('should return 0 for no match at all', () => {
    const job = {
      title: 'Marketing Manager',
      techStack: ['Salesforce', 'HubSpot'],
      remote: false,
      postedAt: new Date('2022-01-01'), // old job — no recency bonus
      country: 'global' as string,
    }
    const profile = {
      roles: ['Backend Engineer'],
      skills: ['Python', 'PostgreSQL'],
      remotePref: 'remote', // wants remote but job is not → mismatch = 0
      location: 'Lagos, Nigeria', // Nigerian user + global job → no country bonus
    }

    const score = scoreJob(job, profile)
    // Role: 0 (no synonym match), Skills: 0, Remote: mismatch = 0, Country: 0, Recency: 0 → 0
    expect(score).toBe(0)
  })

  it('should give partial score for partial skill match', () => {
    // New formula: skills earn 8 pts each (not a ratio).
    // 1 skill match = 8 pts (not proportional to total skills).
    const job = {
      title: 'Backend Developer', // 'developer' is in 'software' synonyms → role match (30)
      techStack: ['Python', 'Docker'],
      remote: false,
      postedAt: new Date('2022-01-01'), // old — no recency
      country: undefined as string | undefined,
    }
    const profile = {
      roles: ['Backend Engineer'], // 'backend' synonym group contains 'back-end', 'api engineer', etc.
      skills: ['Python', 'PostgreSQL'], // Python matches, PostgreSQL does not
      remotePref: 'any', // flexible → 7 pts
      location: null,
    }

    const score = scoreJob(job, profile)
    // Role: 30 (backend synonym matches 'backend developer' in title)
    // Skills: 1 match × 8 = 8
    // Remote (any): 7
    // Country: 0 (no location)
    // Recency: 0 (old job)
    // Total: 30 + 8 + 7 = 45
    expect(score).toBe(45)
  })

  it('should give 15 pts for remote preference match (both sides)', () => {
    // scoreJob now requires postedAt — use a fixed old date to avoid recency bonus
    const oldDate = new Date('2022-01-01')
    const remoteJob = { title: 'Engineer', techStack: [], remote: true, postedAt: oldDate }
    const onsiteJob = { title: 'Engineer', techStack: [], remote: false, postedAt: oldDate }

    const remoteProfile = { roles: [], skills: [], remotePref: 'remote', location: null }
    const onsiteProfile = { roles: [], skills: [], remotePref: 'onsite', location: null }

    // Remote user + remote job = 15
    expect(scoreJob(remoteJob, remoteProfile)).toBe(15)
    // Onsite user + onsite job = 15
    expect(scoreJob(onsiteJob, onsiteProfile)).toBe(15)
    // Remote user + onsite job = 0 (mismatch)
    expect(scoreJob(onsiteJob, remoteProfile)).toBe(0)
  })

  it('should give 7 pts for flexible remote preference', () => {
    const job = { title: 'Engineer', techStack: [], remote: true, postedAt: new Date('2022-01-01') }
    const profile = { roles: [], skills: [], remotePref: 'any', location: null }
    // 'any' pref → 7 pts (not 10 as before — reduced to make room for country signal)
    expect(scoreJob(job, profile)).toBe(7)
  })

  it('should handle empty profile gracefully without throwing', () => {
    const job = {
      title: 'Software Engineer',
      techStack: ['Python'],
      remote: true,
      postedAt: new Date('2022-01-01'),
    }
    const emptyProfile = { roles: [], skills: [], remotePref: 'any', location: null }

    // Should not throw — just return the remote preference score
    expect(() => scoreJob(job, emptyProfile)).not.toThrow()
    // 'any' pref = 7 pts, no role/skills, no location for country check
    expect(scoreJob(job, emptyProfile)).toBe(7)
  })

  it('should use ROLE_SYNONYMS to match "frontend developer" against "React Engineer"', () => {
    // This is the key improvement in B16 — synonym expansion catches role variants
    const job = {
      title: 'React Engineer', // does NOT contain 'frontend developer' literally
      techStack: [],
      remote: false,
      postedAt: new Date('2022-01-01'),
    }
    const profile = {
      roles: ['frontend developer'], // 'frontend' → expands to include 'react'
      skills: [],
      remotePref: 'onsite', // matches → 15 pts
      location: null,
    }

    const score = scoreJob(job, profile)
    // Role: 30 (via synonym expansion: 'react' is in frontend synonyms)
    // Remote: 15 (onsite pref + non-remote job)
    // Total: 45
    expect(score).toBe(45)
  })

  it('should award country match bonus for Nigerian user + Nigerian job', () => {
    const job = {
      title: 'Engineer',
      techStack: [],
      remote: false,
      postedAt: new Date('2022-01-01'),
      country: 'nigeria' as string,
    }
    const profile = {
      roles: [],
      skills: [],
      remotePref: 'onsite', // 15 pts (onsite match)
      location: 'Lagos, Nigeria', // Nigerian city → isUserNigerian = true
    }

    const score = scoreJob(job, profile)
    // Remote: 15, Country bonus: 10 → total: 25
    expect(score).toBe(25)
  })

  it('should award country match bonus for global user + global job', () => {
    const job = {
      title: 'Engineer',
      techStack: [],
      remote: false,
      postedAt: new Date('2022-01-01'),
      country: 'global' as string,
    }
    const profile = {
      roles: [],
      skills: [],
      remotePref: 'onsite', // 15 pts
      location: 'San Francisco, US', // not a Nigerian city → isUserNigerian = false
    }

    const score = scoreJob(job, profile)
    // Remote: 15, Country (global user + global job): 10 → total: 25
    expect(score).toBe(25)
  })

  it('should give recency bonus of 5 pts for job posted within last 3 days', () => {
    const recentJob = {
      title: 'Engineer',
      techStack: [],
      remote: false,
      postedAt: new Date(), // posted now — daysOld < 3 → +5
    }
    const oldJob = {
      title: 'Engineer',
      techStack: [],
      remote: false,
      postedAt: new Date('2022-01-01'), // 3+ years ago — no recency bonus
    }
    const profile = { roles: [], skills: [], remotePref: 'onsite', location: null }

    // Old job: 15 pts (onsite match only)
    expect(scoreJob(oldJob, profile)).toBe(15)
    // Recent job: 15 + 5 = 20 pts (onsite + recency)
    expect(scoreJob(recentJob, profile)).toBe(20)
  })

  it('should be case-insensitive for role matching', () => {
    const job = {
      title: 'SENIOR BACKEND ENGINEER',
      techStack: [],
      remote: false,
      postedAt: new Date('2022-01-01'),
    }
    const profile = {
      roles: ['backend engineer'], // lowercase — should still match UPPERCASE title
      skills: [],
      remotePref: 'onsite',
      location: null,
    }

    const score = scoreJob(job, profile)
    // Role match (case-insensitive via toLowerCase): 30
    // Remote onsite match: 15
    // Total: 45
    expect(score).toBe(45)
  })

  it('should never exceed 100', () => {
    const job = {
      title: 'Senior Backend Engineer',
      techStack: ['Python', 'PostgreSQL', 'Redis', 'AWS', 'Docker'],
      remote: true,
      postedAt: new Date(), // recent
      country: 'nigeria' as string,
    }
    const profile = {
      roles: ['Backend Engineer', 'Senior Engineer'],
      skills: ['Python', 'PostgreSQL', 'Redis', 'AWS', 'Docker'],
      remotePref: 'remote',
      location: 'Lagos, Nigeria',
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

  // Helper: mock the two findMany pre-checks returning no existing matches,
  // then mock createMany returning the given count.
  function mockCleanInsert(count: number) {
    // First two findMany calls are the exact-hash and fuzzy-hash pre-checks.
    // Return empty arrays to simulate no existing duplicates.
    ;(mockPrisma.job.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // exact hash pre-check
      .mockResolvedValueOnce([]) // fuzzy hash pre-check
    ;(mockPrisma.job.createMany as jest.Mock).mockResolvedValue({ count })
  }

  it('should return { inserted: 0, skipped: 0 } for empty array', async () => {
    const result = await batchUpsert([])
    expect(result).toEqual({ inserted: 0, skipped: 0 })
    // No DB calls at all for empty input
    expect(mockPrisma.job.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.job.createMany).not.toHaveBeenCalled()
  })

  it('should insert all jobs when none already exist in the DB', async () => {
    const jobs = [
      makeNormalizedJob({ jobHash: 'hash1', fuzzyHash: 'fuzzy1' }),
      makeNormalizedJob({ jobHash: 'hash2', fuzzyHash: 'fuzzy2' }),
      makeNormalizedJob({ jobHash: 'hash3', fuzzyHash: 'fuzzy3' }),
    ]
    mockCleanInsert(3)

    const result = await batchUpsert(jobs)

    // 2 findMany pre-checks + 1 createMany
    expect(mockPrisma.job.findMany).toHaveBeenCalledTimes(2)
    expect(mockPrisma.job.createMany).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ inserted: 3, skipped: 0 })
  })

  it('should skip jobs whose exact jobHash already exists in the DB', async () => {
    const jobs = [
      makeNormalizedJob({ jobHash: 'existing_hash', fuzzyHash: 'fuzzy1' }),
      makeNormalizedJob({ jobHash: 'new_hash', fuzzyHash: 'fuzzy2' }),
    ]

    // Exact pre-check returns 'existing_hash' as already stored
    ;(mockPrisma.job.findMany as jest.Mock)
      .mockResolvedValueOnce([{ jobHash: 'existing_hash' }]) // exact match found
      .mockResolvedValueOnce([]) // no fuzzy match
    ;(mockPrisma.job.createMany as jest.Mock).mockResolvedValue({ count: 1 })

    const result = await batchUpsert(jobs)

    // Only 1 job should reach createMany
    const createManyCall = (mockPrisma.job.createMany as jest.Mock).mock.calls[0][0]
    expect(createManyCall.data).toHaveLength(1)
    expect(createManyCall.data[0].jobHash).toBe('new_hash')
    expect(result).toEqual({ inserted: 1, skipped: 1 })
  })

  it('should skip jobs whose fuzzyHash already exists in the DB (same role, different wording)', async () => {
    // Simulates: "Frontend Developer" at Stripe from Lever arriving after
    // "Frontend Engineer" at Stripe from Greenhouse was already stored.
    // Both canonicalize to the same fuzzyHash.
    const existingFuzzy = 'frontend_engineer_stripe_remote'
    const job = makeNormalizedJob({ jobHash: 'new_exact_hash', fuzzyHash: existingFuzzy })

    ;(mockPrisma.job.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // no exact match
      .mockResolvedValueOnce([{ fuzzyHash: existingFuzzy }]) // fuzzy match found
    ;(mockPrisma.job.createMany as jest.Mock).mockResolvedValue({ count: 0 })

    const result = await batchUpsert([job])

    // createMany should be called with empty data (nothing to insert)
    expect(result).toEqual({ inserted: 0, skipped: 1 })
  })

  it('should deduplicate within-batch fuzzy duplicates (same role from two sources in same run)', async () => {
    // Both jobs have different exact hashes (different wording) but the same
    // fuzzyHash (same canonical role). Neither exists in the DB yet — the
    // pre-check returns empty. But within the batch, only the first should be kept.
    const sharedFuzzy = 'frontend_engineer_stripe_remote'
    const jobs = [
      makeNormalizedJob({ jobHash: 'greenhouse_hash', fuzzyHash: sharedFuzzy }),
      makeNormalizedJob({ jobHash: 'lever_hash', fuzzyHash: sharedFuzzy }),
    ]

    ;(mockPrisma.job.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // no exact matches in DB
      .mockResolvedValueOnce([]) // no fuzzy matches in DB
    ;(mockPrisma.job.createMany as jest.Mock).mockResolvedValue({ count: 1 })

    const result = await batchUpsert(jobs)

    // Only 1 of the 2 should reach createMany (the first one seen)
    const createManyCall = (mockPrisma.job.createMany as jest.Mock).mock.calls[0][0]
    expect(createManyCall.data).toHaveLength(1)
    expect(createManyCall.data[0].jobHash).toBe('greenhouse_hash')
    expect(result).toEqual({ inserted: 1, skipped: 1 })
  })

  it('should pass fuzzyHash and all required fields to createMany', async () => {
    const job = makeNormalizedJob()
    mockCleanInsert(1)

    await batchUpsert([job])

    const createManyCall = (mockPrisma.job.createMany as jest.Mock).mock.calls[0][0]
    const created = createManyCall.data[0]

    expect(created).toMatchObject({
      jobHash: job.jobHash,
      fuzzyHash: job.fuzzyHash,
      title: job.title,
      company: job.company,
      source: job.source,
      remote: job.remote,
      // Intelligence fields must be present in every createMany payload
      category: job.category,
      country: job.country,
    })
    // Safety net flag must be present
    expect(createManyCall.skipDuplicates).toBe(true)
  })

  it('should gracefully handle createMany failure without throwing', async () => {
    const jobs = [makeNormalizedJob({ jobHash: 'hash1', fuzzyHash: 'fuzzy1' })]

    ;(mockPrisma.job.findMany as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.job.createMany as jest.Mock).mockRejectedValue(new Error('DB connection lost'))

    // Should not throw — batchUpsert catches createMany errors and continues
    await expect(batchUpsert(jobs)).resolves.not.toThrow()
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
