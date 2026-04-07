/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Controller (src/controllers/auth.controller.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Controllers are the bridge between the HTTP layer (routes) and the
 * business logic layer (services).
 *
 * A controller's job is ONLY:
 *   1. Validate the incoming request body with Zod
 *   2. Call the appropriate service function
 *   3. Return the HTTP response
 *
 * Controllers do NOT contain business logic.
 * Controllers do NOT talk to the database directly.
 * That all lives in src/services/auth.service.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler'
import { AppError } from '../middleware/errorHandler'
import { sendSuccess, sendCreated } from '../utils/response'
// import * as authService from '../services/auth.service' // uncomment when service is built

// ─── Validation Schemas ────────────────────────────────────────────────────────
// Zod schemas define exactly what shape of data is acceptable.
// If the request doesn't match, Zod throws — asyncHandler catches it — errorHandler returns 400.

const registerSchema = z
  .object({
    email: z.string().email('Please provide a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // which field the error attaches to
  })

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

// ─── JWT Cookie Config ─────────────────────────────────────────────────────────
// Reusable cookie options so we're consistent everywhere we set the JWT cookie.
const JWT_COOKIE_OPTIONS = {
  httpOnly: true, // can't be read by JavaScript (prevents XSS token theft)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // prevents CSRF (cookie only sent from same site)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Create a new user account and send a verification email.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  // Step 1: Validate the request body. parse() throws ZodError on failure.
  const _input = registerSchema.parse(req.body)

  // Step 2: Call the service to create the user.
  // The service handles: hashing the password, checking for duplicate email,
  // generating a verification token, and sending the email.
  // const user = await authService.register(input)
  // TODO: uncomment above when auth.service.ts is implemented

  // Step 3: Return success. Don't return the hashed password — ever.
  sendCreated(res, {
    message: 'Account created. Please check your email to verify your account.',
    // email: user.email  // uncomment when service is ready
  })
})

/**
 * POST /api/v1/auth/login
 * Authenticate user and set JWT in an HTTP-only cookie.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const _input = loginSchema.parse(req.body)

  // The service returns a signed JWT token and the safe user object
  // const { token, user } = await authService.login(input)
  // TODO: uncomment when service is ready

  // Store the JWT in an HTTP-only cookie
  // HTTP-only = JavaScript cannot read this cookie (safer than localStorage)
  // res.cookie('token', token, JWT_COOKIE_OPTIONS)

  sendSuccess(res, {
    message: 'Logged in successfully',
    // user  // uncomment when service is ready
  })
})

/**
 * POST /api/v1/auth/logout
 * Clear the JWT cookie to log the user out.
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // Clear the cookie by setting it to expire immediately
  // Sending an empty value with maxAge 0 removes the cookie from the browser
  res.cookie('token', '', {
    ...JWT_COOKIE_OPTIONS,
    maxAge: 0,
  })

  sendSuccess(res, { message: 'Logged out successfully' })
})

/**
 * GET /api/v1/auth/verify/:token
 * Activate the user account using the token from the verification email.
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params

  if (!token) {
    throw new AppError('Verification token is required', 400)
  }

  // The service finds the user by this token, checks it hasn't expired,
  // marks the account as verified, and deletes the token.
  // await authService.verifyEmail(token)
  // TODO: uncomment when service is ready

  sendSuccess(res, { message: 'Email verified successfully. You can now log in.' })
})

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user.
 * requireAuth middleware has already verified the JWT and set req.user.
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  // req.user is set by requireAuth middleware — it's guaranteed to exist here
  const userId = req.user!.id

  // Fetch fresh user data from DB (don't rely on the JWT payload for sensitive data)
  // const user = await authService.getUserById(userId)
  // TODO: uncomment when service is ready

  sendSuccess(res, {
    id: userId,
    email: req.user!.email,
    // ...user  // uncomment when service is ready
  })
})
