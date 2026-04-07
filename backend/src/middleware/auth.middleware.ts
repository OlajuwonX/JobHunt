/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Middleware (src/middleware/auth.middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Protects routes that require a logged-in user.
 *
 * HOW THE ACCESS TOKEN FLOW WORKS:
 *   1. User logs in → server returns an accessToken in the JSON response body
 *   2. Frontend stores this accessToken in memory (a React variable/Zustand store)
 *      NEVER in localStorage, sessionStorage, or cookies
 *   3. Frontend includes the token in every API request:
 *      Authorization: Bearer <accessToken>
 *   4. This middleware reads the header, verifies the JWT, attaches user to req.user
 *   5. When the accessToken expires (5 min), the frontend calls POST /auth/refresh
 *      which uses the HttpOnly refresh token cookie to get a new accessToken
 *
 * WHY NOT USE A COOKIE FOR THE ACCESS TOKEN?
 *   Cookies are automatically sent with every request — including cross-site ones.
 *   Storing the access token in memory and sending it as a header means:
 *   - XSS attacks can't steal it (no localStorage)
 *   - CSRF attacks can't use it (not automatically sent)
 *
 * USAGE:
 *   router.get('/profile', requireAuth, getProfile)
 *   // Inside the controller: req.user.id, req.user.email
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/token'
import { AppError } from './errorHandler'
import jwt from 'jsonwebtoken'

// ─── Type Augmentation ─────────────────────────────────────────────────────────
// Adds the `user` property to Express's Request type globally.
// Without this, TypeScript would complain that req.user doesn't exist.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
      }
    }
  }
}

/**
 * Middleware that verifies the JWT access token from the Authorization header.
 * Attaches decoded user data to req.user so controllers can access it.
 *
 * Expects the header in this format:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6...
 *
 * @throws AppError(401) if token is missing, invalid, or expired
 */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  // ── Extract the token from the Authorization header ─────────────────────────
  const authHeader = req.headers.authorization

  // The header must exist and start with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Please log in.', 401)
  }

  // Extract just the token part (everything after "Bearer ")
  const token = authHeader.substring(7) // "Bearer ".length === 7

  if (!token) {
    throw new AppError('Authentication token is missing.', 401)
  }

  // ── Verify the token ────────────────────────────────────────────────────────
  try {
    // verifyAccessToken checks:
    //   1. Signature is valid (wasn't tampered with using our JWT_SECRET)
    //   2. Token hasn't expired (exp claim is in the future)
    const decoded = verifyAccessToken(token)

    // Attach the user data to the request object
    // All downstream controllers can read: req.user.id, req.user.email
    req.user = {
      id: decoded.id,
      email: decoded.email,
    }

    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // The frontend should automatically call POST /auth/refresh when it gets this error
      throw new AppError('Access token expired. Please refresh your session.', 401)
    }
    throw new AppError('Invalid authentication token. Please log in again.', 401)
  }
}
