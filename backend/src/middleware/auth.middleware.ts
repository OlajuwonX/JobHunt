/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Middleware (src/middleware/auth.middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Protects routes by verifying a short-lived access token sent via the
 *   Authorization header. Valid token → user context attached to req.user.
 *
 * AUTH FLOW:
 *   1. User logs in → server returns accessToken in the JSON response body
 *   2. Frontend stores the token in memory only (Zustand store)
 *      NEVER in localStorage, sessionStorage, or cookies
 *   3. Every protected request includes: Authorization: Bearer <accessToken>
 *   4. This middleware verifies the token and attaches req.user
 *   5. When the token expires (5 min), the frontend silently calls
 *      POST /auth/refresh — the HttpOnly refresh token cookie handles it
 *
 * SECURITY PRINCIPLES:
 *   • Do NOT trust the client blindly — verify signature, expiry, AND token type
 *   • Do NOT leak auth internals in error responses — all failures return a
 *     generic "Unauthorized" to the client; real reasons are logged server-side
 *   • Token type check prevents accidental misuse of other token types as
 *     access tokens (e.g. if a verify token were somehow extracted and used)
 *
 * WHY BEARER HEADER, NOT A COOKIE?
 *   Cookies are sent automatically with every request — including cross-site ones.
 *   Sending the access token as a header means:
 *   • XSS can't steal it (not in localStorage)
 *   • CSRF can't use it (not automatically sent)
 *
 * USAGE:
 *   router.get('/profile', requireAuth, getProfile)
 *   // Inside the controller: req.user.id, req.user.email
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { verifyAccessToken } from '../utils/token'
import { AppError } from './errorHandler'

// ─── Type Augmentation ────────────────────────────────────────────────────────
// Adds `user` to Express's Request type globally so TypeScript knows it exists.
// sessionId is optional — it will be populated once we embed it in the JWT payload
// (currently omitted since session is created after token generation; future work).
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        sessionId?: string // for per-session revocation checks in controllers
      }
    }
  }
}

/**
 * Middleware that verifies the JWT access token from the Authorization header.
 * Attaches decoded user data to req.user so controllers can access it.
 *
 * Expects: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6...
 *
 * Failures are logged internally with the real reason; the client only ever
 * receives a generic 401 so we don't leak implementation details.
 *
 * @throws AppError(401) if token is missing, malformed, invalid, or expired
 */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // ── 1. Extract the Authorization header ─────────────────────────────────
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Log nothing here — missing header is normal for unauthenticated requests
      throw new AppError('Unauthorized', 401)
    }

    // Extract just the token (everything after "Bearer ")
    const token = authHeader.substring(7) // "Bearer ".length === 7

    if (!token) {
      console.warn('[requireAuth] Bearer prefix present but token body is empty')
      throw new AppError('Unauthorized', 401)
    }

    // ── 2. Verify signature + expiry ─────────────────────────────────────────
    // verifyAccessToken throws JsonWebTokenError or TokenExpiredError on failure
    const decoded = verifyAccessToken(token)

    // ── 3. Enforce token type ─────────────────────────────────────────────────
    // Access tokens embed type: 'access'. This guards against other token types
    // (e.g. a leaked email-verify token) being passed as access tokens.
    if (decoded.type !== 'access') {
      console.warn(`[requireAuth] Wrong token type presented: "${decoded.type}"`)
      throw new AppError('Unauthorized', 401)
    }

    // ── 4. Attach minimal user context ───────────────────────────────────────
    req.user = {
      id: decoded.id,
      email: decoded.email,
      sessionId: decoded.sessionId, // undefined until embedded in JWT; typed for future use
    }

    next()
  } catch (err) {
    // ── 5. Handle JWT errors without leaking details to the client ────────────
    if (err instanceof jwt.TokenExpiredError) {
      // Log server-side so we can monitor expiry patterns / clock skew
      console.info(`[requireAuth] Token expired for request: ${req.method} ${req.path}`)
      return next(new AppError('Unauthorized', 401))
    }

    if (err instanceof jwt.JsonWebTokenError) {
      // Log server-side — malformed tokens can indicate probing or attacks
      console.warn(`[requireAuth] Invalid JWT: ${err.message} — ${req.method} ${req.path}`)
      return next(new AppError('Unauthorized', 401))
    }

    // Re-throw AppErrors (missing header, wrong type) and any unexpected errors
    return next(err)
  }
}
