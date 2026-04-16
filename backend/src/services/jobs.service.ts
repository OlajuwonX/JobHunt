/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Jobs Service (src/services/jobs.service.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the core of the job ingestion and retrieval system.
 * All business logic lives here — controllers call these functions,
 * never touching Prisma directly.
 *
 * FUNCTIONS IN THIS FILE:
 *   batchUpsert()          — saves normalized jobs to the DB (deduplication)
 *   getJobsForUser()       — paginated, filtered job feed with match scores
 *   getJobWithScore()      — single job detail with cached ATS score
 *   scoreJob()             — in-memory 0–100 match score (no DB calls)
 *   getUserJobApplication() — checks if user has applied for a job
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Prisma } from '@prisma/client'
import prisma from '../utils/prisma'
import { NormalizedJob, JobFilters, PaginationMeta } from '../types'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * The shape of a job as returned by the API — includes computed matchScore.
 * We don't return ALL fields from the DB (avoids over-fetching).
 */
export interface JobListItem {
  id: string
  title: string
  company: string
  source: string
  location: string | null
  remote: boolean
  description: string
  requirements: string[]
  techStack: string[]
  applyUrl: string
  sourceUrl: string | null
  salaryRange: string | null
  postedAt: Date
  createdAt: Date
  matchScore?: number // only set when user has a profile
}

export interface JobDetail extends JobListItem {
  // Full detail includes the cached ATS score from the ats_scores table
  atsScore?: {
    score: number
    suggestions: string[]
    scoredAt: Date
  } | null
}

interface UserProfile {
  roles: string[]
  skills: string[]
  remotePref: string
  location: string | null
}

// The Prisma select object we use for list queries
// Using select prevents over-fetching — we only request columns we actually need
const JOB_LIST_SELECT = {
  id: true,
  title: true,
  company: true,
  source: true,
  location: true,
  remote: true,
  description: true,
  requirements: true,
  techStack: true,
  applyUrl: true,
  sourceUrl: true,
  salaryRange: true,
  postedAt: true,
  createdAt: true,
} satisfies Prisma.JobSelect

// ─── batchUpsert ──────────────────────────────────────────────────────────────

/**
 * Saves normalized jobs to the database with TWO-LAYER deduplication.
 *
 * LAYER 1 — EXACT dedup (jobHash @unique in DB):
 *   Same title + company + location from two sources → same jobHash → skip.
 *
 * LAYER 2 — FUZZY dedup (fuzzyHash, checked via pre-query):
 *   Same role, different wording → same fuzzyHash → skip.
 *   Examples caught:
 *     "Frontend Engineer" at Stripe (Greenhouse)
 *     "Frontend Developer" at Stripe Inc. (Lever)
 *     → same fuzzyHash "frontend engineer|stripe|remote" → only first stored
 *
 *     "Jr. Developer" at Paystack (Jobberman)
 *     "Junior Engineer" at Paystack Ltd (MyJobMag)
 *     → same fuzzyHash "junior engineer|paystack|lagos" → only first stored
 *
 * WHY NOT MAKE fuzzyHash @unique IN THE DB?
 * Two genuinely different jobs could rarely produce the same fuzzyHash (false
 * positive). By handling uniqueness in the service layer (pre-check + skip)
 * rather than a DB constraint, we avoid constraint errors and can log the
 * collision instead of crashing the batch.
 *
 * WHY 3 QUERIES PER BATCH INSTEAD OF 50?
 * The old approach did one upsert per job = 50 DB round trips per batch.
 * New approach: 2 parallel SELECT queries + 1 createMany = 3 round trips.
 * For a batch of 50 jobs this is ~17x fewer DB calls. Much faster.
 *
 * FIRST-SOURCE-WINS:
 * If a job already exists (either hash matches), we skip it entirely.
 * We never overwrite existing data — the first source to store the job wins.
 *
 * RETURNS:
 *   { inserted, skipped }
 *   inserted = new rows created in this run
 *   skipped  = jobs dropped because exact or fuzzy hash already existed
 */
export async function batchUpsert(
  jobs: NormalizedJob[]
): Promise<{ inserted: number; skipped: number }> {
  if (jobs.length === 0) return { inserted: 0, skipped: 0 }

  let inserted = 0
  let skipped = 0

  const BATCH_SIZE = 50

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE)

    // Collect all hashes present in this batch
    const batchJobHashes = batch.map((j) => j.jobHash)
    const batchFuzzyHashes = batch.map((j) => j.fuzzyHash).filter(Boolean) as string[]

    // ── Step 1: Single parallel query to find already-stored hashes ──────────
    // We run both lookups at the same time (Promise.all) to save one round trip.
    // This replaces 50 individual upsert calls with 2 SELECT queries.
    const [existingExact, existingFuzzy] = await Promise.all([
      prisma.job.findMany({
        where: { jobHash: { in: batchJobHashes } },
        select: { jobHash: true }, // only fetch the hash — no wasted bandwidth
      }),
      batchFuzzyHashes.length > 0
        ? prisma.job.findMany({
            where: { fuzzyHash: { in: batchFuzzyHashes } },
            select: { fuzzyHash: true },
          })
        : Promise.resolve([]),
    ])

    // Build fast-lookup Sets from the query results
    const skipByExactHash = new Set(existingExact.map((j) => j.jobHash))
    const skipByFuzzyHash = new Set(
      existingFuzzy.map((j) => j.fuzzyHash).filter(Boolean) as string[]
    )

    // ── Step 2: Deduplicate WITHIN the current batch ──────────────────────────
    // Two adapters in the same cron run might produce the same fuzzyHash
    // (e.g. Greenhouse "Frontend Engineer" and Lever "Frontend Developer"
    // fetched in the same batch). We keep only the first occurrence.
    const seenFuzzyInBatch = new Set<string>()

    const toCreate = batch.filter((job) => {
      // Already exists in DB by exact match — skip
      if (skipByExactHash.has(job.jobHash)) {
        skipped++
        return false
      }
      // Already exists in DB by fuzzy match — same role, different wording — skip
      if (job.fuzzyHash && skipByFuzzyHash.has(job.fuzzyHash)) {
        skipped++
        return false
      }
      // Already in this batch by fuzzy match — keep first, skip duplicates
      if (job.fuzzyHash && seenFuzzyInBatch.has(job.fuzzyHash)) {
        skipped++
        return false
      }
      // This job is new — mark its fuzzyHash as seen and include it
      if (job.fuzzyHash) seenFuzzyInBatch.add(job.fuzzyHash)
      return true
    })

    // ── Step 3: Insert the filtered jobs in one batch operation ───────────────
    // createMany is a single INSERT ... VALUES (...), (...), (...) statement.
    // skipDuplicates: true is a safety net for race conditions between cron runs
    // (two server instances running simultaneously — rare but possible).
    if (toCreate.length > 0) {
      try {
        const result = await prisma.job.createMany({
          data: toCreate.map((job) => ({
            jobHash: job.jobHash,
            fuzzyHash: job.fuzzyHash,
            title: job.title,
            company: job.company,
            source: job.source,
            location: job.location,
            remote: job.remote,
            description: job.description,
            requirements: job.requirements,
            techStack: job.techStack,
            applyUrl: job.applyUrl,
            sourceUrl: job.sourceUrl,
            postedAt: job.postedAt,
            salaryRange: job.salaryRange,
            // Intelligence fields — detected during normalization, stored once per job
            category: job.category,
            country: job.country,
          })),
          skipDuplicates: true, // handles race conditions — does not throw on conflict
        })
        inserted += result.count
        // Any jobs in toCreate that createMany silently skipped (race condition)
        skipped += toCreate.length - result.count
      } catch (err) {
        // If createMany itself fails (e.g. DB connection lost), log and continue
        // — don't let one failed batch stop the entire ingestion run
        console.warn('[batchUpsert] createMany failed for batch starting at index', i, err)
        skipped += toCreate.length
      }
    }
  }

  return { inserted, skipped }
}

// ─── ROLE_SYNONYMS — used by scoreJob() to expand user role terms ─────────────

/**
 * ROLE_SYNONYMS maps each canonical role key to a broader set of equivalent terms.
 *
 * WHY DO WE NEED THIS?
 * A user declares their desired role as "frontend developer". Without expansion,
 * "frontend developer" scores 0 against a job titled "React Engineer" — the
 * simple titleLower.includes('frontend developer') check fails.
 *
 * With expansion:
 *   "frontend developer" → expandRole() → ['frontend', 'front-end', 'react', ...]
 *   "React Engineer" title → contains 'react' → role match scores 30 pts
 *
 * This prevents the frustrating UX where users see 0-score jobs for roles that
 * are clearly relevant to them.
 *
 * HOW expandRole() USES THIS MAP:
 * It checks if the user's role string contains a key (e.g. 'frontend') OR
 * any synonym (e.g. 'react developer'). If found, it returns the synonym array.
 * Falls back to [lowerRole] so uncommon roles still use direct title matching.
 */
const ROLE_SYNONYMS: Record<string, string[]> = {
  // ── Tech roles ────────────────────────────────────────────────────────────
  frontend: ['frontend', 'front-end', 'react', 'vue', 'angular', 'ui engineer', 'ui developer'],
  backend: ['backend', 'back-end', 'api engineer', 'server', 'node developer'],
  fullstack: ['fullstack', 'full-stack', 'full stack'],
  mobile: ['mobile', 'android', 'ios', 'flutter', 'react native'],
  software: ['software', 'engineer', 'developer', 'programmer'],
  devops: ['devops', 'cloud engineer', 'infrastructure', 'sre', 'platform engineer'],
  data: ['data scientist', 'data analyst', 'ml engineer', 'ai engineer', 'analytics'],
  // ── Finance roles ─────────────────────────────────────────────────────────
  finance: ['finance', 'financial analyst', 'investment', 'treasury'],
  accounting: ['accountant', 'accounting', 'audit', 'bookkeeper', 'tax'],
  banking: ['banking', 'bank', 'credit analyst', 'loan officer', 'mortgage'],
  insurance: ['insurance', 'underwriter', 'actuary', 'claims'],
  // ── Business roles ────────────────────────────────────────────────────────
  sales: ['sales', 'business development', 'account executive', 'account manager'],
  marketing: ['marketing', 'growth', 'brand manager', 'seo', 'content'],
  hr: ['human resources', 'recruitment', 'talent acquisition', 'hr manager'],
  operations: ['operations', 'ops', 'logistics', 'supply chain', 'procurement'],
  // ── Other professional roles ──────────────────────────────────────────────
  healthcare: ['nurse', 'doctor', 'pharmacist', 'clinical', 'medical officer'],
  legal: ['lawyer', 'attorney', 'legal counsel', 'compliance officer'],
}

/**
 * expandRole(role)
 *
 * Resolves a user-declared role string to its synonym array from ROLE_SYNONYMS.
 *
 * Match logic (in order):
 *   1. Does the user's role contain a ROLE_SYNONYMS key?
 *      e.g. "frontend developer" contains 'frontend' → returns frontend synonyms
 *   2. Does any synonym in any group appear in the user's role?
 *      e.g. "react developer" contains 'react' (a frontend synonym) → returns frontend synonyms
 *   3. Neither matched — fall back to [lowerRole] so direct title containment still works
 *      e.g. "ceramics technician" → ['ceramics technician'] (no synonym group)
 *
 * The returned terms are then checked via: jobTitle.includes(term)
 */
function expandRole(role: string): string[] {
  const lowerRole = role.toLowerCase()
  for (const [key, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (lowerRole.includes(key) || synonyms.some((s) => lowerRole.includes(s))) {
      return synonyms
    }
  }
  // No synonym group matched — use the role as-is for direct containment check
  return [lowerRole]
}

// ─── scoreJob ─────────────────────────────────────────────────────────────────

/**
 * Computes a 0–100 match score for a job against a user's profile.
 * This runs ENTIRELY IN MEMORY — no database calls.
 *
 * WHY IN-MEMORY?
 * This function is called for every job in a paginated list response.
 * If the list has 20 jobs, we call scoreJob 20 times. Calling the DB 20 extra
 * times per request would make every job list page very slow.
 * In-memory scoring is instant — typically < 1ms per job.
 *
 * SCORING BREAKDOWN (total: 100 points):
 *   Role match:    0–30 pts  — expanded synonym matching (catches "frontend dev" → "React Engineer")
 *   Skills match:  0–40 pts  — user skills found in job's techStack (8 pts each, capped at 40)
 *   Remote pref:   0–15 pts  — does job's remote status match user's preference?
 *   Country match: 0–10 pts  — Nigerian user + Nigerian job, or global user + global job
 *   Recency bonus: 0–5 pts   — job posted within last 3 days (surfaces fresh listings)
 *
 * ROLE MATCH (30 pts max):
 *   Any of the user's roles (expanded via ROLE_SYNONYMS) found in job title: 30 pts
 *   "frontend developer" matches "React Engineer" because 'react' is in frontend synonyms.
 *
 * SKILLS MATCH (40 pts max):
 *   Each matching skill = 8 pts. Need 5+ matching skills to hit the 40-pt cap.
 *   e.g. 3 skills match → 24 pts, 5 skills match → 40 pts (capped)
 *
 * REMOTE MATCH (15 pts max):
 *   User wants remote AND job is remote: 15 pts
 *   User wants onsite AND job is NOT remote: 15 pts
 *   User wants "any": 7 pts (flexible — slight boost)
 *   Mismatch: 0 pts
 *
 * COUNTRY MATCH (10 pts):
 *   Nigerian user (location contains Lagos/Abuja/etc) + Nigerian job: 10 pts
 *   Global user (no Nigerian city) + global job: 10 pts
 *   Cross-country: 0 pts (not penalized — just no boost)
 *
 * RECENCY BONUS (5 pts):
 *   Job posted < 3 days ago: 5 pts
 *   Prevents old listings from ranking above fresh, relevant ones.
 */
export function scoreJob(
  job: { title: string; techStack: string[]; remote: boolean; postedAt: Date; country?: string },
  profile: UserProfile
): number {
  let score = 0

  // ── Role match (30pts) — expanded via ROLE_SYNONYMS ──────────────────────────
  // For each user role, expand to a broader synonym set, then check if any term
  // appears in the job title. Catches "frontend developer" → "React Engineer".
  const titleLower = job.title.toLowerCase()
  const roleMatched = profile.roles.some((role) =>
    expandRole(role).some((term) => titleLower.includes(term))
  )
  if (roleMatched) score += 30

  // ── Skills match (40pts) ──────────────────────────────────────────────────────
  // Each matching skill earns 8 pts. Need 5+ matching skills to hit the 40-pt cap.
  // Using a Set for O(1) lookups instead of O(n) array scan.
  const jobTech = new Set(job.techStack.map((t) => t.toLowerCase()))
  const skillHits = profile.skills.filter((s) => jobTech.has(s.toLowerCase()))
  score += Math.min(skillHits.length * 8, 40)

  // ── Remote preference (15pts) ─────────────────────────────────────────────────
  // Slightly reduced from 20 to make room for the country signal.
  const remotePref = profile.remotePref.toLowerCase()
  if (remotePref === 'remote' && job.remote) {
    score += 15 // User wants remote, job is remote — perfect match
  } else if (remotePref === 'onsite' && !job.remote) {
    score += 15 // User wants in-office, job is in-office — perfect match
  } else if (remotePref === 'any') {
    score += 7 // Flexible user — small boost regardless of job's remote status
  }
  // remotePref === 'remote' but job is not remote → 0 pts (mismatch)

  // ── Country match bonus (10pts) ───────────────────────────────────────────────
  // When the user's saved location implies Nigeria (detected by city names)
  // and the job is tagged as Nigerian-market, give a relevance boost.
  // Likewise, global-located users get a boost for global jobs.
  // profile.location is free text — we check for major Nigerian cities.
  if (job.country && profile.location) {
    const isUserNigerian = /lagos|abuja|nigeria|port harcourt|ibadan/i.test(profile.location)
    if (isUserNigerian && job.country === 'nigeria') score += 10
    else if (!isUserNigerian && job.country === 'global') score += 10
  }

  // ── Recency bonus (5pts) ──────────────────────────────────────────────────────
  // Fresh jobs (posted < 3 days ago) surface above older stale listings.
  // 86_400_000 = milliseconds in one day (24 * 60 * 60 * 1000)
  const daysOld = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000
  if (daysOld < 3) score += 5

  // Clamp to 0–100: the maximum theoretical score is exactly 100
  // (30 role + 40 skills + 15 remote + 10 country + 5 recency = 100)
  return Math.min(score, 100)
}

// ─── getJobsForUser ───────────────────────────────────────────────────────────

/**
 * Returns a paginated, filtered list of jobs with optional match scores.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Parallel count + list: We run count() and findMany() at the same time
 *    using Promise.all(). This saves one database round trip per page load.
 * 2. Prisma select: Only fetch columns we actually need. Descriptions are
 *    large — returning them in list view is necessary for snippet display.
 * 3. Pagination: Never return all jobs — cap at 50 per request.
 * 4. Indexed filters: source, remote, postedAt all have DB indexes.
 *
 * MATCH SCORING:
 * If the user has a profile with roles/skills set, each job in the list
 * gets a matchScore (0–100). This is computed in-memory, not stored.
 */
export async function getJobsForUser(
  userId: string,
  filters: JobFilters
): Promise<{
  jobs: JobListItem[]
  pagination: PaginationMeta
}> {
  const page = filters.page ?? 1
  const limit = Math.min(filters.limit ?? 20, 50) // cap at 50 per page
  const skip = (page - 1) * limit

  // Build the Prisma where clause from filters
  const where: Prisma.JobWhereInput = {}

  // Filter by source (e.g. only show Greenhouse jobs)
  if (filters.source) {
    where.source = filters.source
  }

  // Filter by remote status
  if (filters.remote !== undefined) {
    where.remote = filters.remote
  }

  // Full-text search on title and company name
  // Using ILIKE (case-insensitive LIKE) via Prisma's contains + mode: 'insensitive'
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { company: { contains: filters.q, mode: 'insensitive' } },
    ]
  }

  // Filter by category — e.g. only show tech or finance jobs
  // Values: 'tech' | 'finance' | 'sales' | 'marketing' | 'healthcare' | 'design' | etc.
  if (filters.category) where.category = filters.category

  // Filter by country market — 'nigeria' shows Nigerian board listings, 'global' shows the rest
  // Both values are stored lowercase so no .toLowerCase() needed at query time.
  if (filters.country) where.country = filters.country

  // Filter by posting date — show only jobs posted after this date
  if (filters.since) {
    where.postedAt = { gte: filters.since }
  }

  // Run count and list queries in PARALLEL for performance.
  // Promise.all() starts both queries at the same time.
  // Without this, we'd wait for count() to finish before starting findMany(),
  // doubling the database time for every page load.
  const [total, rawJobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: JOB_LIST_SELECT,
      orderBy: { postedAt: 'desc' }, // newest jobs first
      skip,
      take: limit,
    }),
  ])

  // Load user's profile for scoring (if it exists)
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      roles: true,
      skills: true,
      remotePref: true,
      location: true,
    },
  })

  // Compute match scores in-memory for each job
  const jobs: JobListItem[] = rawJobs.map((job) => {
    const baseJob: JobListItem = {
      ...job,
    }

    // Only compute score if user has a meaningful profile (has roles or skills set)
    if (profile && (profile.roles.length > 0 || profile.skills.length > 0)) {
      baseJob.matchScore = scoreJob(
        {
          title: job.title,
          techStack: job.techStack,
          remote: job.remote,
          postedAt: job.postedAt,
          // country is not in JOB_LIST_SELECT yet — pass undefined safely
          // (the scoreJob country branch is guarded: if (job.country && profile.location))
          country: undefined,
        },
        profile
      )
    }

    return baseJob
  })

  const totalPages = Math.ceil(total / limit)

  return {
    jobs,
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

// ─── getJobWithScore ──────────────────────────────────────────────────────────

/**
 * Returns full job detail plus the user's cached ATS score (if available).
 *
 * WHY RETURN CACHED ATS SCORE SEPARATELY?
 * ATS scoring is done asynchronously by a background cron job (Phase 3).
 * By the time a user opens a job, the score may or may not be ready.
 * We return null for atsScore if it hasn't been computed yet — the frontend
 * can show a "scoring in progress" spinner.
 *
 * We use a join (include) to fetch the ATS score in a single query,
 * rather than two separate round trips.
 */
export async function getJobWithScore(jobId: string, userId: string): Promise<JobDetail | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      ...JOB_LIST_SELECT,
      // Fetch the cached ATS score for this specific user+job combination
      atsScores: {
        where: { userId },
        select: {
          score: true,
          suggestions: true,
          scoredAt: true,
        },
        take: 1, // only one score per user+job (enforced by unique constraint)
      },
    },
  })

  if (!job) return null

  // Load user profile for match score
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { roles: true, skills: true, remotePref: true, location: true },
  })

  const matchScore =
    profile && (profile.roles.length > 0 || profile.skills.length > 0)
      ? scoreJob(
          {
            title: job.title,
            techStack: job.techStack,
            remote: job.remote,
            postedAt: job.postedAt,
            country: undefined, // not in JOB_LIST_SELECT — country bonus skipped for detail view
          },
          profile
        )
      : undefined

  const atsScoreRecord = job.atsScores[0] ?? null

  // Build the detail response
  const detail: JobDetail = {
    id: job.id,
    title: job.title,
    company: job.company,
    source: job.source,
    location: job.location,
    remote: job.remote,
    description: job.description,
    requirements: job.requirements,
    techStack: job.techStack,
    applyUrl: job.applyUrl,
    sourceUrl: job.sourceUrl,
    salaryRange: job.salaryRange,
    postedAt: job.postedAt,
    createdAt: job.createdAt,
    matchScore,
    atsScore: atsScoreRecord
      ? {
          score: atsScoreRecord.score,
          suggestions: atsScoreRecord.suggestions,
          scoredAt: atsScoreRecord.scoredAt,
        }
      : null,
  }

  return detail
}

// ─── getUserJobApplication ────────────────────────────────────────────────────

/**
 * Checks whether the current user has an Application record for the given job.
 * Returns the application (with status) or null if they haven't applied.
 *
 * Used by the job detail endpoint to show "Applied" badge vs "Apply" button.
 */
export async function getUserJobApplication(userId: string, jobId: string) {
  return prisma.application.findUnique({
    where: {
      userId_jobId: { userId, jobId }, // the composite unique index
    },
    select: {
      id: true,
      status: true,
      appliedAt: true,
    },
  })
}
