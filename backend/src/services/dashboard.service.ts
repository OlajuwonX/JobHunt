/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard Service (src/services/dashboard.service.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Computes all data needed for the user's dashboard in a single call.
 * All queries run in parallel with Promise.all for performance.
 *
 * DATA POINTS RETURNED:
 *   totals       — { applied, saved, rejected, offers } — status breakdown
 *   streak       — consecutive days with at least one application
 *   weeklyTrend  — comparison string: "+5 more than last week"
 *   dailyChart   — last 30 days, one data point per day (zeros filled)
 *   weeklyChart  — last 12 weeks, one data point per ISO week (zeros filled)
 *   bySource     — applications grouped by job source, sorted desc
 *   profileScore — 0–100 score based on profile completeness
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../utils/prisma'
import { DashboardStats } from '../types'

// ─── getDashboardStats ────────────────────────────────────────────────────────

/**
 * Fetches and computes all dashboard statistics for the given user.
 * Runs multiple DB queries in parallel, then processes results in-memory.
 *
 * @param userId - The authenticated user's ID
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const eightyFourDaysAgo = new Date(now)
  eightyFourDaysAgo.setDate(eightyFourDaysAgo.getDate() - 84)

  const thisMonday = getMondayOf(now)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)

  const [
    statusGroups,
    dailyRaw,
    weeklyRaw,
    allApplicationsWithSource,
    allApplicationsForStreak,
    thisWeekCount,
    lastWeekCount,
    profile,
  ] = await Promise.all([
    // 1. Status totals
    prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),

    // 2. Daily chart data (last 30 days)
    prisma.application.findMany({
      where: { userId, appliedAt: { gte: thirtyDaysAgo } },
      select: { appliedAt: true },
    }),

    // 3. Weekly chart data (last 84 days = ~12 weeks)
    prisma.application.findMany({
      where: { userId, appliedAt: { gte: eightyFourDaysAgo } },
      select: { appliedAt: true },
    }),

    // 4. All applications with source for bySource breakdown
    prisma.application.findMany({
      where: { userId },
      include: { job: { select: { source: true } } },
    }),

    // 5. All applications with date for streak calculation
    prisma.application.findMany({
      where: { userId },
      select: { appliedAt: true },
      orderBy: { appliedAt: 'desc' },
    }),

    // 6. This week count
    prisma.application.count({
      where: { userId, appliedAt: { gte: thisMonday } },
    }),

    // 7. Last week count
    prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: lastMonday, lt: thisMonday },
      },
    }),

    // 8. Profile for completeness score
    prisma.profile.findUnique({
      where: { userId },
    }),
  ])

  // ── 1. Status totals ───────────────────────────────────────────────────────
  const totals = { applied: 0, saved: 0, rejected: 0, offers: 0 }
  for (const group of statusGroups) {
    if (group.status === 'applied') totals.applied = group._count._all
    else if (group.status === 'saved') totals.saved = group._count._all
    else if (group.status === 'rejected') totals.rejected = group._count._all
    else if (group.status === 'offer') totals.offers = group._count._all
  }

  // ── 2. Daily chart (last 30 days) ─────────────────────────────────────────
  const dailyMap = new Map<string, number>()
  for (const app of dailyRaw) {
    const dateKey = app.appliedAt.toISOString().split('T')[0]
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1)
  }

  const dailyChart: Array<{ date: string; count: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().split('T')[0]
    dailyChart.push({ date: dateKey, count: dailyMap.get(dateKey) ?? 0 })
  }

  // ── 3. Weekly chart (last 12 weeks) ───────────────────────────────────────
  const weeklyMap = new Map<string, number>()
  for (const app of weeklyRaw) {
    const weekKey = getISOWeek(app.appliedAt)
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + 1)
  }

  // Generate all 12 week labels in order
  const weeklyChart: Array<{ week: string; count: number }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekKey = getISOWeek(d)
    // Only push if not already in the array (getISOWeek can repeat for same week)
    if (!weeklyChart.some((w) => w.week === weekKey)) {
      weeklyChart.push({ week: weekKey, count: weeklyMap.get(weekKey) ?? 0 })
    }
  }

  // ── 4. By source ──────────────────────────────────────────────────────────
  const sourceMap = new Map<string, number>()
  for (const app of allApplicationsWithSource) {
    const source = app.job.source
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1)
  }

  const bySource = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // ── 5. Streak calculation ─────────────────────────────────────────────────
  const dateSet = new Set<string>()
  for (const app of allApplicationsForStreak) {
    dateSet.add(app.appliedAt.toISOString().split('T')[0])
  }

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; ; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateKey = checkDate.toISOString().split('T')[0]

    if (dateSet.has(dateKey)) {
      streak++
    } else {
      break
    }
  }

  // ── 6. Weekly trend ───────────────────────────────────────────────────────
  const delta = thisWeekCount - lastWeekCount
  let weeklyTrend: string
  if (delta > 0) {
    weeklyTrend = `+${delta} more than last week`
  } else if (delta < 0) {
    weeklyTrend = `${Math.abs(delta)} fewer than last week`
  } else {
    weeklyTrend = 'Same as last week'
  }

  // ── 7. Profile score ──────────────────────────────────────────────────────
  let profileScoreValue = 0
  const missing: string[] = []

  if (profile) {
    if (profile.roles.length > 0) profileScoreValue += 25
    else missing.push('Job roles')

    if (profile.skills.length > 0) profileScoreValue += 25
    else missing.push('Skills')

    if (profile.location) profileScoreValue += 25
    else missing.push('Location')

    if (profile.remotePref !== 'any') profileScoreValue += 25
    else missing.push('Remote preference')
  } else {
    missing.push('Job roles', 'Skills', 'Location', 'Remote preference')
  }

  return {
    totals,
    streak,
    weeklyTrend,
    dailyChart,
    weeklyChart,
    bySource,
    profileScore: { score: profileScoreValue, missing },
  }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns ISO week string in format "YYYY-WNN" (e.g. "2026-W18").
 * Uses the ISO 8601 week numbering (weeks start on Monday).
 */
function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

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
