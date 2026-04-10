/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Hashing Utilities (src/utils/hash.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * We hash two different things in this app, using different algorithms:
 *
 * 1. PASSWORDS → Argon2id
 *    Argon2 is the winner of the Password Hashing Competition (2015).
 *    It's designed to be deliberately slow and memory-hard, so brute-force
 *    attacks are expensive even with GPUs.
 *    Output: "$argon2id$v=19$m=65536,t=3,p=4$..." (irreversible)
 *
 * 2. TOKENS → SHA-256 (via Node.js crypto)
 *    Refresh tokens and email verify tokens are already random (256-bit entropy).
 *    SHA-256 is fast and sufficient here — we just need to prevent the
 *    database from exposing usable tokens if it's ever compromised.
 *    Output: "a3f5c2..." (hex string, 64 chars)
 *    Functions: hashRefreshToken (refresh tokens), hashToken (general purpose)
 *
 * 3. JOB HASH → SHA-256
 *    Used for deduplication. Same job from two sources = same hash.
 *    We need this to be deterministic (same input → same output always).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import argon2 from 'argon2'
import { createHash } from 'crypto'

// ─── Password Hashing (Argon2id) ──────────────────────────────────────────────

/**
 * Hashes a plain-text password using Argon2id.
 * This is async because Argon2 is intentionally slow (that's the point).
 *
 * @example
 * const hash = await hashPassword('mysecret')
 * // "$argon2id$v=19$m=65536,t=3,p=4$..."
 */
export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, {
    type: argon2.argon2id, // argon2id is the recommended variant (most secure)
    memoryCost: 65536, // 64 MB of memory required — makes GPU cracking expensive
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 parallel threads
  })
}

/**
 * Verifies a plain-text password against a stored Argon2 hash.
 * Returns true if they match, false if not.
 * Never throws — always returns boolean.
 *
 * @example
 * const match = await verifyPassword(storedHash, 'mysecret')
 * if (!match) throw new AppError('Invalid password', 401)
 */
export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password)
  } catch {
    // argon2.verify throws on malformed hashes — treat as no match
    return false
  }
}

// ─── Refresh Token Hashing (SHA-256) ─────────────────────────────────────────

/**
 * Hashes a refresh token using SHA-256.
 * Used to store refresh tokens in the database without storing the raw value.
 *
 * WHY SHA-256 AND NOT ARGON2?
 *   Refresh tokens are already 256-bit random strings — they have maximum entropy.
 *   We don't need Argon2's slowness here because brute-force is impossible
 *   against a 256-bit random value. SHA-256 is fast and deterministic,
 *   which is what we need for database lookups.
 *
 * @example
 * const hash = hashRefreshToken(rawToken)
 * // "a3f5c2d8e1b7..." (64 hex chars)
 */
export const hashRefreshToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * General-purpose SHA-256 token hash.
 * Used for any security token that needs to be stored hashed in the DB
 * (e.g. email verification tokens, password reset tokens).
 *
 * Same rationale as hashRefreshToken — the raw token is sent to the user,
 * only the hash is stored, so a DB breach can't be used to activate accounts.
 */
export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex')
}

// ─── Job Deduplication Hash (SHA-256) ─────────────────────────────────────────

/**
 * Generates a deterministic hash for a job listing.
 * Same job from different sources → same hash → deduplicated.
 *
 * We hash the combination of title + company + location (lowercased + trimmed)
 * so minor formatting differences don't create duplicates.
 *
 * @example
 * const hash = hashJob('Frontend Engineer', 'Stripe', 'San Francisco, CA')
 * // "9a2f4c..." — same output every time for the same inputs
 */
export const hashJob = (title: string, company: string, location: string | null): string => {
  const normalized = [title, company, location ?? ''].map((s) => s.toLowerCase().trim()).join('|')

  return createHash('sha256').update(normalized).digest('hex')
}
