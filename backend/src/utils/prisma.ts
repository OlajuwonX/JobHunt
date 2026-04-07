/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Prisma Client Singleton (src/utils/prisma.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS PRISMA CLIENT?
 *   Prisma Client is the object you use to talk to the database.
 *   It knows your schema (tables, columns, relations) and gives you
 *   type-safe methods:
 *     prisma.user.findUnique(...)  → SELECT * FROM users WHERE ...
 *     prisma.user.create(...)      → INSERT INTO users ...
 *     prisma.user.update(...)      → UPDATE users SET ...
 *
 * WHY A SINGLETON?
 *   Creating a new PrismaClient() opens a database connection.
 *   If you did `new PrismaClient()` in every file, you'd open hundreds
 *   of connections and hit the database connection limit very quickly.
 *
 *   The singleton pattern ensures we create ONE client for the whole app
 *   and reuse it everywhere.
 *
 * WHY THE globalThis TRICK?
 *   In development, Next.js (and nodemon) hot-reload the server when files
 *   change. Each reload would create a new PrismaClient, leaking connections.
 *   Storing it on globalThis survives hot reloads — the same client is reused.
 *
 * USAGE:
 *   import prisma from '../utils/prisma'
 *   const user = await prisma.user.findUnique({ where: { id: '...' } })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client'

// Extend the global type so TypeScript knows about our cached prisma instance
declare global {
  var prisma: PrismaClient | undefined
}

// Create a new PrismaClient with query logging in development
// In production, we only log errors (not every SQL query — too noisy)
const createPrismaClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn'] // shows every SQL query in dev terminal
        : ['error'], // only show errors in production
  })

// Use the cached instance if it exists (survives hot reloads in dev)
// Create a new one if it doesn't (first startup)
const prisma = globalThis.prisma ?? createPrismaClient()

// In development: cache on globalThis to survive hot reloads
// In production: don't cache (process restarts cleanly, no hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
