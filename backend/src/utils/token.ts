/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Token Utilities (src/utils/token.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This app uses TWO types of tokens:
 *
 * ┌─────────────────┬──────────────────────────────────────────────────────────┐
 * │ Token Type      │ Details                                                  │
 * ├─────────────────┼──────────────────────────────────────────────────────────┤
 * │ Access Token    │ JWT, expires in 5 min, stored in MEMORY (never cookie)   │
 * │                 │ Contains: userId, email                                  │
 * │                 │ Used by: frontend to call protected API endpoints         │
 * ├─────────────────┼──────────────────────────────────────────────────────────┤
 * │ Refresh Token   │ Random 256-bit string, expires in 30 days                │
 * │                 │ Stored in: HttpOnly cookie (JS can't read it)            │
 * │                 │ Used by: frontend to get a new access token when it       │
 * │                 │ expires, without requiring the user to log in again       │
 * └─────────────────┴──────────────────────────────────────────────────────────┘
 *
 * WHY TWO TOKENS?
 *   Short-lived access tokens limit the damage if one is stolen.
 *   If an attacker gets your access token, they have 5 minutes — not 30 days.
 *   The refresh token is in an HttpOnly cookie so JavaScript can't access it,
 *   protecting it from XSS attacks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

// The data we embed inside the JWT (the "payload")
export interface AccessTokenPayload {
  id: string        // user's database ID
  email: string     // user's email address
  type: 'access'    // token type guard — prevents refresh/verify tokens from being misused as access tokens
  sessionId?: string // the session this token belongs to — useful for per-session revocation
}

// The full decoded JWT (payload + JWT standard claims)
export interface DecodedToken extends AccessTokenPayload {
  iat: number // issued at (unix timestamp)
  exp: number // expires at (unix timestamp)
}

// ─── Access Token ─────────────────────────────────────────────────────────────

/**
 * Creates a signed JWT access token for a user.
 * Expires in 5 minutes — short-lived by design.
 *
 * HOW JWT WORKS:
 *   The token is Base64-encoded in 3 parts: header.payload.signature
 *   The signature is created with our JWT_SECRET — any tampering breaks it.
 *   Anyone can decode the payload (it's just Base64), but can't forge a new
 *   valid signature without the secret.
 *
 * IMPORTANT: Access tokens are stored in memory on the frontend (a React variable).
 * They are NEVER written to localStorage, sessionStorage, or cookies.
 *
 * @example
 * const token = generateAccessToken({ id: 'usr_123', email: 'user@example.com' })
 * // "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6..." (JWT string)
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '5m', // expires in 5 minutes
    algorithm: 'HS256',
  })
}

/**
 * Verifies and decodes a JWT access token.
 * Throws if the token is invalid, expired, or tampered with.
 *
 * @throws JsonWebTokenError — if signature is invalid
 * @throws TokenExpiredError — if token is past its expiry
 */
export const verifyAccessToken = (token: string): DecodedToken => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random refresh token.
 * 64 bytes = 512 bits of entropy = practically unguessable.
 *
 * This is NOT a JWT — it's just a random string we store in the database
 * (hashed) and send to the browser as an HttpOnly cookie.
 *
 * @example
 * const token = generateRefreshToken()
 * // "a3f5c2d8e1b7f4a9c6e3d2b8f1a7c4e9..." (128 hex chars)
 */
export const generateRefreshToken = (): string => {
  return randomBytes(64).toString('hex')
}

// ─── Email Verification Token ─────────────────────────────────────────────────

/**
 * Generates a URL-safe verification token for email confirmation.
 * Shorter than refresh tokens (32 bytes) since it's embedded in a URL.
 *
 * @example
 * const token = generateVerifyToken()
 * // "7f3a9c2e1b4d8f5a..." (64 hex chars)
 */
export const generateVerifyToken = (): string => {
  return randomBytes(32).toString('hex')
}

// ─── CSRF Token ───────────────────────────────────────────────────────────────

/**
 * Generates a CSRF token for the double-submit cookie pattern.
 * Sent as a readable cookie (not HttpOnly) so JavaScript can read and
 * include it in the X-CSRF-Token request header.
 *
 * @example
 * const csrfToken = generateCsrfToken()
 */
export const generateCsrfToken = (): string => {
  return randomBytes(32).toString('hex')
}
