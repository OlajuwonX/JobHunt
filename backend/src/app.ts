/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Express App Configuration (src/app.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file configures the Express app (middleware + routes).
 * It does NOT start the server — that's index.ts.
 *
 * Every HTTP request passes through this middleware chain in order:
 *
 *   Request
 *     → helmet        (security headers)
 *     → cors          (allow frontend to call us)
 *     → json parser   (req.body becomes usable)
 *     → cookieParser  (req.cookies becomes usable)
 *     → rateLimit     (global throttle)
 *     → csrfProtection (validate X-CSRF-Token on mutations)
 *     → /api/v1/*     (your actual route handlers)
 *     → 404 handler
 *     → errorHandler  (catches all thrown errors)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'

import { router } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { csrfProtection } from './middleware/csrf.middleware'

export const app: Application = express()

// ─── Trust Proxy ───────────────────────────────────────────────────────────────
// Required when deployed behind Nginx, Railway, Render, or any reverse proxy.
// Ensures req.ip and rate limiting use the real client IP (from X-Forwarded-For)
// instead of the proxy's IP.
app.set('trust proxy', 1)

// ─── Helmet — Security Headers ────────────────────────────────────────────────
// Automatically adds ~15 HTTP response headers that protect against common attacks:
//   Content-Security-Policy → prevents XSS by restricting what scripts can run
//   X-Frame-Options          → prevents clickjacking (embedding in iframes)
//   X-Content-Type-Options   → prevents MIME sniffing
//   Strict-Transport-Security → forces HTTPS
app.use(helmet())

// ─── CORS — Cross-Origin Resource Sharing ─────────────────────────────────────
// Browsers block JavaScript from calling APIs on different domains by default.
// Our frontend (localhost:3000) calling our backend (localhost:4000) is
// "cross-origin" and would be blocked without this.
//
// We ONLY allow our frontend's exact origin — no wildcards.
// Credentials:true is required to send cookies across origins.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // REQUIRED: allows cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
)

// ─── Body Parsers ─────────────────────────────────────────────────────────────
// Without these, req.body is undefined.
// The 10kb limit prevents attackers from sending huge payloads.
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ─── Cookie Parser ────────────────────────────────────────────────────────────
// Without this, req.cookies is undefined.
// We use cookies for: refresh token (HttpOnly) and CSRF token (readable).
app.use(cookieParser())

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
// Soft global limit: 100 requests per 15 minutes per IP.
// Auth routes have their own stricter limits (10/15min) defined in auth.routes.ts.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP. Please try again later.',
    },
  })
)

// ─── CSRF Protection ──────────────────────────────────────────────────────────
// Validates the X-CSRF-Token header matches the csrf_token cookie
// on all state-changing requests (POST, PUT, PATCH, DELETE).
// See: src/middleware/csrf.middleware.ts for detailed explanation.
app.use(csrfProtection)

// ─── Health Check ─────────────────────────────────────────────────────────────
// Simple GET /health that returns 200.
// Used by Docker HEALTHCHECK, Railway, and monitoring tools.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ─── API Routes ───────────────────────────────────────────────────────────────
// All feature routes are mounted under /api/v1
// The "v1" prefix lets us deploy a v2 in the future without breaking clients.
app.use('/api/v1', router)

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// Any request that didn't match a route above lands here.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches any error thrown in the routes above.
// MUST be last — Express identifies error middleware by its 4-parameter signature.
app.use(errorHandler)
