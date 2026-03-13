-- Add suggested_auth_status to cards_staging (AI-generated value, pre-populates review UI)
-- Add suggested_reply_to to cards_staging (for hard/extreme phishing cards)
-- Add reply_to to cards_real (persisted after reviewer approval)
-- Run in Supabase SQL editor. Safe to run once — uses IF NOT EXISTS pattern.

ALTER TABLE cards_staging
  ADD COLUMN IF NOT EXISTS suggested_auth_status TEXT CHECK (suggested_auth_status IN ('verified', 'unverified', 'fail')),
  ADD COLUMN IF NOT EXISTS suggested_reply_to TEXT;

ALTER TABLE cards_real
  ADD COLUMN IF NOT EXISTS reply_to TEXT;
