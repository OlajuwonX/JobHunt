/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Async Handler Wrapper (src/middleware/asyncHandler.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is a small utility that makes async route handlers work with Express's
 * error handling system.
 *
 * THE PROBLEM:
 *   Express doesn't automatically catch errors from async functions.
 *   If you do this in a controller:
 *
 *     router.get('/jobs', async (req, res) => {
 *       const jobs = await prisma.job.findMany() // if this throws...
 *       res.json(jobs)
 *     })
 *
 *   ...Express will NOT catch the error. The server will hang or crash.
 *
 * THE SOLUTION:
 *   Wrap every async controller with asyncHandler:
 *
 *     router.get('/jobs', asyncHandler(async (req, res) => {
 *       const jobs = await prisma.job.findMany() // error is caught!
 *       res.json(jobs)
 *     }))
 *
 *   asyncHandler wraps the function in a try/catch and passes any error
 *   to next(err), which triggers our global errorHandler middleware.
 *
 * WHY NOT TRY/CATCH EVERYWHERE?
 *   You can, but asyncHandler removes the repetition. One wrapper,
 *   all errors go to the central error handler.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'

// The type for any async Express route handler
type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>

/**
 * Wraps an async route handler so errors are passed to Express's error handler.
 *
 * @example
 * router.get('/jobs', asyncHandler(async (req, res) => {
 *   const jobs = await jobService.getJobs()
 *   res.json({ success: true, data: jobs })
 * }))
 */
export const asyncHandler = (fn: AsyncRouteHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Execute the async function and catch any errors
    // Errors are forwarded to next(), which triggers errorHandler.ts
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
