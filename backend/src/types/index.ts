/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript Types (src/types/index.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Central place for types used across the backend.
 *
 * Guidelines:
 *   - Database model types come from Prisma — don't duplicate them here
 *   - Put types here when they're used in 2+ files
 *   - API request/response shapes live here so controllers and services agree
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── API Response Shape ───────────────────────────────────────────────────────
// Every API response follows this envelope pattern for consistency.
// The frontend always knows: success → data, failure → error

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
  code?: string // optional machine-readable error code (e.g. 'EMAIL_TAKEN')
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Pagination ────────────────────────────────────────────────────────────────
// Standard shape for paginated list responses

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number // total items across all pages
    totalPages: number // Math.ceil(total / limit)
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Job Types ─────────────────────────────────────────────────────────────────

/**
 * All supported job sources. Add new sources here as we add new adapters.
 * This union type is used for Zod validation and Prisma queries.
 */
export type JobSource =
  | 'greenhouse'
  | 'lever'
  | 'remotive'
  | 'arbeitnow'
  | 'jobicy'
  | 'themuse'
  | 'weworkremotely'
  | 'jobberman'
  | 'myjobmag'
  | 'hotnigerianjobs'
  | 'ngcareers'

/**
 * The cleaned, ready-for-database job shape produced by the normalizer.
 * This is what goes into the Prisma upsert — it maps directly to the Job model.
 *
 * The difference between NormalizedJob and RawJob:
 *   RawJob   = data as-is from the source (some fields may be missing, messy, or HTML)
 *   NormalizedJob = cleaned, enriched, validated data ready for the DB
 */
export interface NormalizedJob {
  jobHash: string // Exact SHA-256 fingerprint: title|company|location (raw, lowercased)
  fuzzyHash: string // Fuzzy SHA-256 fingerprint: canonicalTitle|canonicalCompany|canonicalLocation
  // fuzzyHash catches same-role variants: "Frontend Engineer" ≈ "Frontend Developer", "Jr" ≈ "Junior"
  title: string
  company: string
  source: JobSource
  location: string | null
  remote: boolean
  description: string // plain text, cleaned, max 12,000 chars
  requirements: string[] // extracted bullet points, max 12 items
  techStack: string[] // tech/business keywords found in description
  applyUrl: string
  sourceUrl: string | null // listing page URL (may differ from applyUrl)
  postedAt: Date
  salaryRange: string | null // human-readable salary string or null
  category: string // 'tech' | 'finance' | 'sales' | 'marketing' | 'healthcare' | 'design' | 'operations' | 'hr' | 'legal' | 'education' | 'other'
  country: string  // 'nigeria' | 'global' — lowercase only for consistent DB queries
}

/**
 * A job with an optional match score appended for the current user.
 * The score is computed in-memory by scoreJob() — never stored with this type.
 */
export interface JobWithScore extends NormalizedJob {
  id: string
  createdAt: Date
  matchScore?: number // 0–100, computed in-memory based on user profile
}

// Query params for GET /api/v1/jobs
export interface JobFilters {
  page?: number
  limit?: number
  source?: JobSource
  remote?: boolean
  q?: string      // Full-text search on title and company (ILIKE)
  category?: string // filter by job category ('tech' | 'finance' | 'sales' | etc.)
  country?: string  // filter by job market: 'nigeria' | 'global'
  since?: Date    // Filter jobs posted after this date
  minScore?: number // Filter by minimum match score
}

// ─── User / Auth Types ─────────────────────────────────────────────────────────

// The safe user object we return in API responses (never includes passwordHash)
export interface SafeUser {
  id: string
  email: string
  verified: boolean
  createdAt: Date
}

// Register request body shape (validated with Zod in controller)
export interface RegisterInput {
  email: string
  password: string
  confirmPassword: string
}

// Login request body shape
export interface LoginInput {
  email: string
  password: string
}

// ─── Profile Types ─────────────────────────────────────────────────────────────

export type RemotePreference = 'remote' | 'hybrid' | 'onsite' | 'any'

export interface ProfileUpdateInput {
  roles?: string[]
  location?: string
  remotePref?: RemotePreference
  skills?: string[]
}

// ─── Dashboard Types ───────────────────────────────────────────────────────────

export interface DashboardStats {
  stats: {
    today: number
    thisMonth: number
    total: number
  }
  // Count of jobs grouped by source — supports all 11 sources
  bySource: Partial<Record<JobSource, number>>
  // Daily chart data for the last 30 days (line chart)
  dailyChart: Array<{ date: string; count: number }>
  // Monthly chart data for the last 12 months (bar chart)
  monthlyChart: Array<{ month: string; count: number }>
}

// ─── Pagination Metadata ──────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
