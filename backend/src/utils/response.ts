/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Response Helpers (src/utils/response.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tiny helper functions so every controller sends responses in the same shape.
 *
 * Instead of writing:
 *   res.status(200).json({ success: true, data: jobs })
 *   res.status(201).json({ success: true, data: newUser })
 *
 * You write:
 *   sendSuccess(res, jobs)
 *   sendSuccess(res, newUser, 201)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Response } from 'express'

/**
 * Send a successful JSON response.
 * @param res    - Express response object
 * @param data   - The payload to send (any serializable value)
 * @param status - HTTP status code (default: 200)
 */
export const sendSuccess = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json({ success: true, data })
}

/**
 * Send a 201 Created response (shorthand for POST endpoints that create resources).
 * @param res  - Express response object
 * @param data - The newly created resource
 */
export const sendCreated = <T>(res: Response, data: T): void => {
  sendSuccess(res, data, 201)
}
