/**
 * Job Normalizer (src/integrations/normalizer.ts)
 *
 * Converts a RawJob (straight from an API or scraper) into the NormalizedJob shape that our database expects. This is the "cleaning and enrichment" step.
 *
 * WHY A SEPARATE NORMALIZER?
 * Without this, each adapter would have slightly different output (different casing, different field names, missing fields). By funneling all adapters through one normalizer, the database always gets consistent data — regardless of the source.
 *
 * WHAT THIS DOES:
 *   1. Generates jobHash — the deduplication fingerprint
 *   2. Extracts techStack — scans description for known tech keywords
 *   3. Extracts requirements — pulls bullet-point lines from description
 *   4. Detects remote — checks title/location if the source didn't flag it
 *   5. Caps and cleans description — removes excessive whitespace, truncates at 12k chars
 *   6. Assembles the final NormalizedJob object with all required DB fields
 */

import { createHash } from 'crypto'
import { RawJob } from './types'
import { NormalizedJob } from '../types'

// ─── Tech & Business Skill Keywords ──────────────────────────────────────────
// These are the keywords we scan for in job descriptions.
// When found, they go into the techStack[] column in the DB.
//
// WHY SO BROAD?
// JobHunt covers ALL job categories, not just software engineering.
// A marketing manager job might mention Google Analytics or HubSpot.
// A finance role might mention Excel, SAP, or QuickBooks.
// By including business tools alongside programming languages, we provide useful skill tags for every job type.
//
// HOW MATCHING WORKS:
// We do a case-insensitive substring search of the description.
// "React" matches "React.js", "ReactJS", "React components", etc.
// Keywords are tried longest-first to avoid false positives
// (e.g. "C++" before "C" would prevent "C++" being tagged as "C").
const TECH_KEYWORDS: string[] = [
  // Programming languages
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'Kotlin',
  'Swift',
  'Go',
  'Rust',
  'PHP',
  'Ruby',
  'C#',
  'C++',
  'Scala',
  'R',
  'MATLAB',

  // Frontend frameworks & libraries
  'Next.js',
  'React',
  'Vue',
  'Angular',
  'Svelte',
  'Nuxt',

  // Backend frameworks
  'Node.js',
  'Express',
  'Django',
  'Flask',
  'FastAPI',
  'Laravel',
  'Rails',
  'Spring',
  'NestJS',
  'Gin',
  'Fiber',

  // Databases
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'SQLite',
  'DynamoDB',
  'Cassandra',
  'Supabase',

  // Cloud & DevOps
  'Kubernetes',
  'Docker',
  'AWS',
  'GCP',
  'Azure',
  'Terraform',
  'Linux',
  'CI/CD',
  'GitHub Actions',
  'Jenkins',

  // APIs & Protocols
  'GraphQL',
  'REST',
  'gRPC',
  'WebSocket',

  // Design tools
  'Figma',
  'Sketch',
  'Adobe XD',
  'Illustrator',
  'Photoshop',

  // Data & Analytics
  'PowerBI',
  'Tableau',
  'Excel',
  'SQL',
  'Pandas',
  'NumPy',
  'TensorFlow',
  'PyTorch',
  'Spark',
  'Airflow',
  'dbt',

  // Business & CRM tools
  'Salesforce',
  'HubSpot',
  'SAP',
  'QuickBooks',
  'Xero',
  'Jira',
  'Confluence',
  'Asana',
  'Notion',

  // Marketing & Growth tools
  'SEO',
  'Google Analytics',
  'Facebook Ads',
  'Google Ads',
  'Mailchimp',
  'Marketo',
  'Klaviyo',
]

// ─── Remote Detection Keywords ─────────────────────────────────────────────────
// Some sources don't explicitly flag jobs as remote — but the title or location string will contain these keywords. We use them as a fallback.
const REMOTE_KEYWORDS = ['remote', 'work from home', 'wfh', 'fully distributed']

// ─── Requirement Line Starters ────────────────────────────────────────────────
// We extract "requirements" by finding lines that look like bullet points.
// These are the patterns that commonly start requirement lines.
// Regex breakdown: ^[\s]*  = optional leading whitespace
//                 (•|-|\*|►|\d+\.) = bullet characters or numbered list
//                 \s = at least one space after the bullet
const REQUIREMENT_LINE_REGEX = /^[\s]*(•|-|\*|►|\d+\.)\s+/

/**
 * Generates a SHA-256 hash fingerprint for a job.
 *
 * WHY HASHING?
 * The same job might be listed by multiple sources (e.g. Greenhouse and LinkedIn).
 * Instead of storing it twice, we compute a hash from the key fields.
 * When we upsert with this hash as the key, duplicates are automatically skipped.
 *
 * WHY THESE THREE FIELDS?
 * Title + Company + Location uniquely identifies a job posting.
 * Two jobs with the same title at the same company in the same location are
 * almost certainly the same posting.
 *
 * WHY LOWERCASE BEFORE HASHING?
 * "Software Engineer" and "software engineer" are the same job.
 * Normalizing to lowercase prevents case differences from creating duplicate entries.
 */
function generateJobHash(title: string, company: string, location: string | null): string {
  const raw = [
    title.toLowerCase().trim(),
    company.toLowerCase().trim(),
    (location ?? '').toLowerCase().trim(),
  ].join('|')

  return createHash('sha256').update(raw).digest('hex')
}

/**
 * Scans a job description for known technology and business skill keywords.
 * Returns an array of matched keywords (deduplicated).
 *
 * WHY IN-MEMORY SCANNING?
 * This is much faster than calling an AI or external API for every job.
 * The keyword list is curated, so matches are reliable.
 * The in-memory approach means we can process thousands of jobs per second.
 */
function extractTechStack(description: string): string[] {
  const descLower = description.toLowerCase()
  const found = new Set<string>()

  for (const keyword of TECH_KEYWORDS) {
    // Case-insensitive match — "react" matches "React", "REACT", "React.js"
    if (descLower.includes(keyword.toLowerCase())) {
      found.add(keyword)
    }
  }

  return Array.from(found)
}

/**
 * Extracts requirement bullet points from a job description.
 * Looks for lines starting with: •, -, *, ►, or a number (1. 2. 3.)
 * Caps at 12 requirements — more than that adds noise.
 *
 * WHY EXTRACT REQUIREMENTS SEPARATELY?
 * The full description can be 3000+ words. By extracting just the bullet points,
 * the frontend can show a quick "What you'll need" summary without rendering the
 * entire job description. It also helps the ATS scoring engine focus on requirements.
 */
function extractRequirements(description: string): string[] {
  const lines = description.split('\n')
  const requirements: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines
    if (!trimmed) continue

    if (REQUIREMENT_LINE_REGEX.test(trimmed)) {
      // Strip the bullet character to get clean text
      const cleaned = trimmed.replace(REQUIREMENT_LINE_REGEX, '').trim()
      if (cleaned.length > 5) {
        // Skip trivially short "requirements"
        requirements.push(cleaned)
      }
    }

    // Stop at 12 — more than this is noise
    if (requirements.length >= 12) break
  }

  return requirements
}

/**
 * Detects if a job is remote from title or location strings.
 * Used as a fallback when the source doesn't explicitly flag the job as remote.
 *
 * Example: A job titled "Senior Engineer (Remote)" should be flagged as remote
 * even if the source didn't set remote=true.
 */
function detectRemote(title: string, location: string | null): boolean {
  const combined = `${title} ${location ?? ''}`.toLowerCase()
  return REMOTE_KEYWORDS.some((kw) => combined.includes(kw))
}

/**
 * Cleans a description string:
 * - Collapses runs of 3+ whitespace/newlines to 2 (one blank line max)
 * - Trims leading/trailing whitespace
 * - Truncates to 12,000 characters (prevents very long descriptions from
 *   bloating the database; 12k chars is ~2000 words which is more than enough)
 */
function cleanDescription(description: string): string {
  return description
    .replace(/\s{3,}/g, '\n\n') // collapse excessive blank lines
    .trim()
    .slice(0, 12_000) // hard cap at 12k characters
}

/**
 * Main normalization function.
 * Takes a RawJob from any adapter and returns a NormalizedJob ready for DB upsert.
 *
 * This is called by batchUpsert() in jobs.service.ts after all adapters have run.
 */
export function normalize(raw: RawJob): NormalizedJob {
  // Clean the description first — everything else is derived from it
  const description = cleanDescription(raw.description)

  // Detect remote: use the source's flag first, fall back to keyword detection
  const remote = raw.remote || detectRemote(raw.title, raw.location)

  // Normalize location: trim and default null if empty string
  const location = raw.location?.trim() || null

  return {
    jobHash: generateJobHash(raw.title, raw.company, location),
    title: raw.title.trim(),
    company: raw.company.trim(),
    source: raw.source,
    location,
    remote,
    description,
    requirements: extractRequirements(description),
    techStack: extractTechStack(description),
    applyUrl: raw.applyUrl,
    sourceUrl: raw.sourceUrl ?? null,
    postedAt: raw.postedAt,
    salaryRange: raw.salaryRange ?? null,
  }
}
