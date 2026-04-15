/**
 * Integration Types (src/integrations/types.ts)
 *
 * Defines the contract that every job adapter must follow.
 *
 * WHY A SHARED INTERFACE?
 * We have 11 adapters (7 APIs + 4 scrapers). Each one fetches data differently —
 * Greenhouse uses a REST API, WeWorkRemotely uses RSS feeds, Jobberman needs HTML scraping — but they all produce the same output shape (RawJob). This means the normalizer and cron jobs can treat all adapters identically, with no special casing per source.
 *
 * Think of it like a power adapter: different countries (sources), same plug shape (RawJob).
 *
 * FLOW:
 *   External Source (API/RSS/HTML)
 *     ↓ adapter.fetch()
 *   RawJob[]  (raw, as-is from source)
 *     ↓ normalizer.normalize()
 *   NormalizedJob[]  (clean, ready for DB)
 *     ↓ batchUpsert()
 *   PostgreSQL jobs table
 */

/**
 * The raw job shape produced by every adapter.
 * Adapters must normalize source-specific field names into this shape.
 */
export interface RawJob {
  /** Job title exactly as the source shows it */
  title: string

  /** Company name exactly as the source shows it */
  company: string

  /** Location string, or null if not specified (e.g. "Lagos, Nigeria", "Remote") */
  location: string | null

  /** Whether the job is explicitly marked as remote by the source */
  remote: boolean

  /**
   * Plain text description. If the source returns HTML, the adapter MUST strip
   * it using stripHtml() before putting it here. The normalizer expects plain text.
   */
  description: string

  /**
   * The URL the user will click to apply for this job.
   * Must always be the ORIGINAL source URL — never our own domain.
   * This is what powers the "Apply" button on the frontend.
   */
  applyUrl: string

  /**
   * The listing page URL if different from applyUrl.
   * Example: on Jobberman, the listing page is jobberman.com/jobs/slug and the apply URL redirects to the company's own website.
   * We store both so users can always view the original listing.
   */
  sourceUrl?: string

  /** When this job was posted on the source platform */
  postedAt: Date

  /**
   * Which source platform this came from.
   * This becomes the "source" field in the DB and appears as a badge on the frontend.
   * Add new sources here as we add new adapters.
   */
  source:
    | 'greenhouse'
    | 'lever'
    | 'remotive'
    | 'arbeitnow'
    | 'jobicy'
    | 'themuse'
    | 'weworkremotely'
    | 'jobberman'
    | 'myjobmag'
    | 'hotnigerianjobs'
    | 'ngcareers'

  /**
   * The source platform's own internal job ID.
   * Stored so we can do delta fetches in the future:
   * "only fetch jobs with ID > last_seen_id" instead of re-fetching everything.
   * Not required for current implementation — deduplication uses jobHash.
   */
  externalId?: string

  /** Company logo URL if the source provides one — used in the UI */
  logoUrl?: string

  /**
   * Salary range as a human-readable string if available.
   * e.g. "$80,000 - $120,000" or "£50k–£70k per annum"
   * We store it as-is because formats vary wildly between sources.
   */
  salaryRange?: string
}

/**
 * Every adapter (API adapter and scraper) must implement this interface.
 *
 * CONTRACT FOR fetch():
 *   - MUST NEVER THROW — catch all errors internally and return []
 *   - MUST log console.warn() if something goes wrong (for debugging)
 *   - MUST return [] if it finds zero jobs (not throw)
 *   - Should be polite: sleep between requests if looping over multiple pages/companies
 *
 * WHY "NEVER THROW"?
 * The cron job runs all adapters in sequence or parallel. If one adapter throws
 * an uncaught error, it could kill the entire ingestion run. By returning [], a broken adapter is just ignored and the others continue normally.
 */
export interface JobAdapter {
  /** Identifier matching the source field in RawJob */
  source: string

  /**
   * Fetches jobs from the external source, normalizes raw data into RawJob shape, and returns the array. Returns [] on any error — never throws.
   */
  fetch(): Promise<RawJob[]>
}
