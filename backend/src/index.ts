/**
 * ─────────────────────────────────────────────────────────────────────────────
 * JobHunt Backend — Entry Point (src/index.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the very first file that runs when you start the server.
 * Its only responsibility is to:
 *   1. Load environment variables from .env
 *   2. Import and start the configured Express app
 *   3. Handle graceful shutdown
 *
 * Think of this file like the "power button" — it turns things on.
 * All the real configuration (middleware, routes) lives in app.ts.
 *
 * Run in dev:  npm run dev
 * Run in prod: npm run build && npm start
 * ─────────────────────────────────────────────────────────────────────────────
 */

// dotenv reads the .env file and puts all values into process.env
// IMPORTANT: This must be called BEFORE importing anything else
// because other modules read process.env at import time
import dotenv from 'dotenv'
dotenv.config()

import { app } from './app'
import { createSocketServer } from './utils/socket'

// ─── Register Cron Jobs ────────────────────────────────────────────────────────
// Importing these files causes them to self-register their cron schedules.
// The cron jobs log their schedule on import so you can confirm they registered.
//
// fetchApiJobs.ts   → cron registered for daily 02:00 AM
// fetchScraperJobs.ts → cron registered for daily 06:00 AM
//
// WHY IMPORT AT TOP LEVEL?
// node-cron registers schedules when the module loads. We need them to load
// exactly once at server startup — not on every request. Top-level imports
// guarantee this.
import { runIfEmpty } from './jobs/fetchApiJobs'
import { runScraperIfNeeded } from './jobs/fetchScraperJobs'

// ─── Port Configuration ────────────────────────────────────────────────────────
// Use PORT from .env if set, otherwise default to 4000
// process.env values are always strings, so we cast to Number
const PORT = Number(process.env.PORT) || 4000

// ─── Start HTTP Server ─────────────────────────────────────────────────────────
// app.listen() starts accepting incoming connections
// The callback runs once the server is ready
const httpServer = app.listen(PORT, () => {
  console.log(`\n JobHunt API is running`)
  console.log(`   Local:   http://localhost:${PORT}`)
  console.log(`   Health:  http://localhost:${PORT}/health`)
  console.log(`   Env:     ${process.env.NODE_ENV || 'development'}\n`)

  // Trigger API fetch if table is empty, then trigger scraper fetch if no
  // Nigerian jobs exist yet. Both run sequentially so scrapers don't start
  // before API data has been written (avoids duplicate DB contention).
  runIfEmpty()
    .then(() => runScraperIfNeeded())
    .catch(console.error)
})

// ─── Attach Socket.io ─────────────────────────────────────────────────────────
// Socket.io runs on top of the same HTTP server.
// This enables real-time bidirectional communication with the frontend.
// (e.g. push "you have 3 new matching jobs" without the user refreshing)
createSocketServer(httpServer)

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// When the server receives a termination signal (e.g. from Docker, Railway, or
// Ctrl+C in production), we want to:
//   1. Stop accepting new connections
//   2. Finish processing any in-flight requests
//   3. Close database connections
//   4. Exit cleanly (exit code 0 = success)
//
// Without this, abrupt shutdowns can corrupt in-progress DB writes
// or leave database connections hanging.
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down gracefully...`)

  httpServer.close(() => {
    console.log('✓ HTTP server closed')
    console.log('✓ Shutdown complete\n')
    process.exit(0)
  })

  // Force-kill after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

// SIGTERM is sent by Docker, Kubernetes, Railway, etc. when stopping a container
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// SIGINT is sent when you press Ctrl+C in the terminal
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Catch unhandled promise rejections (e.g. a DB call that fails without try/catch)
// In production these would be silent bugs — this makes them visible
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Promise Rejection:', reason)
  // Don't crash the server — just log it (Sentry will capture this too)
})
