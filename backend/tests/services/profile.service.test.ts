/**
 * Profile Service Unit Tests
 * (tests/services/profile.service.test.ts)
 *
 * Tests business logic in src/services/profile.service.ts.
 * Both Prisma and Cloudinary are mocked — no real DB or network calls.
 *
 * COVERAGE:
 *   getProfile()    — found + not-found (default shape) paths
 *   updateProfile() — upsert with partial fields
 *   uploadResume()  — Cloudinary success + failure paths
 */

import { Readable } from 'stream'
import { getProfile, updateProfile, uploadResume } from '../../src/services/profile.service'
import { AppError } from '../../src/middleware/errorHandler'

// Mock Prisma singleton
jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    profile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

// Mock Cloudinary integration
jest.mock('../../src/integrations/cloudinary', () => ({
  uploadBuffer: jest.fn(),
}))

import prisma from '../../src/utils/prisma'
import { uploadBuffer } from '../../src/integrations/cloudinary'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockUploadBuffer = uploadBuffer as jest.MockedFunction<typeof uploadBuffer>

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const USER_ID = 'user_clx123'

const makeProfileRecord = (overrides = {}) => ({
  id: 'profile_clx001',
  userId: USER_ID,
  roles: ['Frontend Engineer'],
  skills: ['React', 'TypeScript'],
  location: 'Lagos, Nigeria',
  remotePref: 'remote',
  resumeUrl: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  user: { email: 'user@example.com' },
  ...overrides,
})

const makeMulterFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'resume',
  originalname: 'my-cv.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: Buffer.from('fake-pdf-content'),
  size: 1024,
  stream: new Readable(),
  destination: '',
  filename: '',
  path: '',
  ...overrides,
})

// ─── getProfile() ────────────────────────────────────────────────────────────

describe('getProfile()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should return profile when found', async () => {
    const profile = makeProfileRecord()
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(profile)

    const result = await getProfile(USER_ID)

    expect(result).toMatchObject({
      userId: USER_ID,
      roles: ['Frontend Engineer'],
      skills: ['React', 'TypeScript'],
    })
    // Must include user email
    expect((result as { user?: { email: string } }).user?.email).toBe('user@example.com')
  })

  it('should return default empty profile shape when profile is null', async () => {
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(null)

    const result = await getProfile(USER_ID)

    expect(result).toMatchObject({
      userId: USER_ID,
      roles: [],
      skills: [],
      location: null,
      remotePref: 'any',
      resumeUrl: null,
    })
  })

  it('should never return passwordHash in profile response', async () => {
    ;(mockPrisma.profile.findUnique as jest.Mock).mockResolvedValue(makeProfileRecord())

    const result = await getProfile(USER_ID)
    const resultObj = result as Record<string, unknown>

    expect(resultObj.passwordHash).toBeUndefined()
    // user should only have email (not passwordHash)
    const user = resultObj.user as Record<string, unknown> | undefined
    if (user) {
      expect(Object.keys(user)).toEqual(['email'])
    }
  })
})

// ─── updateProfile() ─────────────────────────────────────────────────────────

describe('updateProfile()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should call upsert with correct create and update data', async () => {
    const profile = makeProfileRecord()
    ;(mockPrisma.profile.upsert as jest.Mock).mockResolvedValue(profile)

    const input = { roles: ['Backend Engineer'], skills: ['Node.js', 'PostgreSQL'] }
    await updateProfile(USER_ID, input)

    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        create: expect.objectContaining({ userId: USER_ID, ...input }),
        update: expect.objectContaining(input),
      })
    )
  })

  it('should only include defined fields in update (not overwrite with undefined)', async () => {
    const profile = makeProfileRecord()
    ;(mockPrisma.profile.upsert as jest.Mock).mockResolvedValue(profile)

    // Only update roles — skills/location/remotePref are undefined
    await updateProfile(USER_ID, { roles: ['DevOps Engineer'] })

    const upsertCall = (mockPrisma.profile.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.update.roles).toEqual(['DevOps Engineer'])
    // undefined fields should NOT appear in the update object
    expect(upsertCall.update.skills).toBeUndefined()
    expect(upsertCall.update.location).toBeUndefined()
  })

  it('should return the updated profile with user email', async () => {
    const profile = makeProfileRecord({ roles: ['DevOps Engineer'] })
    ;(mockPrisma.profile.upsert as jest.Mock).mockResolvedValue(profile)

    const result = await updateProfile(USER_ID, { roles: ['DevOps Engineer'] })

    expect(result.roles).toEqual(['DevOps Engineer'])
    expect(result.user.email).toBe('user@example.com')
  })
})

// ─── uploadResume() ──────────────────────────────────────────────────────────

describe('uploadResume()', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should call uploadBuffer and upsert profile with the returned URL', async () => {
    const cloudinaryResult = {
      secure_url: 'https://res.cloudinary.com/demo/raw/authenticated/jobhunt/resumes/user_clx123',
      public_id: 'jobhunt/resumes/user_clx123',
    }
    mockUploadBuffer.mockResolvedValue(cloudinaryResult as never)
    ;(mockPrisma.profile.upsert as jest.Mock).mockResolvedValue(makeProfileRecord({
      resumeUrl: cloudinaryResult.secure_url,
    }))

    const file = makeMulterFile()
    const result = await uploadResume(USER_ID, file)

    expect(mockUploadBuffer).toHaveBeenCalledWith(
      file.buffer,
      expect.objectContaining({
        folder: 'jobhunt/resumes',
        public_id: USER_ID,
        resource_type: 'raw',
        access_mode: 'authenticated',
        overwrite: true,
      })
    )
    expect(mockPrisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { resumeUrl: cloudinaryResult.secure_url },
      })
    )
    expect(result).toEqual({ resumeUrl: cloudinaryResult.secure_url })
  })

  it('should throw AppError(500) when Cloudinary upload fails', async () => {
    mockUploadBuffer.mockRejectedValue(new Error('Cloudinary network error'))

    const file = makeMulterFile()

    await expect(uploadResume(USER_ID, file)).rejects.toThrow(
      new AppError('Resume upload failed', 500)
    )
  })

  it('should not call prisma upsert when Cloudinary fails', async () => {
    mockUploadBuffer.mockRejectedValue(new Error('Cloudinary network error'))

    const file = makeMulterFile()

    try {
      await uploadResume(USER_ID, file)
    } catch {
      // expected
    }

    expect(mockPrisma.profile.upsert).not.toHaveBeenCalled()
  })
})
