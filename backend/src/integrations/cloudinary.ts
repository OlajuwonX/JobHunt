/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Cloudinary Integration (src/integrations/cloudinary.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Provides typed wrappers around Cloudinary SDK calls for resume uploads.
 *
 * SECURITY NOTES:
 *   - All uploaded resumes use access_mode: 'authenticated' — never public URLs.
 *   - Signed URLs with expiry should be used when serving resumes to users.
 *   - api_secret MUST stay server-side only — never sent to the client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { v2 as cloudinary } from 'cloudinary'
import { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import { PassThrough } from 'stream'

// ─── Configure on module load ─────────────────────────────────────────────────
// Reads credentials from environment variables — never hardcoded.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Uploads a Buffer to Cloudinary via a PassThrough stream.
 *
 * WHY PassThrough?
 * Cloudinary's upload_stream API expects a Node.js readable stream, but we
 * have a Buffer from multer's memoryStorage. We pipe the Buffer into a
 * PassThrough stream (essentially a no-op transform stream) which Cloudinary
 * can consume as a readable.
 *
 * WHY NOT upload() directly?
 * cloudinary.uploader.upload() only accepts file paths or base64 data URIs.
 * For in-memory buffers (no temp file), upload_stream is the correct approach.
 *
 * @param buffer  - The file buffer from multer memoryStorage
 * @param options - Cloudinary upload options (folder, public_id, resource_type, etc.)
 * @returns       - Cloudinary UploadApiResponse with secure_url, public_id, etc.
 */
export function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        return reject(error ?? new Error('Cloudinary upload returned no result'))
      }
      resolve(result)
    })

    // Pipe the in-memory buffer into the upload stream
    const passThrough = new PassThrough()
    passThrough.pipe(uploadStream)
    passThrough.end(buffer)
  })
}

/**
 * Deletes a resource from Cloudinary by its public_id.
 *
 * Used when a user re-uploads their resume — we delete the old file to avoid
 * accumulating orphaned files in the Cloudinary account.
 *
 * @param publicId - The Cloudinary public_id of the resource to delete
 */
export async function deleteResource(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
}
