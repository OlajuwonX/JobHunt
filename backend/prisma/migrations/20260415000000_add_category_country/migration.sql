-- Migration: add_category_country
-- Adds category and country classification fields to the jobs table.
-- Both are detected during normalization from title, description, location, and source.
-- category: groups jobs by role domain (tech, finance, sales, marketing, etc.)
-- country: marks Nigerian-market jobs vs global jobs for location-aware filtering.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "country"  TEXT NOT NULL DEFAULT 'global';

CREATE INDEX IF NOT EXISTS "jobs_category_idx" ON "jobs"("category");
CREATE INDEX IF NOT EXISTS "jobs_country_idx"  ON "jobs"("country");
