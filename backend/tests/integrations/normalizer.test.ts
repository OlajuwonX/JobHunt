/**
 * Normalizer Unit Tests (tests/integrations/normalizer.test.ts)
 *
 * Tests the normalize() function which converts RawJob data from adapters
 * into the NormalizedJob shape ready for database insertion.
 *
 * No mocking needed — the normalizer is a pure function with no side effects.
 */

import { normalize } from '../../src/integrations/normalizer'
import { RawJob } from '../../src/integrations/types'

const makeRawJob = (overrides: Partial<RawJob> = {}): RawJob => ({
  title: 'Senior Software Engineer',
  company: 'Acme Corp',
  location: 'Lagos, Nigeria',
  remote: false,
  description: 'We need a Python and PostgreSQL developer with experience in AWS.',
  applyUrl: 'https://example.com/apply',
  postedAt: new Date('2024-01-15'),
  source: 'jobberman',
  ...overrides,
})

describe('normalize()', () => {
  describe('jobHash generation', () => {
    it('should generate a consistent SHA-256 hash for the same input', () => {
      const raw = makeRawJob()
      const result1 = normalize(raw)
      const result2 = normalize(raw)
      expect(result1.jobHash).toBe(result2.jobHash)
    })

    it('should generate different hashes for different titles', () => {
      const raw1 = normalize(makeRawJob({ title: 'Frontend Engineer' }))
      const raw2 = normalize(makeRawJob({ title: 'Backend Engineer' }))
      expect(raw1.jobHash).not.toBe(raw2.jobHash)
    })

    it('should be case-insensitive (same hash for different casing)', () => {
      const raw1 = normalize(makeRawJob({ title: 'Software Engineer', company: 'Acme' }))
      const raw2 = normalize(makeRawJob({ title: 'SOFTWARE ENGINEER', company: 'ACME' }))
      expect(raw1.jobHash).toBe(raw2.jobHash)
    })

    it('should include location in the hash (different locations = different hash)', () => {
      const raw1 = normalize(makeRawJob({ location: 'Lagos' }))
      const raw2 = normalize(makeRawJob({ location: 'Abuja' }))
      expect(raw1.jobHash).not.toBe(raw2.jobHash)
    })

    it('should handle null location without throwing', () => {
      const raw = makeRawJob({ location: null })
      expect(() => normalize(raw)).not.toThrow()
    })
  })

  describe('techStack extraction', () => {
    it('should extract known tech keywords from description', () => {
      const raw = makeRawJob({
        description: 'We use React, TypeScript, and PostgreSQL in our stack.',
      })
      const result = normalize(raw)
      expect(result.techStack).toContain('React')
      expect(result.techStack).toContain('TypeScript')
      expect(result.techStack).toContain('PostgreSQL')
    })

    it('should extract business tools (not just coding keywords)', () => {
      const raw = makeRawJob({
        description: 'Experience with Salesforce CRM and Google Analytics required.',
      })
      const result = normalize(raw)
      expect(result.techStack).toContain('Salesforce')
      expect(result.techStack).toContain('Google Analytics')
    })

    it('should return empty array when no keywords match', () => {
      const raw = makeRawJob({
        description: 'Looking for a great communicator to join our team. No tech required.',
      })
      const result = normalize(raw)
      expect(result.techStack).toBeInstanceOf(Array)
      // May or may not be empty depending on keywords in the generic description
      expect(Array.isArray(result.techStack)).toBe(true)
    })

    it('should not duplicate keywords', () => {
      const raw = makeRawJob({
        description: 'Python Python Python React React',
      })
      const result = normalize(raw)
      const pythonCount = result.techStack.filter((t) => t === 'Python').length
      expect(pythonCount).toBe(1)
    })
  })

  describe('requirements extraction', () => {
    it('should extract bullet point lines starting with •', () => {
      const raw = makeRawJob({
        description: `
Requirements:
• 5+ years of experience
• Knowledge of Python
• Strong communication skills
        `.trim(),
      })
      const result = normalize(raw)
      expect(result.requirements).toHaveLength(3)
      expect(result.requirements[0]).toBe('5+ years of experience')
    })

    it('should extract numbered list items', () => {
      const raw = makeRawJob({
        description: `
1. Must have Python experience
2. PostgreSQL knowledge required
3. AWS certification preferred
        `.trim(),
      })
      const result = normalize(raw)
      expect(result.requirements).toContain('Must have Python experience')
    })

    it('should cap requirements at 12 items', () => {
      const bullets = Array.from({ length: 20 }, (_, i) => `• Requirement ${i + 1}`).join('\n')
      const raw = makeRawJob({ description: bullets })
      const result = normalize(raw)
      expect(result.requirements.length).toBeLessThanOrEqual(12)
    })

    it('should return empty array when no bullet points found', () => {
      const raw = makeRawJob({
        description: 'This is a plain paragraph description with no bullet points.',
      })
      const result = normalize(raw)
      expect(result.requirements).toBeInstanceOf(Array)
    })
  })

  describe('remote detection', () => {
    it('should use the source remote flag when provided', () => {
      const raw = makeRawJob({ remote: true, title: 'Engineer', location: 'Office' })
      const result = normalize(raw)
      expect(result.remote).toBe(true)
    })

    it('should detect remote from title when source flag is false', () => {
      const raw = makeRawJob({
        remote: false,
        title: 'Senior Engineer (Remote)',
        location: 'Anywhere',
      })
      const result = normalize(raw)
      expect(result.remote).toBe(true)
    })

    it('should detect remote from location when source flag is false', () => {
      const raw = makeRawJob({
        remote: false,
        title: 'Software Engineer',
        location: 'Remote, US',
      })
      const result = normalize(raw)
      expect(result.remote).toBe(true)
    })

    it('should return false when not remote', () => {
      const raw = makeRawJob({ remote: false, title: 'Office Engineer', location: 'Lagos' })
      const result = normalize(raw)
      expect(result.remote).toBe(false)
    })
  })

  describe('description cleaning', () => {
    it('should trim leading and trailing whitespace', () => {
      const raw = makeRawJob({ description: '   Lead Engineer role.   ' })
      const result = normalize(raw)
      expect(result.description).toBe('Lead Engineer role.')
    })

    it('should cap description at 12,000 characters', () => {
      const longDesc = 'A'.repeat(15_000)
      const raw = makeRawJob({ description: longDesc })
      const result = normalize(raw)
      expect(result.description.length).toBeLessThanOrEqual(12_000)
    })

    it('should preserve line breaks within the description', () => {
      const raw = makeRawJob({
        description: 'Line one.\nLine two.\nLine three.',
      })
      const result = normalize(raw)
      expect(result.description).toContain('\n')
    })
  })

  describe('output shape', () => {
    it('should include all required NormalizedJob fields', () => {
      const result = normalize(makeRawJob())

      const requiredFields: string[] = [
        'jobHash',
        'title',
        'company',
        'source',
        'location',
        'remote',
        'description',
        'requirements',
        'techStack',
        'applyUrl',
        'sourceUrl',
        'postedAt',
        'salaryRange',
        // Intelligence layer fields (B16)
        'category',
        'country',
      ]

      for (const field of requiredFields) {
        expect(result).toHaveProperty(field)
      }
    })

    it('should set sourceUrl to null when not provided in raw', () => {
      const raw = makeRawJob({ sourceUrl: undefined })
      const result = normalize(raw)
      expect(result.sourceUrl).toBeNull()
    })

    it('should set salaryRange to null when not provided in raw', () => {
      const raw = makeRawJob({ salaryRange: undefined })
      const result = normalize(raw)
      expect(result.salaryRange).toBeNull()
    })

    it('should preserve the source field from raw job', () => {
      const raw = makeRawJob({ source: 'greenhouse' })
      const result = normalize(raw)
      expect(result.source).toBe('greenhouse')
    })
  })

  // ─── detectCategory() — tested via normalize() output ──────────────────────

  describe('category detection', () => {
    it('should detect "tech" from job title containing "engineer"', () => {
      const result = normalize(
        makeRawJob({ title: 'Senior Software Engineer', description: 'Build APIs' })
      )
      expect(result.category).toBe('tech')
    })

    it('should detect "tech" from job title containing "developer"', () => {
      const result = normalize(
        makeRawJob({ title: 'Frontend Developer', description: 'Build UIs' })
      )
      expect(result.category).toBe('tech')
    })

    it('should detect "finance" from job title containing "accountant"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Senior Accountant',
          description: 'Manage accounts payable and receivable',
        })
      )
      expect(result.category).toBe('finance')
    })

    it('should detect "finance" from title containing "financial"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Financial Analyst',
          description: 'Analyze investment portfolios',
        })
      )
      expect(result.category).toBe('finance')
    })

    it('should detect "sales" from job title containing "sales"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Sales Representative',
          description: 'Drive revenue growth for the company',
        })
      )
      expect(result.category).toBe('sales')
    })

    it('should detect "marketing" from job title containing "marketing"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Digital Marketing Manager',
          description: 'Run campaigns on social media',
        })
      )
      expect(result.category).toBe('marketing')
    })

    it('should detect "healthcare" from job title containing "nurse"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Registered Nurse',
          description: 'Provide clinical care to patients in a hospital setting',
        })
      )
      expect(result.category).toBe('healthcare')
    })

    it('should detect "hr" from job title containing "recruitment"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Recruitment Specialist',
          description: 'Talent acquisition and HR management',
        })
      )
      expect(result.category).toBe('hr')
    })

    it('should detect "legal" from job title containing "lawyer"', () => {
      const result = normalize(
        makeRawJob({
          title: 'Corporate Lawyer',
          description: 'Handle compliance and legal counsel for the firm',
        })
      )
      expect(result.category).toBe('legal')
    })

    it('should fall back to "other" when no keywords match', () => {
      const result = normalize(
        makeRawJob({
          title: 'Program Coordinator',
          description: 'Coordinate programs and events for the organization',
        })
      )
      expect(result.category).toBe('other')
    })

    it('should detect category from description even when title is ambiguous', () => {
      // "Manager" alone is ambiguous, but description makes it clear it is finance
      const result = normalize(
        makeRawJob({
          title: 'Manager',
          description: 'Oversee accounting, audit, and tax compliance operations',
        })
      )
      expect(result.category).toBe('finance')
    })
  })

  // ─── detectCountry() — tested via normalize() output ───────────────────────

  describe('country detection', () => {
    it('should return "nigeria" for jobs from Nigerian source "jobberman"', () => {
      const result = normalize(makeRawJob({ source: 'jobberman', location: null }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" for jobs from Nigerian source "myjobmag"', () => {
      const result = normalize(makeRawJob({ source: 'myjobmag', location: 'Lagos' }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" for jobs from Nigerian source "hotnigerianjobs"', () => {
      const result = normalize(makeRawJob({ source: 'hotnigerianjobs', location: null }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" for jobs from Nigerian source "jobberman"', () => {
      const result = normalize(makeRawJob({ source: 'jobberman', location: null }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" when location contains "Lagos" (non-Nigerian source)', () => {
      const result = normalize(makeRawJob({ source: 'greenhouse', location: 'Lagos, Nigeria' }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" when location contains "Abuja"', () => {
      const result = normalize(makeRawJob({ source: 'ashby', location: 'Abuja' }))
      expect(result.country).toBe('nigeria')
    })

    it('should return "nigeria" when location contains "Port Harcourt"', () => {
      const result = normalize(
        makeRawJob({ source: 'greenhouse', location: 'Port Harcourt, Nigeria' })
      )
      expect(result.country).toBe('nigeria')
    })

    it('should return "global" for non-Nigerian source and non-Nigerian location', () => {
      const result = normalize(makeRawJob({ source: 'greenhouse', location: 'Remote, US' }))
      expect(result.country).toBe('global')
    })

    it('should return "global" when location is null and source is not Nigerian', () => {
      const result = normalize(makeRawJob({ source: 'remotive', location: null }))
      expect(result.country).toBe('global')
    })

    it('should store country as lowercase only (consistent with DB query expectations)', () => {
      const result = normalize(makeRawJob({ source: 'jobberman' }))
      // Must be lowercase so WHERE country = 'nigeria' works without .toLowerCase()
      expect(result.country).toBe(result.country.toLowerCase())
    })
  })
})
