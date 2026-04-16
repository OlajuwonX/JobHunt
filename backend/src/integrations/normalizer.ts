/**
 * Job Normalizer (src/integrations/normalizer.ts)
 *
 * Converts a RawJob (straight from an API or scraper) into a NormalizedJob
 * ready for the database. Every adapter funnels through here so the DB always
 * gets consistent, deduplicated data regardless of the source.
 *
 * DEDUPLICATION STRATEGY — TWO LAYERS:
 *
 *   Layer 1 — EXACT hash (jobHash)
 *     SHA-256 of (raw title | raw company | raw location), all lowercased.
 *     Catches: identical postings from two different sources.
 *     Stored as @unique in DB. Checked via upsert.
 *
 *   Layer 2 — FUZZY hash (fuzzyHash)
 *     SHA-256 of (canonical title | canonical company | canonical location).
 *     Catches: same role posted under slightly different wording:
 *       "Frontend Engineer"  vs  "Frontend Developer"     (engineer = developer)
 *       "Junior Developer"   vs  "Jr. Developer"          (jr -> junior)
 *       "Sr. Engineer"       vs  "Senior Engineer"        (sr -> senior)
 *       "Jnr Developer"      vs  "Junior Engineer"        (jnr -> junior + developer -> engineer)
 *       "Stripe Inc."        vs  "Stripe"                 (Inc. stripped)
 *       "Remote, US"         vs  "Remote"                 (remote normalized)
 *     NOT @unique in DB — uniqueness enforced in batchUpsert() via pre-check query.
 *     This prevents users from seeing duplicate "Apply at Stripe" cards and
 *     accidentally applying twice to the same role.
 */

import { createHash } from 'crypto'
import { RawJob } from './types'
import { NormalizedJob } from '../types'

// ─── Tech & Business Skill Keywords ──────────────────────────────────────────
// Scanned against job descriptions to populate the techStack[] column.
// Broad on purpose — covers engineering, design, finance, marketing, and ops.
const TECH_KEYWORDS: string[] = [
  // Languages
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
  // Frontend
  'Next.js',
  'React',
  'Vue',
  'Angular',
  'Svelte',
  'Nuxt',
  // Backend
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
  // APIs & protocols
  'GraphQL',
  'REST',
  'gRPC',
  'WebSocket',
  // Design
  'Figma',
  'Sketch',
  'Adobe XD',
  'Illustrator',
  'Photoshop',
  // Data & analytics
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
  // Business & CRM
  'Salesforce',
  'HubSpot',
  'SAP',
  'QuickBooks',
  'Xero',
  'Jira',
  'Confluence',
  'Asana',
  'Notion',
  // Marketing
  'SEO',
  'Google Analytics',
  'Facebook Ads',
  'Google Ads',
  'Mailchimp',
  'Marketo',
  'Klaviyo',
]

// ─── Remote Detection Keywords ────────────────────────────────────────────────
// Fallback when the source does not explicitly mark a job as remote.
const REMOTE_KEYWORDS = ['remote', 'work from home', 'wfh', 'fully distributed', 'fully remote']

// ─── Requirement Line Pattern ─────────────────────────────────────────────────
// Matches lines that start with a bullet character or numbered list item.
const REQUIREMENT_LINE_REGEX = /^[\s]*(•|-|\*|►|\d+\.)\s+/

// ─────────────────────────────────────────────────────────────────────────────
// FUZZY CANONICALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seniority abbreviation map — applied word-by-word.
 *
 * WHY WORD-BY-WORD?
 * Splitting on whitespace and doing a dictionary lookup prevents "sr" from
 * accidentally matching inside words like "user" or "server".
 *
 * All three abbreviation styles appear on real Nigerian job boards:
 *   Jobberman uses "Jr", MyJobMag uses "Jnr", HotNigerianJobs uses "Junior"
 */
const SENIORITY_ABBR: Record<string, string> = {
  jr: 'junior',
  'jr.': 'junior',
  jnr: 'junior',
  'jnr.': 'junior',
  sr: 'senior',
  'sr.': 'senior',
  snr: 'senior',
  'snr.': 'senior',
  'mid-level': 'mid',
  'entry-level': 'junior',
}

/**
 * Title synonym normalization — regex substitutions on the full lowercased string.
 * Applied BEFORE seniority expansion so compound words are handled correctly.
 *
 * WHY developer -> engineer?
 * "Frontend Engineer" and "Frontend Developer" are the same role, just
 * named differently by different companies. We pick one canonical form
 * ("engineer") so both produce the same fuzzyHash and only one is stored.
 *
 * WHY front-end -> frontend (before the synonym)?
 * "front-end developer" must become "frontend engineer", not "front engineer".
 * The compound normalization runs first, then the synonym swaps.
 */
const TITLE_SYNONYMS: [RegExp, string][] = [
  // Compound word normalization (run first — order matters)
  [/\bfront[\s-]end\b/g, 'frontend'],
  [/\bback[\s-]end\b/g, 'backend'],
  [/\bfull[\s-]stack\b/g, 'fullstack'],
  [/\bdev[\s-]ops\b/g, 'devops'],
  [/\bmachine[\s-]learning\b/g, 'ml'],
  [/\bartificial[\s-]intelligence\b/g, 'ai'],
  // Role synonym normalization (run after compound normalization)
  [/\bdeveloper\b/g, 'engineer'],
  [/\bprogrammer\b/g, 'engineer'],
  [/\bcoder\b/g, 'engineer'],
  [/\bsoftware engineer\b/g, 'engineer'],
  [/\bswe\b/g, 'engineer'],
  [/\bengineering\b/g, 'engineer'],
]

/**
 * Noise patterns stripped from job titles before fuzzy hashing.
 *
 * Real examples from Nigerian and global job boards:
 *   "Frontend Engineer (Remote)"       -> "Frontend Engineer"
 *   "Backend Developer - Lagos"        -> "Backend Developer"
 *   "Sales Manager (Urgent)"           -> "Sales Manager"
 *   "Software Engineer II"             -> "Software Engineer"
 *   "Marketing Manager (Immediate)"    -> "Marketing Manager"
 */
const TITLE_NOISE_PATTERNS: RegExp[] = [
  /\(remote\)/gi,
  /\(hybrid\)/gi,
  /\(on[\s-]?site\)/gi,
  /\(contract\)/gi,
  /\(full[\s-]?time\)/gi,
  /\(part[\s-]?time\)/gi,
  /\(urgent\)/gi,
  /\(immediate(ly)?\)/gi,
  /\(new\)/gi,
  /[-\u2013\u2014]\s*(remote|hybrid|lagos|abuja|nigeria|port harcourt|ibadan)/gi,
  /,?\s*(nigeria|lagos|abuja|remote)$/gi,
  /\s+i{1,3}$/gi, // Roman numerals at end: I, II, III
  /\s+[12]$/gi, // Trailing version numbers: "Role 1"
  /\(.*?\)/g, // Any remaining parenthetical content
]

/**
 * Legal entity suffixes and noise words stripped from company names.
 *
 * Real examples:
 *   "Stripe Inc."            -> "stripe"
 *   "Paystack Limited"       -> "paystack"
 *   "Andela Technologies"    -> "andela"
 *   "Interswitch Group"      -> "interswitch"
 *   "Flutterwave Nigeria"    -> "flutterwave"
 */
const COMPANY_NOISE_PATTERNS: RegExp[] = [
  /\binc\.?\b/gi,
  /\bltd\.?\b/gi,
  /\bllc\.?\b/gi,
  /\blimited\b/gi,
  /\bplc\.?\b/gi,
  /\bcorp\.?\b/gi,
  /\bcorporation\b/gi,
  /\bgroup\b/gi,
  /\bholdings?\b/gi,
  /\btechnolog(?:y|ies)\b/gi,
  /\btech\b/gi,
  /\bsolutions?\b/gi,
  /\bservices?\b/gi,
  /\bnigeria\b/gi,
  /\bng\b/gi,
  /[.,&+]/g,
]

/**
 * canonicalizeTitle()
 *
 * Normalizes a job title into a canonical form for fuzzy hashing.
 *
 * Pipeline (order matters):
 *   1. Lowercase
 *   2. Strip noise (parentheticals, location suffixes, Roman numerals)
 *   3. Synonym normalization (front-end -> frontend, developer -> engineer)
 *   4. Seniority abbreviation expansion word-by-word (jr -> junior, sr -> senior)
 *   5. Collapse whitespace
 *
 * Examples:
 *   "Sr. Frontend Developer (Remote) - Lagos"  =>  "senior frontend engineer"
 *   "Jnr. Back-End Engineer II"                =>  "junior backend engineer"
 *   "Junior Software Developer"                =>  "junior engineer"
 *   "Front End Developer"                      =>  "frontend engineer"
 */
export function canonicalizeTitle(title: string): string {
  let t = title.toLowerCase()

  for (const pattern of TITLE_NOISE_PATTERNS) {
    t = t.replace(pattern, ' ')
  }

  for (const [pattern, replacement] of TITLE_SYNONYMS) {
    t = t.replace(pattern, replacement)
  }

  // Word-by-word seniority expansion — safer than regex for abbreviations
  t = t
    .split(/\s+/)
    .map((word) => SENIORITY_ABBR[word] ?? word)
    .join(' ')

  return t.replace(/\s+/g, ' ').trim()
}

/**
 * canonicalizeCompany()
 *
 * Strips legal suffixes so equivalent company names produce the same hash.
 *   "Stripe Inc." = "Stripe" = "Stripe Limited"
 *   "Andela Technologies" = "Andela"
 */
export function canonicalizeCompany(company: string): string {
  let c = company.toLowerCase()
  c = c.replace(/\s*&\s*/g, ' and ')
  for (const pattern of COMPANY_NOISE_PATTERNS) {
    c = c.replace(pattern, ' ')
  }
  return c.replace(/\s+/g, ' ').trim()
}

/**
 * canonicalizeLocation()
 *
 * Normalizes location for fuzzy hashing.
 *
 * WHY SPECIAL HANDLING?
 * The same job appears with different location strings across sources:
 *   "Remote, US"     (Greenhouse)
 *   "Remote"         (Remotive)
 *   "Worldwide"      (WeWorkRemotely)
 *   "Lagos, Nigeria" (Jobberman)
 *   "Lagos"          (MyJobMag)
 *
 * For remote jobs: all variants collapse to "remote" — location is irrelevant.
 * For onsite jobs: use only the city (before first comma) so "Lagos, Nigeria"
 *   and "Lagos, NG" both become "lagos".
 */
export function canonicalizeLocation(location: string | null, remote: boolean): string {
  if (remote) return 'remote'
  if (location) {
    const loc = location.toLowerCase()
    if (REMOTE_KEYWORDS.some((kw) => loc.includes(kw))) return 'remote'
  }
  if (!location) return ''
  return location.split(',')[0].toLowerCase().trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// HASH GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EXACT dedup hash.
 * SHA-256 of raw (title | company | location), all lowercased.
 * Catches identical listings from two different sources.
 * Stored as @unique in DB — checked via Prisma upsert.
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
 * FUZZY dedup hash.
 * SHA-256 of (canonical title | canonical company | canonical location).
 * Catches same-role variants that exact hashing misses.
 *
 * NOT stored as @unique — uniqueness enforced in batchUpsert() via pre-check,
 * allowing graceful handling of the rare false-positive collision case.
 *
 * Real-world example this catches:
 *   Greenhouse: { title: "Frontend Engineer",  company: "Stripe",     location: "Remote, US" }
 *   Lever:      { title: "Frontend Developer", company: "Stripe Inc.", location: "Remote"    }
 *
 *   Both canonicalize to:  "frontend engineer|stripe|remote"
 *   => identical fuzzyHash => Lever job is skipped in batchUpsert
 *   => user never sees duplicate "Apply at Stripe Frontend" cards
 */
function generateFuzzyHash(
  title: string,
  company: string,
  location: string | null,
  remote: boolean
): string {
  const canonical = [
    canonicalizeTitle(title),
    canonicalizeCompany(company),
    canonicalizeLocation(location, remote),
  ].join('|')
  return createHash('sha256').update(canonical).digest('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTION PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

function extractTechStack(description: string): string[] {
  const descLower = description.toLowerCase()
  const found = new Set<string>()
  for (const keyword of TECH_KEYWORDS) {
    if (descLower.includes(keyword.toLowerCase())) {
      found.add(keyword) // preserve original casing: "PostgreSQL" not "postgresql"
    }
  }
  return Array.from(found)
}

function extractRequirements(description: string): string[] {
  const requirements: string[] = []
  for (const line of description.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (REQUIREMENT_LINE_REGEX.test(trimmed)) {
      const cleaned = trimmed.replace(REQUIREMENT_LINE_REGEX, '').trim()
      if (cleaned.length > 5) requirements.push(cleaned)
    }
    if (requirements.length >= 12) break
  }
  return requirements
}

function detectRemote(title: string, location: string | null): boolean {
  const combined = `${title} ${location ?? ''}`.toLowerCase()
  return REMOTE_KEYWORDS.some((kw) => combined.includes(kw))
}

function cleanDescription(description: string): string {
  return description
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 12_000)
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CATEGORY_KEYWORDS maps each job category to a list of keyword signals.
 *
 * WHY KEYWORDS INSTEAD OF A CLASSIFIER MODEL?
 * A keyword scan over title+description is deterministic, fast, and requires
 * zero external calls. It covers the most common role families without adding
 * model latency or cost to the ingestion pipeline.
 *
 * HOW MATCHING WORKS:
 * We concatenate title + description (lowercased) then scan for any keyword
 * in each category's list. The FIRST category whose keyword appears wins.
 * Order of CATEGORY_KEYWORDS entries matters — 'tech' is checked first because
 * it is the most common category and the most likely false-positive target.
 *
 * NOTE: 'it ' (with trailing space) distinguishes "IT Manager" from "audit".
 * 'ui ' (with trailing space) distinguishes "UI Developer" from "fruit".
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  tech: [
    'engineer',
    'developer',
    'software',
    'frontend',
    'backend',
    'devops',
    'data scientist',
    'machine learning',
    'cloud',
    'mobile',
    'fullstack',
    'it ',
  ],
  finance: [
    'finance',
    'financial',
    'bank',
    'accountant',
    'accounting',
    'audit',
    'treasury',
    'investment',
    'insurance',
    'actuary',
    'tax',
  ],
  sales: ['sales', 'business development', 'account executive', 'growth', 'revenue'],
  marketing: ['marketing', 'seo', 'social media', 'brand', 'content', 'digital marketing'],
  healthcare: ['nurse', 'doctor', 'clinical', 'hospital', 'pharmacist', 'medical'],
  design: ['designer', 'design', 'ux', 'ui ', 'creative', 'figma', 'product design'],
  operations: ['operations', 'ops', 'logistics', 'supply chain', 'procurement', 'admin'],
  hr: ['human resources', 'hr ', 'recruitment', 'talent acquisition'],
  legal: ['legal', 'lawyer', 'attorney', 'counsel', 'compliance'],
  education: ['teacher', 'tutor', 'education', 'instructor', 'trainer'],
}

/**
 * detectCategory(title, description)
 *
 * Scans the combined title + description text for known category keywords.
 * Returns the first matching category, or 'other' if no keywords match.
 *
 * Why combine title AND description?
 * Title alone can be ambiguous: "Manager" could be marketing, sales, or ops.
 * Adding description context (e.g. "...managing paid marketing campaigns...")
 * disambiguates and catches categories missed by a short title.
 *
 * Examples:
 *   title: "React Engineer"         → category: 'tech'  (via 'engineer')
 *   title: "Senior Accountant"      → category: 'finance' (via 'accountant')
 *   title: "Head of Growth"         → category: 'sales'  (via 'growth')
 *   title: "Brand Strategist"       → category: 'marketing' (via 'brand')
 *   title: "Program Coordinator"    → category: 'other'  (no match)
 */
function detectCategory(title: string, description: string): string {
  // Combine both fields so description context improves title-only ambiguities
  const text = `${title} ${description}`.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return cat
  }
  return 'other'
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nigerian job board sources — jobs from these platforms are always Nigerian-market,
 * regardless of what their location field says (sometimes it's missing or "Nigeria").
 * When a source is in this list we skip the location regex and classify immediately.
 */
const NIGERIAN_SOURCES = ['jobberman', 'myjobmag', 'hotnigerianjobs', 'ngcareers']

/**
 * detectCountry(location, source)
 *
 * Classifies a job as 'nigeria' or 'global' using two signals:
 *   1. Source name — Nigerian job boards always produce Nigerian listings.
 *   2. Location text — checks for major Nigerian cities and the country name.
 *
 * WHY LOWERCASE ONLY?
 * The country column is queried as: WHERE country = 'nigeria'.
 * If values were mixed case ("Nigeria" vs "nigeria") those queries would fail
 * silently or require .toLowerCase() at query time. Storing lowercase once
 * eliminates that class of bug permanently.
 *
 * Examples:
 *   source: 'jobberman'               → 'nigeria'  (known Nigerian source)
 *   location: 'Lagos, Nigeria'        → 'nigeria'  (Nigerian city in location)
 *   location: 'Remote, US'            → 'global'
 *   source: 'greenhouse', loc: null   → 'global'
 */
function detectCountry(location: string | null, source: string): string {
  // Source-based detection is the most reliable signal — no false positives
  if (NIGERIAN_SOURCES.includes(source)) return 'nigeria'
  // Location-based detection — covers cases where a global source posts a Nigerian role
  if (location && /lagos|abuja|nigeria|port harcourt|ibadan/i.test(location)) return 'nigeria'
  return 'global'
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalize(raw)
 *
 * Converts a RawJob from any adapter into a NormalizedJob ready for DB upsert.
 *
 * The two hashes together ensure:
 *   - Identical jobs from two sources     -> stored once (exact hash catches this)
 *   - Same role, different title wording  -> stored once (fuzzy hash catches this)
 *   - Genuinely different roles           -> stored separately (different fuzzy hashes)
 */
export function normalize(raw: RawJob): NormalizedJob {
  const description = cleanDescription(raw.description)
  const location = raw.location?.trim() || null
  const remote = raw.remote || detectRemote(raw.title, location)

  return {
    jobHash: generateJobHash(raw.title, raw.company, location),
    fuzzyHash: generateFuzzyHash(raw.title, raw.company, location, remote),
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
    // ── Intelligence fields (B16) ────────────────────────────────────────────
    // Both are detected once at normalization time and stored on the job row.
    // This avoids re-computing them on every query — we classify once, query fast.
    category: detectCategory(raw.title, description),
    country: detectCountry(location, raw.source),
  }
}
