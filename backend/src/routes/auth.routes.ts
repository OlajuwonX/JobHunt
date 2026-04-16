/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Routes (src/routes/auth.routes.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Endpoints (all prefixed with /api/v1/auth):
 *
 *   GET    /api/v1/auth/csrf-token     → get a CSRF token (called on app load)
 *   POST   /api/v1/auth/register       → create account + send verification email
 *   POST   /api/v1/auth/login          → authenticate, set cookies, return access token
 *   POST   /api/v1/auth/logout         → revoke session, clear cookies
 *   POST   /api/v1/auth/refresh        → rotate refresh token, issue new access token
 *   GET    /api/v1/auth/verify/:token  → activate account from email link
 *   GET    /api/v1/auth/me             → get current user (requires auth)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  register,
  login,
  logout,
  refresh,
  verifyEmail,
  getMe,
  getCsrfToken,
} from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// ─── Auth-specific Rate Limiter ────────────────────────────────────────────────
// Much stricter than the global 100 req/15min limit.
// 10 attempts per 15 minutes per IP — protects against brute-force.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many attempts. Please wait 15 minutes before trying again.',
  },
})

// Slightly more generous for token refresh — frontend calls this automatically
// every 5 minutes when the access token expires.
const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many refresh requests.' },
})

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/v1/auth/csrf-token
// Called when the frontend app loads — returns a CSRF token set as a readable cookie.
// Exempt from CSRF validation (it's how you GET the token in the first place).
router.get('/csrf-token', getCsrfToken)

// POST /api/v1/auth/register
router.post('/register', authRateLimit, register)

// POST /api/v1/auth/login
router.post('/login', authRateLimit, login)

// POST /api/v1/auth/logout
// No requireAuth — logout must work even when the access token has already expired.
// Session revocation is done via the HttpOnly refresh_token cookie, not the Bearer token.
router.post('/logout', logout)

// POST /api/v1/auth/refresh
// No requireAuth — the point is to renew an expired access token.
// Security comes from the HttpOnly refresh token cookie + rotation logic.
router.post('/refresh', refreshRateLimit, refresh)

// GET /api/v1/auth/verify/:token
// The link in the verification email points here.
router.get('/verify/:token', verifyEmail)

// GET /api/v1/auth/me
// Returns the current user. requireAuth checks Bearer token from Authorization header.
router.get('/me', requireAuth, getMe)

export default router
