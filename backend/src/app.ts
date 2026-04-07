/**
 * ─────────────────────────────────────────────────────────────────────────────
 * JobHunt Backend — Express App Configuration (src/app.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file CONFIGURES the Express app — it doesn't start it (that's index.ts).
 *
 * Middleware is the key concept here. Every HTTP request passes through a
 * "middleware chain" before reaching your route handler. Think of it like
 * airport security — every passenger (request) goes through every checkpoint
 * in order: check ticket → scan bag → check ID → board plane.
 *
 * Our request pipeline:
 *   Request
 *     → helmet        (add security headers)
 *     → cors          (allow frontend to call us)
 *     → express.json  (parse the JSON body so req.body works)
 *     → cookieParser  (parse cookies so req.cookies works)
 *     → rateLimit     (block IPs making too many requests)
 *     → /api/v1/*     (your actual route handlers)
 *     → 404 handler   (if no route matched)
 *     → errorHandler  (catches any errors thrown above)
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

// Create the Express application instance
export const app: Application = express()

// ─── Trust Proxy ───────────────────────────────────────────────────────────────
// When deployed behind a reverse proxy (Nginx, Railway, Vercel) the real client
// IP is in the X-Forwarded-For header. This tells Express to trust that header
// so rate limiting works correctly (otherwise all requests look like they come
// from the proxy's IP instead of the real user's IP).
app.set('trust proxy', 1)

// ─── Helmet — Security Headers ────────────────────────────────────────────────
// Helmet automatically sets ~15 HTTP response headers that protect against
// common web vulnerabilities:
//   - Content-Security-Policy: restricts what resources can load (XSS prevention)
//   - X-Frame-Options: prevents clickjacking
//   - X-Content-Type-Options: prevents MIME type sniffing
//   - Strict-Transport-Security: forces HTTPS
// You get all of this for free with one line.
app.use(helmet())

// ─── CORS — Cross-Origin Resource Sharing ─────────────────────────────────────
// By default, browsers block JavaScript from calling an API on a different domain.
// Our frontend (localhost:3000) calling our backend (localhost:4000) is
// "cross-origin" — so without CORS the browser would reject every request.
//
// We whitelist our frontend URL and allow credentials (needed for JWT cookies).
app.use(
  cors({
    // Only allow requests from our frontend (set FRONTEND_URL in .env)
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',

    // REQUIRED for cookies — without this, JWT cookies won't be sent cross-origin
    credentials: true,

    // Which HTTP methods we allow
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Which headers the frontend is allowed to send
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
)

// ─── Body Parsers ─────────────────────────────────────────────────────────────
// Without these, req.body would be undefined.
// express.json() reads the raw request body and parses it as JSON.
// The 10kb limit prevents attackers from sending huge payloads to crash the server.
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ─── Cookie Parser ────────────────────────────────────────────────────────────
// Without this, req.cookies would be undefined.
// We use cookies to store the JWT auth token (safer than localStorage).
// HTTP-only cookies can't be read by JavaScript — only sent with requests.
app.use(cookieParser())

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
// Limits any single IP to 100 requests per 15 minutes across the entire API.
// This is a "soft" global limit — stricter limits are applied on specific routes
// (e.g. auth routes are limited to 10 requests/15min to prevent brute force).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    limit: 100,                // max 100 requests per window per IP
    standardHeaders: true,     // send RateLimit-* headers in responses
    legacyHeaders: false,      // don't send X-RateLimit-* (deprecated)
    message: {
      success: false,
      error: 'Too many requests from this IP. Please try again later.',
    },
  })
)

// ─── Health Check Endpoint ────────────────────────────────────────────────────
// A simple GET /health endpoint that returns 200 OK.
// Used by:
//   - Docker to check if the container is healthy (HEALTHCHECK in Dockerfile)
//   - Railway/Render to know when the app is ready to receive traffic
//   - Monitoring tools to alert when the API goes down
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(), // seconds since server started
  })
})

// ─── API Routes ───────────────────────────────────────────────────────────────
// All our feature routes are mounted under /api/v1
// The "v1" prefix lets us release a v2 in the future without breaking existing clients
// router (from routes/index.ts) combines all feature routes
app.use('/api/v1', router)

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// If a request reaches here, no route matched.
// We return a clean JSON 404 instead of Express's default HTML error page.
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches errors thrown anywhere in route handlers above.
// This MUST be the last app.use() call — Express identifies error middleware
// by its 4-parameter signature (err, req, res, next).
// See: src/middleware/errorHandler.ts
app.use(errorHandler)
