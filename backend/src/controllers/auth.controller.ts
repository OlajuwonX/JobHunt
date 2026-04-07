/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Controller (src/controllers/auth.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Controllers are thin bridges between HTTP and the service layer.
 * Their only jobs:
 *   1. Validate incoming request with Zod
 *   2. Check honeypot (bot protection)
 *   3. Call the auth service
 *   4. Set cookies on the response
 *   5. Return the HTTP response
 *
 * All business logic (DB queries, token generation, etc.) lives in:
 *   → src/services/auth.service.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { AppError } from '../middleware/errorHandler'
import { sendSuccess, sendCreated } from '../utils/response'
import { setCsrfCookie } from '../middleware/csrf.middleware'
import { generateCsrfToken } from '../utils/token'
import * as authService from '../services/auth.service'

// ─── Validation Schemas ────────────────────────────────────────────────────────
// Zod schemas define the exact shape we expect for each request body.
// If anything doesn't match, Zod throws — asyncHandler catches it — 400 returned.

const registerSchema = z
  .object({
    email: z.string().email('Please provide a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),

    // ── HONEYPOT FIELD ──────────────────────────────────────────────────────
    // Real users never see or fill this field (it's hidden with CSS).
    // Bots fill every visible field, including hidden ones.
    // If this field has any value → it's a bot → reject silently.
    // We include it in the schema so it's validated but not used.
    website: z.string().max(0, 'Bot detected').optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
  // Honeypot field for login form too
  website: z.string().max(0, 'Bot detected').optional(),
})

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

/**
 * Sets the refresh token as an HttpOnly cookie on the response.
 * HttpOnly = JavaScript cannot read it (protects against XSS).
 */
const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie('refresh_token', token, authService.REFRESH_COOKIE_OPTIONS)
}

/**
 * Clears the refresh token and CSRF cookies (used on logout).
 */
const clearAuthCookies = (res: Response): void => {
  res.cookie('refresh_token', '', { ...authService.REFRESH_COOKIE_OPTIONS, maxAge: 0 })
  res.cookie('csrf_token', '', { httpOnly: false, maxAge: 0, path: '/' })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the client IP address from the request.
 * When behind a proxy (Railway, Render, Vercel), the real IP is in X-Forwarded-For.
 */
const getClientIp = (req: Request): string | undefined => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new account. Sends a verification email.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  // Step 1: Validate + check honeypot
  const { email, password, website } = registerSchema.parse(req.body)

  // Honeypot check — real users leave this field empty
  // We check explicitly even though Zod would catch it, for clarity
  if (website) {
    // Return 200 to confuse bots — don't tell them they were caught
    return sendSuccess(res, {
      message: 'Account created. Please check your email to verify your account.',
    })
  }

  // Step 2: Call the service
  const result = await authService.register(
    email,
    password,
    getClientIp(req),
    req.headers['user-agent']
  )

  // Step 3: Return response
  sendCreated(res, result)
})

/**
 * POST /api/v1/auth/login
 * Authenticates user, issues tokens, sets cookies.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, website } = loginSchema.parse(req.body)

  // Honeypot check
  if (website) {
    // Fake a successful login to confuse bots
    return sendSuccess(res, { message: 'Logged in successfully' })
  }

  // Call service — throws AppError on failure
  const result = await authService.login(
    email,
    password,
    getClientIp(req),
    req.headers['user-agent']
  )

  // Set refresh token in HttpOnly cookie (JS can't steal it)
  setRefreshCookie(res, result.refreshToken)

  // Set CSRF token in readable cookie (JS reads it and sends as header)
  setCsrfCookie(res, result.csrfToken)

  // Return access token + user in the response body
  // The frontend stores the accessToken in memory (React state/variable)
  sendSuccess(res, {
    accessToken: result.accessToken,
    user: result.user,
  })
})

/**
 * POST /api/v1/auth/logout
 * Revokes the session and clears cookies.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Read the refresh token from the HttpOnly cookie
  const rawRefreshToken = req.cookies?.refresh_token as string | undefined

  if (rawRefreshToken) {
    // Revoke the session in the database
    await authService.logout(rawRefreshToken, getClientIp(req), req.headers['user-agent'])
  }

  // Clear both auth cookies regardless of whether we found a session
  clearAuthCookies(res)

  sendSuccess(res, { message: 'Logged out successfully.' })
})

/**
 * POST /api/v1/auth/refresh
 * Issues a new access token using the refresh token cookie.
 * Called automatically by the frontend when the access token expires.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  // Read refresh token from the HttpOnly cookie
  const rawRefreshToken = req.cookies?.refresh_token as string | undefined

  if (!rawRefreshToken) {
    throw new AppError('No refresh token found. Please log in.', 401)
  }

  // Rotate the refresh token and issue new access token
  const result = await authService.refresh(
    rawRefreshToken,
    getClientIp(req),
    req.headers['user-agent']
  )

  // Set new cookies
  setRefreshCookie(res, result.refreshToken)
  setCsrfCookie(res, result.csrfToken)

  // Return new access token
  sendSuccess(res, {
    accessToken: result.accessToken,
    user: result.user,
  })
})

/**
 * GET /api/v1/auth/verify/:token
 * Activates account using the token from the verification email.
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params

  if (!token || typeof token !== 'string') {
    throw new AppError('Verification token is required.', 400)
  }

  const result = await authService.verifyEmail(token)
  sendSuccess(res, result)
})

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's data.
 * requireAuth middleware has already verified the JWT before this runs.
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  // req.user is set by requireAuth middleware — guaranteed to exist here
  const user = await authService.getUserById(req.user!.id)
  sendSuccess(res, { user })
})

/**
 * GET /api/v1/auth/csrf-token
 * Issues a fresh CSRF token.
 * Called when the frontend loads — gets a token to include in future requests.
 */
export const getCsrfToken = asyncHandler(async (_req: Request, res: Response) => {
  const csrfToken = generateCsrfToken()
  setCsrfCookie(res, csrfToken)
  sendSuccess(res, { csrfToken })
})
