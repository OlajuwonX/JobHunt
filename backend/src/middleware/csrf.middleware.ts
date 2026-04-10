/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CSRF Protection Middleware (src/middleware/csrf.middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS CSRF?
 *   Cross-Site Request Forgery. An attacker tricks a logged-in user's browser
 *   into making a request to your API without the user knowing.
 *
 *   Example attack:
 *   1. User is logged into jobhunt.com (JWT cookie is set in their browser)
 *   2. User visits evil.com
 *   3. evil.com has hidden code: fetch('https://api.jobhunt.com/profile', { method: 'PUT' })
 *   4. The browser automatically sends the JWT cookie with this request!
 *   5. The server sees a valid cookie and thinks it's a legitimate request.
 *
 * HOW WE PREVENT IT (Double Submit Cookie Pattern):
 *   1. On login, we generate a CSRF token and set it as a READABLE cookie
 *      (not HttpOnly — JavaScript CAN read this one)
 *   2. Our frontend JavaScript reads this cookie and includes it in every
 *      state-changing request as a header: X-CSRF-Token: <token>
 *   3. This middleware checks that the header matches the cookie
 *
 *   WHY DOES THIS WORK?
 *   evil.com's JavaScript cannot read cookies from jobhunt.com (Same-Origin Policy).
 *   So it can't get the CSRF token value to include in the header.
 *   Our API sees: cookie exists ✓, but header is missing ✗ → reject the request.
 *
 * WHAT REQUESTS NEED CSRF PROTECTION?
 *   Any request that CHANGES data: POST, PUT, PATCH, DELETE
 *   GET requests are safe (read-only, no state change)
 *
 * TIMING-SAFE COMPARISON:
 *   We use crypto.timingSafeEqual instead of simple === string comparison.
 *   A naive string comparison short-circuits on the first mismatched character,
 *   which can leak the token value character-by-character via timing measurements.
 *   timingSafeEqual always takes the same time regardless of where the mismatch is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { AppError } from './errorHandler'

// Methods that change server state — these require CSRF validation
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

// Routes exempt from CSRF. We use startsWith() so trailing slashes and
// sub-paths are also matched (e.g. /api/v1/auth/csrf-token/ still passes).
const CSRF_EXEMPT_PATHS = ['/api/v1/auth/csrf-token']

/**
 * Validates the CSRF double-submit cookie pattern.
 *
 * Expects:
 *   - Cookie:  csrf_token=<value>   (set by server on login, readable by JS)
 *   - Header:  X-CSRF-Token: <same value>  (sent by frontend on every mutation)
 *
 * Rejects the request if the header is missing or doesn't match the cookie.
 * Real failure reasons are logged server-side; client receives only "Forbidden".
 */
export const csrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  // Skip safe HTTP methods (GET, HEAD, OPTIONS) — read-only, no state change
  if (!CSRF_PROTECTED_METHODS.includes(req.method)) {
    return next()
  }

  // Skip explicitly exempt paths
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => req.path.startsWith(path))
  if (isExempt) {
    return next()
  }

  // Read the CSRF token from the readable cookie
  // (set by setCsrfCookie() in the login/refresh response)
  const cookieToken = req.cookies?.csrf_token as string | undefined

  // Read the CSRF token from the request header
  // (sent by the frontend JavaScript on every state-changing request)
  const headerToken = req.headers['x-csrf-token'] as string | undefined

  // Both must be present
  if (!cookieToken || !headerToken) {
    console.warn(
      `[csrfProtection] Missing CSRF token — cookie: ${!!cookieToken}, header: ${!!headerToken} — ${req.method} ${req.path}`
    )
    throw new AppError('Forbidden', 403)
  }

  // Timing-safe comparison: prevents token leakage via response-time measurements.
  // Both buffers must be the same length first — mismatched lengths also mean mismatch.
  const cookieBuffer = Buffer.from(cookieToken)
  const headerBuffer = Buffer.from(headerToken)

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    // Log server-side — mismatched tokens may indicate a CSRF probe or misconfigured frontend
    console.warn(
      `[csrfProtection] CSRF token mismatch — ${req.method} ${req.path} — ip: ${req.ip}`
    )
    throw new AppError('Forbidden', 403)
  }

  // All good — pass to the actual route handler
  next()
}

/**
 * Sets the CSRF token as a readable cookie on the response.
 * Called after successful login and token refresh.
 *
 * Note: This cookie is intentionally NOT HttpOnly so JavaScript can read it.
 * The security comes from Same-Origin Policy — only our domain's JS can read it.
 *
 * @param res       - Express response object
 * @param csrfToken - the random token to set (generated by generateCsrfToken())
 */
export const setCsrfCookie = (res: Response, csrfToken: string): void => {
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false, // MUST be false — frontend JavaScript needs to read this
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // only sent on same-site requests
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (matches refresh token lifetime)
    path: '/',
  })
}
