-- Migration: add_fuzzy_hash
-- Adds the fuzzyHash column and index to the jobs table.
--
-- PURPOSE:
--   Layer 2 of our two-layer deduplication strategy.
--   Layer 1 (jobHash) catches identical listings from two different sources.
--   Layer 2 (fuzzyHash) catches the same role posted with slightly different wording:
--     "Frontend Engineer" ≈ "Frontend Developer" (developer → engineer)
--     "Jr. Developer"     ≈ "Junior Developer"   (jr → junior)
--     "Stripe Inc."       ≈ "Stripe"             (Inc. stripped)
--
-- NOT @unique at DB level — uniqueness is enforced in the service layer (batchUpsert)
-- because fuzzyHash collisions are possible (false positives) and we want to handle
-- them gracefully rather than having the DB throw a constraint error.
--
-- Nullable so existing rows without a fuzzyHash don't break anything.

-- Add fuzzyHash column (nullable — existing rows will have NULL until re-indexed)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "fuzzyHash" TEXT;

-- Add index for fast fuzzyHash lookups during the batchUpsert pre-check query.
-- Without this index, every batch upsert would do a full table scan to find
-- existing fuzzy duplicates — catastrophic at scale.
CREATE INDEX IF NOT EXISTS "jobs_fuzzyHash_idx" ON "jobs"("fuzzyHash");
