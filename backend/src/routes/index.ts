/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Route Aggregator (src/routes/index.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the central hub that connects all feature route files.
 * It creates one combined Router and exports it to app.ts.
 *
 * How routing works in Express:
 *   app.use('/api/v1', router)        ← app.ts registers this router
 *   router.use('/auth', authRoutes)   ← this file maps /auth to authRoutes
 *   authRoutes: POST /register        ← auth.routes.ts defines the handler
 *
 * Final URL: POST /api/v1/auth/register
 *
 * Adding a new feature? Create a new route file and add it here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express'

import authRoutes from './auth.routes'
import jobsRoutes from './jobs.routes'
import profileRoutes from './profile.routes'
import applicationsRoutes from './applications.routes'
import dashboardRoutes from './dashboard.routes'

export const router = Router()

// ─── Feature Routes ────────────────────────────────────────────────────────────
// Each line mounts a feature's routes under a path prefix.
// The prefix here + the path defined in each route file = the full endpoint URL.

router.use('/auth', authRoutes) // → /api/v1/auth/*
router.use('/jobs', jobsRoutes) // → /api/v1/jobs/*
router.use('/profile', profileRoutes) // → /api/v1/profile/*
router.use('/applications', applicationsRoutes) // → /api/v1/applications/*
router.use('/dashboard', dashboardRoutes) // → /api/v1/dashboard/*
