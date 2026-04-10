/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Service (src/services/auth.service.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the BRAIN of authentication. It contains all the business logic.
 * Controllers call these functions — they don't contain any logic themselves.
 *
 * LAYER REMINDER:
 *   Route → Controller → Service ← (you are here) → Prisma → PostgreSQL
 *
 * WHAT THIS FILE HANDLES:
 *   - register()       → create account, hash password, send verification email
 *   - login()          → verify credentials, create session, issue tokens
 *   - logout()         → revoke session, clear cookies
 *   - refresh()        → validate refresh token, rotate it, issue new access token
 *   - verifyEmail()    → activate account using token from email link
 *   - getUserById()    → get safe user data for /auth/me
 *   - logAuthEvent()   → write to the audit log (auth_logs table)
 *
 * SECURITY MODEL (read this carefully):
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ Access Token (JWT)                                                  │
 *   │   - Lives in memory on the frontend (React variable)               │
 *   │   - Expires in 5 minutes                                           │
 *   │   - Used as: Authorization: Bearer <token> header                  │
 *   │   - If stolen: attacker has max 5 minutes                          │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │ Refresh Token                                                       │
 *   │   - Lives in HttpOnly cookie (JavaScript cannot read it)           │
 *   │   - Expires in 30 days                                             │
 *   │   - Single-use: rotated on every use                               │
 *   │   - Stored hashed in DB (raw value never persisted)                │
 *   │   - If reused: ALL user sessions revoked (compromise detected)     │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │ CSRF Token                                                          │
 *   │   - Lives in readable cookie (JS CAN read it — that's the point)  │
 *   │   - Must be sent as X-CSRF-Token header on mutations               │
 *   │   - Prevents cross-site request forgery                            │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import prisma from '../utils/prisma'
import { hashPassword, verifyPassword, hashRefreshToken } from '../utils/hash'
import {
  generateAccessToken,
  generateRefreshToken,
  generateVerifyToken,
  generateCsrfToken,
} from '../utils/token'
import { sendVerificationEmail } from '../utils/email'
import { AppError } from '../middleware/errorHandler'

// ─── Types ────────────────────────────────────────────────────────────────────

// The "safe" user shape — what we return to the frontend.
// NEVER includes passwordHash or internal tokens.
export interface SafeUser {
  id: string
  email: string
  verified: boolean
  createdAt: Date
}

// Returned by login() and refresh() — everything the frontend needs
export interface AuthResult {
  accessToken: string // stored in memory on the frontend
  refreshToken: string // stored in HttpOnly cookie by the controller
  csrfToken: string // stored in readable cookie by the controller
  user: SafeUser
}

// ─── Cookie Configuration ────────────────────────────────────────────────────
// Centralised cookie options so every place we set the refresh token cookie
// uses exactly the same settings.
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // JavaScript cannot read this cookie — critical for security
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  path: '/',
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────

/**
 * Creates a new user account.
 *
 * Flow:
 *   1. Check email isn't already taken
 *   2. Hash password with Argon2
 *   3. Generate email verification token
 *   4. Save user to database
 *   5. Send verification email
 *   6. Log the event
 *
 * @throws AppError(409) if email already exists
 */
export const register = async (
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ message: string }> => {
  // ── Step 1: Check for duplicate email ─────────────────────────────────────
  // We check BEFORE hashing to avoid doing expensive Argon2 work unnecessarily.
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true }, // only fetch what we need (performance)
  })

  if (existingUser) {
    // Don't reveal whether the email exists or not in a timing-safe way.
    // We throw 409 Conflict — the email is taken.
    throw new AppError('An account with this email already exists.', 409)
  }

  // ── Step 2: Hash the password ──────────────────────────────────────────────
  // This takes ~100-200ms intentionally (Argon2 is designed to be slow).
  const passwordHash = await hashPassword(password)

  // ── Step 3: Generate verification token ────────────────────────────────────
  // A random 256-bit token sent in the verification email link.
  const verifyToken = generateVerifyToken()

  // Token expires in 24 hours from now
  const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000)

  // ── Step 4: Save user ──────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(), // always store email in lowercase
      passwordHash,
      verifyToken,
      verifyTokenExp,
      // Also create an empty profile for this user in the same transaction
      profile: {
        create: {
          roles: [],
          skills: [],
        },
      },
    },
    select: { id: true, email: true },
  })

  // ── Step 5: Send verification email ────────────────────────────────────────
  // We don't await this in a try/catch that would fail the registration.
  // If email fails, the account is still created — user can request resend later.
  sendVerificationEmail(user.email, verifyToken).catch((err) => {
    console.error(`[Auth] Failed to send verification email to ${user.email}:`, err)
  })

  // ── Step 6: Log the event ──────────────────────────────────────────────────
  await logAuthEvent({
    userId: user.id,
    event: 'register',
    ipAddress,
    userAgent,
  })

  return {
    message: 'Account created successfully. Please check your email to verify your account.',
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

/**
 * Authenticates a user and creates a new session.
 *
 * Flow:
 *   1. Find user by email
 *   2. Verify password with Argon2
 *   3. Check email is verified
 *   4. Generate access token, refresh token, CSRF token
 *   5. Hash refresh token and save session to DB
 *   6. Log the event
 *   7. Return tokens (controller sets cookies)
 *
 * @throws AppError(401) for invalid credentials
 * @throws AppError(403) for unverified email
 */
export const login = async (
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthResult> => {
  // ── Step 1: Find user ──────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    // Select exactly what we need — never over-fetch
    select: {
      id: true,
      email: true,
      passwordHash: true,
      verified: true,
      createdAt: true,
    },
  })

  // ── Step 2: Verify password ────────────────────────────────────────────────
  // IMPORTANT: We always run verifyPassword even if the user doesn't exist.
  // This prevents timing attacks — an attacker can't tell if the email exists
  // based on how fast the server responds.
  const passwordValid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$dummy', 'dummy') // dummy hash

  if (!user || !passwordValid) {
    // Log the failed attempt (for monitoring)
    await logAuthEvent({
      userId: user?.id,
      event: 'login_failed',
      ipAddress,
      userAgent,
      metadata: { email }, // log attempted email for security monitoring
    })
    // Use a generic message — don't tell attacker which field was wrong
    throw new AppError('Invalid email or password.', 401)
  }

  // ── Step 3: Check email verification ──────────────────────────────────────
  if (!user.verified) {
    throw new AppError(
      'Please verify your email before logging in. Check your inbox for the verification link.',
      403
    )
  }

  // ── Step 4: Generate tokens ────────────────────────────────────────────────
  const accessToken = generateAccessToken({ id: user.id, email: user.email, type: 'access' })
  const refreshToken = generateRefreshToken()
  const csrfToken = generateCsrfToken()

  // ── Step 5: Save session ───────────────────────────────────────────────────
  // We store the HASH of the refresh token — never the raw token.
  const refreshTokenHash = hashRefreshToken(refreshToken)

  // Session expires in 30 days (absolute maximum lifetime)
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt: sessionExpiresAt,
    },
  })

  // ── Step 6: Log the event ──────────────────────────────────────────────────
  await logAuthEvent({
    userId: user.id,
    event: 'login_success',
    ipAddress,
    userAgent,
  })

  // ── Step 7: Return tokens ──────────────────────────────────────────────────
  // The controller will set the refresh token as an HttpOnly cookie
  // and the CSRF token as a readable cookie.
  return {
    accessToken,
    refreshToken,
    csrfToken,
    user: {
      id: user.id,
      email: user.email,
      verified: user.verified,
      createdAt: user.createdAt,
    },
  }
}

// ─── REFRESH ──────────────────────────────────────────────────────────────────

/**
 * Issues a new access token using a valid refresh token.
 * Rotates the refresh token (old one is invalidated, new one issued).
 *
 * Flow:
 *   1. Hash the incoming refresh token
 *   2. Find the matching session
 *   3. Validate session (not revoked, not expired)
 *   4. DETECT TOKEN REUSE: if token was already used → revoke all sessions
 *   5. Mark old session revoked, create new session
 *   6. Issue new access + refresh + CSRF tokens
 *
 * @throws AppError(401) if token is invalid/expired/revoked
 */
export const refresh = async (
  rawRefreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthResult> => {
  // ── Step 1: Hash the incoming token for DB lookup ──────────────────────────
  const refreshTokenHash = hashRefreshToken(rawRefreshToken)

  // ── Step 2: Find the session ───────────────────────────────────────────────
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          verified: true,
          createdAt: true,
        },
      },
    },
  })

  // ── Step 3: Validate session ───────────────────────────────────────────────
  if (!session) {
    // Token doesn't match any session — could be:
    //   a) An invalid/random token
    //   b) A previously rotated token being reused (SECURITY ALERT)
    // We can't distinguish these without more context, so just reject it.
    throw new AppError('Invalid or expired session. Please log in again.', 401)
  }

  // ── Step 4: Detect token reuse (SECURITY CRITICAL) ────────────────────────
  if (session.revoked) {
    // A revoked token is being used — this means either:
    //   a) The user's refresh token was stolen and used by an attacker
    //   b) A bug in the frontend is sending old tokens
    //
    // Either way: REVOKE ALL SESSIONS for this user immediately.
    // The user will have to log in again on all devices.
    await prisma.session.updateMany({
      where: { userId: session.userId },
      data: { revoked: true },
    })

    await logAuthEvent({
      userId: session.userId,
      event: 'token_reuse',
      ipAddress,
      userAgent,
      metadata: { sessionId: session.id, reason: 'revoked token reuse detected' },
    })

    await logAuthEvent({
      userId: session.userId,
      event: 'sessions_revoked',
      ipAddress,
      userAgent,
      metadata: { reason: 'all sessions revoked due to token reuse' },
    })

    throw new AppError(
      'Security alert: suspicious activity detected. All sessions have been terminated. Please log in again.',
      401
    )
  }

  // Check if the session has expired (absolute lifetime check)
  if (session.expiresAt < new Date()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    })
    throw new AppError('Session has expired. Please log in again.', 401)
  }

  // ── Step 5: Rotate the refresh token ──────────────────────────────────────
  // Mark the current session as revoked (single-use)
  await prisma.session.update({
    where: { id: session.id },
    data: { revoked: true },
  })

  // Generate brand new tokens
  const newAccessToken = generateAccessToken({ id: session.userId, email: session.user.email, type: 'access' })
  const newRefreshToken = generateRefreshToken()
  const newCsrfToken = generateCsrfToken()
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken)

  // Create a new session with the new refresh token
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.session.create({
    data: {
      userId: session.userId,
      refreshTokenHash: newRefreshTokenHash,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt: sessionExpiresAt,
    },
  })

  // ── Step 6: Log and return ─────────────────────────────────────────────────
  await logAuthEvent({
    userId: session.userId,
    event: 'token_refreshed',
    ipAddress,
    userAgent,
  })

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    csrfToken: newCsrfToken,
    user: {
      id: session.user.id,
      email: session.user.email,
      verified: session.user.verified,
      createdAt: session.user.createdAt,
    },
  }
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

/**
 * Logs the user out by revoking the current session.
 * The controller will clear the cookies.
 *
 * @throws AppError(401) if the refresh token is not found
 */
export const logout = async (
  rawRefreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  const refreshTokenHash = hashRefreshToken(rawRefreshToken)

  // Find and revoke the session
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    select: { id: true, userId: true, revoked: true },
  })

  if (session && !session.revoked) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    })

    await logAuthEvent({
      userId: session.userId,
      event: 'logout',
      ipAddress,
      userAgent,
    })
  }

  // We don't throw if the session doesn't exist — logout should always succeed
  // from the user's perspective (cookies will be cleared regardless)
}

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────

/**
 * Activates a user's account using the token from the verification email.
 *
 * @throws AppError(400) if token is invalid or expired
 * @throws AppError(400) if account is already verified
 */
export const verifyEmail = async (token: string): Promise<{ message: string }> => {
  // Find user by token — also check it hasn't expired
  const user = await prisma.user.findFirst({
    where: {
      verifyToken: token,
      verifyTokenExp: { gt: new Date() }, // token must not be expired
    },
    select: { id: true, verified: true, email: true },
  })

  if (!user) {
    throw new AppError('Invalid or expired verification link. Please request a new one.', 400)
  }

  if (user.verified) {
    throw new AppError('This account has already been verified. You can log in.', 400)
  }

  // Activate the account and clear the verification token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verified: true,
      verifyToken: null, // clear the token so it can't be reused
      verifyTokenExp: null,
    },
  })

  await logAuthEvent({
    userId: user.id,
    event: 'email_verified',
  })

  return { message: 'Email verified successfully. You can now log in.' }
}

// ─── GET USER BY ID ───────────────────────────────────────────────────────────

/**
 * Returns safe user data for the /auth/me endpoint.
 * Called after requireAuth middleware has verified the JWT.
 *
 * @throws AppError(404) if user doesn't exist (e.g. deleted after token was issued)
 */
export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      verified: true,
      createdAt: true,
      // Never select: passwordHash, verifyToken, resetToken
    },
  })

  if (!user) {
    throw new AppError('User not found.', 404)
  }

  return user
}

// ─── LOG AUTH EVENT ───────────────────────────────────────────────────────────

/**
 * Writes an auth event to the audit log.
 * Used internally by all auth functions above.
 * Failures are silently swallowed so they never break the main auth flow.
 */
const logAuthEvent = async ({
  userId,
  event,
  ipAddress,
  userAgent,
  metadata,
}: {
  userId?: string
  event: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}): Promise<void> => {
  try {
    await prisma.authLog.create({
      data: {
        userId: userId ?? null,
        event,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: metadata ?? null,
      },
    })
  } catch (err) {
    // Logging failure must NEVER break the auth flow
    console.error('[AuthLog] Failed to write auth event:', err)
  }
}
