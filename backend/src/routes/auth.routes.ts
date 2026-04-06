/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Routes (src/routes/auth.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Defines all authentication-related endpoints.
 * Routes are intentionally thin — they just:
 *   1. Apply middleware (rate limiting, validation)
 *   2. Call the controller
 *
 * All business logic lives in controllers and services, NOT here.
 *
 * Full paths (since this is mounted at /api/v1/auth):
 *   POST   /api/v1/auth/register       — create account
 *   POST   /api/v1/auth/login          — log in, receive JWT cookie
 *   POST   /api/v1/auth/logout         — clear JWT cookie
 *   GET    /api/v1/auth/verify/:token  — verify email address
 *   GET    /api/v1/auth/me             — get current logged-in user
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import {
  register,
  login,
  logout,
  verifyEmail,
  getMe,
} from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// ─── Auth-specific Rate Limiter ────────────────────────────────────────────────
// Auth routes need stricter limits than the global 100 req/15min.
// This prevents brute-force password attacks and spam account creation.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,                 // max 10 attempts per 15 minutes per IP
  message: {
    success: false,
    error: 'Too many auth attempts. Please wait 15 minutes.',
  },
})

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
// Create a new account. Sends a verification email.
// Rate limited to prevent spam account creation.
router.post('/register', authRateLimit, register)

// POST /api/v1/auth/login
// Authenticate with email + password.
// On success: sets an HTTP-only JWT cookie and returns user data.
// Rate limited to prevent brute-force attacks.
router.post('/login', authRateLimit, login)

// POST /api/v1/auth/logout
// Clears the JWT cookie. No body needed.
// requireAuth ensures only logged-in users can call this.
router.post('/logout', requireAuth, logout)

// GET /api/v1/auth/verify/:token
// Called when the user clicks the verification link in their email.
// :token is the unique verification token we generated on register.
router.get('/verify/:token', verifyEmail)

// GET /api/v1/auth/me
// Returns the current authenticated user's data.
// requireAuth middleware checks the JWT cookie and attaches user to req.user.
router.get('/me', requireAuth, getMe)

export default router
