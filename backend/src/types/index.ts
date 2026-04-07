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

// The raw job data after normalizing from Greenhouse or Lever
export interface NormalizedJob {
  title: string
  company: string
  source: 'greenhouse' | 'lever'
  location: string | null
  remote: boolean
  description: string
  requirements: string[]
  techStack: string[]
  applyUrl: string
  postedAt: Date
}

// Query params for GET /api/v1/jobs
export interface JobFilters {
  page?: number
  limit?: number
  source?: 'greenhouse' | 'lever'
  status?: 'applied' | 'saved' | 'none'
  minScore?: number
  remote?: boolean
  search?: string
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
  bySource: {
    greenhouse: number
    lever: number
  }
  // Daily chart data for the last 30 days (line chart)
  dailyChart: Array<{ date: string; count: number }>
  // Monthly chart data for the last 12 months (bar chart)
  monthlyChart: Array<{ month: string; count: number }>
}
