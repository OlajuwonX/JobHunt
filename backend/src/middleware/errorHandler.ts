/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Error Handler Middleware (src/middleware/errorHandler.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This middleware catches ANY error thrown anywhere in the route pipeline and
 * returns a clean, consistent JSON response instead of crashing the server
 * or returning Express's default HTML error page.
 *
 * How Express error middleware works:
 *   Normal middleware has 3 params: (req, res, next)
 *   Error middleware has 4 params:  (err, req, res, next)
 *   Express identifies it by the 4-parameter signature.
 *
 * Usage in controllers/services:
 *   throw new AppError('User not found', 404)       — known errors
 *   throw new Error('Something broke')              — unexpected errors
 *   // Both are caught here automatically
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction } from 'express'

// ─── AppError Class ────────────────────────────────────────────────────────────
// A custom error class that lets us attach an HTTP status code to any error.
// When we throw AppError, we know it's an "expected" error (e.g. user not found).
// When we throw a plain Error, it's an unexpected bug — we log it and return 500.
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean // true = expected error, false = bug

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true // mark as a known/expected error

    // Fix: makes instanceof AppError work correctly in TypeScript
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// ─── Error Handler ────────────────────────────────────────────────────────────
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction // must be declared even if unused — Express needs all 4 params
): void => {
  // Check if it's our known AppError or an unexpected bug
  const isAppError = err instanceof AppError

  // Determine status code:
  //   - AppError: use the code we set (400, 401, 404, 409, etc.)
  //   - Unknown Error: always 500 (Internal Server Error)
  const statusCode = isAppError ? err.statusCode : 500

  // Determine message:
  //   - In development: show the real error message for debugging
  //   - In production:  show a generic message for 500s (don't leak internals)
  const message =
    isAppError || process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong. Please try again.'

  // Log unexpected errors (not AppErrors) — these are bugs that need fixing
  if (!isAppError) {
    console.error('Unexpected Error:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    })
  }

  // Return a consistent error response shape
  // The frontend always knows to look for: { success: false, error: string }
  res.status(statusCode).json({
    success: false,
    error: message,
    // Only include stack trace in development (never in production)
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
