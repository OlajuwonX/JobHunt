/**
 * Dashboard Service Unit Tests
 * (tests/services/dashboard.service.test.ts)
 *
 * Tests business logic in src/services/dashboard.service.ts.
 * Prisma is mocked — no real database calls.
 *
 * COVERAGE:
 *   getDashboardStats() — full shape, streak, weeklyTrend, profileScore
 */

import { getDashboardStats } from '../../src/services/dashboard.service'

// Mock Prisma singleton
jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    application: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
  },
}))

import prisma from '../../src/utils/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user_clx123'

/**
 * Creates a default set of mock responses for all 8 parallel queries.
 * Individual tests can override specific mocks.
 *
 * findMany is called 4 times in getDashboardStats:
 *   1. dailyRaw    — { appliedAt }
 *   2. weeklyRaw   — { appliedAt }
 *   3. bySource    — { job: { source } } (include)
 *   4. streakRaw   — { appliedAt }
 */
function setupDefaultMocks() {
  // 1. groupBy status
  ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])

  // findMany called 4 times — return empty array for all by default
  ;(mockPrisma.application.findMany as jest.Mock)
    .mockResolvedValueOnce([]) // daily chart
    .mockResolvedValueOnce([]) // weekly chart
    .mockResolvedValueOnce([]) // bySource
    .mockResolvedValueOnce([]) // streak

  // thisWeekCount + lastWeekCount
  ;(mockPrisma.application.count as jest.Mock)
    .mockResolvedValueOnce(0) // thisWeekCount
    .mockResolvedValueOnce(0) // lastWeekCount

  // profile
  ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)
}

// ─── getDashboardStats() ─────────────────────────────────────────────────────

describe('getDashboardStats()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return correct shape with all required fields', async () => {
    setupDefaultMocks()

    const result = await getDashboardStats(USER_ID)

    // Shape check
    expect(result).toHaveProperty('totals')
    expect(result).toHaveProperty('streak')
    expect(result).toHaveProperty('weeklyTrend')
    expect(result).toHaveProperty('dailyChart')
    expect(result).toHaveProperty('weeklyChart')
    expect(result).toHaveProperty('bySource')
    expect(result).toHaveProperty('profileScore')

    // totals sub-shape
    expect(result.totals).toMatchObject({
      applied: 0,
      saved: 0,
      rejected: 0,
      offers: 0,
    })

    // profileScore sub-shape
    expect(typeof result.profileScore.score).toBe('number')
    expect(Array.isArray(result.profileScore.missing)).toBe(true)
  })

  it('should return streak of 0 when user has no applications', async () => {
    setupDefaultMocks()
    ;(mockPrisma.application.findMany as jest.Mock).mockResolvedValue([]) // streak query returns empty

    const result = await getDashboardStats(USER_ID)

    expect(result.streak).toBe(0)
  })

  it('should count consecutive days correctly for streak', async () => {
    // Create applications for today and the last 2 days (3-day streak)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(now.getDate() - 2)

    // Set hours to noon so the date string is stable
    const makeDate = (d: Date) => {
      const date = new Date(d)
      date.setHours(12, 0, 0, 0)
      return date
    }

    const appsForStreak = [
      { appliedAt: makeDate(now) },
      { appliedAt: makeDate(yesterday) },
      { appliedAt: makeDate(twoDaysAgo) },
    ]

    // findMany is called 4 times: daily, weekly, bySource (with job), streak
    // bySource query includes { job: { source } } — others are just { appliedAt }
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce(appsForStreak) // daily chart
      .mockResolvedValueOnce(appsForStreak) // weekly chart
      .mockResolvedValueOnce([])            // bySource (no job field needed here)
      .mockResolvedValueOnce(appsForStreak) // streak
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    // Streak should be at least 3 (today + 2 previous days)
    expect(result.streak).toBeGreaterThanOrEqual(3)
  })

  it('should break streak when a day is missing', async () => {
    // Applications today and 2 days ago — but NOT yesterday (gap breaks streak)
    const now = new Date()
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(now.getDate() - 2)

    const todayApp = { appliedAt: new Date(new Date().setHours(12, 0, 0, 0)) }
    const twoDaysAgoApp = { appliedAt: new Date(new Date(twoDaysAgo).setHours(12, 0, 0, 0)) }

    const appsForStreak = [todayApp, twoDaysAgoApp]

    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce(appsForStreak) // daily chart
      .mockResolvedValueOnce(appsForStreak) // weekly chart
      .mockResolvedValueOnce([])            // bySource
      .mockResolvedValueOnce(appsForStreak) // streak
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    // Streak should be 1 (only today — yesterday breaks the chain)
    expect(result.streak).toBe(1)
  })

  it('should return positive weeklyTrend string when this week > last week', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(10) // thisWeekCount
      .mockResolvedValueOnce(5)  // lastWeekCount
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    expect(result.weeklyTrend).toBe('+5 more than last week')
  })

  it('should return negative weeklyTrend string when this week < last week', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(3) // thisWeekCount
      .mockResolvedValueOnce(8) // lastWeekCount
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    expect(result.weeklyTrend).toBe('5 fewer than last week')
  })

  it('should return "Same as last week" when counts are equal', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(4) // thisWeekCount
      .mockResolvedValueOnce(4) // lastWeekCount
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    expect(result.weeklyTrend).toBe('Same as last week')
  })

  it('should return profileScore of 0 for null profile', async () => {
    setupDefaultMocks()

    const result = await getDashboardStats(USER_ID)

    expect(result.profileScore.score).toBe(0)
    expect(result.profileScore.missing).toHaveLength(4)
  })

  it('should return profileScore of 100 for complete profile', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue({
      roles: ['Frontend Engineer'],     // +25
      skills: ['React', 'TypeScript'],  // +25
      location: 'Lagos, Nigeria',        // +25
      remotePref: 'remote',             // +25 (not 'any')
    })

    const result = await getDashboardStats(USER_ID)

    expect(result.profileScore.score).toBe(100)
    expect(result.profileScore.missing).toHaveLength(0)
  })

  it('should return partial profileScore with missing fields labeled', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue({
      roles: ['Backend Engineer'], // +25
      skills: [],                  // 0 (missing)
      location: null,              // 0 (missing)
      remotePref: 'any',           // 0 (missing)
    })

    const result = await getDashboardStats(USER_ID)

    expect(result.profileScore.score).toBe(25)
    expect(result.profileScore.missing).toHaveLength(3)
    expect(result.profileScore.missing).toContain('Skills')
    expect(result.profileScore.missing).toContain('Location')
    expect(result.profileScore.missing).toContain('Remote preference')
  })

  it('should return dailyChart with 30 data points', async () => {
    setupDefaultMocks()

    const result = await getDashboardStats(USER_ID)

    expect(result.dailyChart).toHaveLength(30)
    // Each entry should have date and count
    expect(result.dailyChart[0]).toHaveProperty('date')
    expect(result.dailyChart[0]).toHaveProperty('count')
  })

  it('should return bySource array sorted by count descending', async () => {
    ;(mockPrisma.application.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.application.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // daily chart
      .mockResolvedValueOnce([]) // weekly chart
      .mockResolvedValueOnce([  // bySource — these need job.source
        { job: { source: 'greenhouse' } },
        { job: { source: 'greenhouse' } },
        { job: { source: 'lever' } },
      ])
      .mockResolvedValueOnce([]) // streak
    ;(mockPrisma.application.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getDashboardStats(USER_ID)

    expect(result.bySource[0].source).toBe('greenhouse')
    expect(result.bySource[0].count).toBe(2)
    expect(result.bySource[1].source).toBe('lever')
    expect(result.bySource[1].count).toBe(1)
  })
})
