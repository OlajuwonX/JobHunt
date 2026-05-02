/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Resume Upload Middleware (src/middleware/upload.middleware.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Configures multer for resume file uploads:
 *   - memoryStorage: files stay in memory as Buffer (no temp files on disk)
 *   - fileFilter: only accept PDF and Word documents
 *   - limits: max 5MB file size to prevent abuse
 *
 * Used in: POST /api/v1/profile/resume
 *
 * After this middleware runs, req.file contains:
 *   fieldname: 'resume'
 *   originalname: 'my-cv.pdf'
 *   mimetype: 'application/pdf'
 *   buffer: <Buffer ...>
 *   size: 123456
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'

// ─── Accepted MIME types for resume uploads ───────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]

// ─── Max file size: 5MB ───────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * File filter: rejects files that aren't PDFs or Word documents.
 * Multer calls this for every uploaded file before accepting it.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true) // accept the file
  } else {
    callback(
      new Error(
        'Invalid file type. Only PDF (.pdf) and Word (.doc, .docx) documents are accepted.'
      )
    )
  }
}

/**
 * Resume upload middleware.
 * Accepts a single file in the 'resume' form field.
 *
 * Usage in route:
 *   router.post('/resume', resumeUpload, uploadResume)
 */
export const resumeUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single('resume')
