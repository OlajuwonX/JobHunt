/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Middleware (src/middleware/auth.middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Protects routes that require a logged-in user.
 *
 * HOW JWT AUTH WORKS IN THIS APP:
 *   1. User logs in → server creates a JWT (a signed token with user ID + email)
 *   2. JWT is stored in an HTTP-only cookie (can't be stolen by XSS)
 *   3. Browser automatically sends the cookie with every subsequent request
 *   4. This middleware reads the cookie, verifies the JWT, and attaches
 *      the user data to req.user so controllers can access it
 *
 * WHAT IS A JWT?
 *   It's a Base64-encoded string with 3 parts: header.payload.signature
 *   The payload contains: { id, email, iat (issued at), exp (expires at) }
 *   The signature is a cryptographic hash — if anyone tampers with the payload,
 *   the signature won't match and we reject the token.
 *
 * USAGE:
 *   Add requireAuth to any route that needs a logged-in user:
 *   router.get('/profile', requireAuth, getProfile)
 *
 *   Then in your controller:
 *   const userId = req.user!.id  // TypeScript knows req.user is defined here
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler'

// ─── Type Augmentation ─────────────────────────────────────────────────────────
// By default, Express's Request type doesn't have a `user` property.
// This extends Express's Request interface globally so TypeScript knows
// req.user exists after requireAuth runs.
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

// Shape of the data we store inside the JWT payload
interface JWTPayload {
  id: string
  email: string
  iat: number // issued at (unix timestamp)
  exp: number // expires at (unix timestamp)
}

/**
 * Middleware that verifies the JWT token from the request cookie.
 * Attaches the decoded user to req.user if valid.
 * Throws 401 if no token or token is invalid/expired.
 */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  // Read the JWT from the HTTP-only cookie named 'token'
  // (We set this cookie name in the login controller)
  const token = req.cookies?.token

  // No token = not logged in
  if (!token) {
    throw new AppError('Authentication required. Please log in.', 401)
  }

  try {
    // jwt.verify() checks:
    //   1. The signature is valid (wasn't tampered with)
    //   2. The token hasn't expired
    //   3. It was signed with our JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload

    // Attach the user data to the request object
    // Controllers access this with req.user.id
    req.user = {
      id: decoded.id,
      email: decoded.email,
    }

    // Call next() to pass control to the actual route handler
    next()
  } catch (err) {
    // jwt.verify throws if the token is invalid or expired
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Session expired. Please log in again.', 401)
    }
    throw new AppError('Invalid authentication token. Please log in.', 401)
  }
}
