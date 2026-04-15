-- Migration: add_job_source_url_salary
-- Adds sourceUrl and salaryRange columns to the jobs table.
-- Also adds an index on the remote column for faster filtering,
-- and drops+recreates the postedAt index with DESC sort for newest-first queries.

-- Add sourceUrl column (nullable — not all sources provide a separate listing URL)
ALTER TABLE "jobs" ADD COLUMN "sourceUrl" TEXT;

-- Add salaryRange column (nullable — many job postings don't include salary)
ALTER TABLE "jobs" ADD COLUMN "salaryRange" TEXT;

-- Add index on remote column to speed up "show me only remote jobs" queries
CREATE INDEX "jobs_remote_idx" ON "jobs"("remote");

-- Drop the old ascending postedAt index and recreate as descending.
-- Why descending? When users browse the job feed, they want newest jobs first.
-- A DESC index means PostgreSQL reads the index in order — no extra sort step.
DROP INDEX IF EXISTS "jobs_postedAt_idx";
CREATE INDEX "jobs_postedAt_idx" ON "jobs"("postedAt" DESC);
