-- Research signal columns: tool usage tracking + card-level signal metadata
-- Run in Supabase SQL editor. Safe to run once — uses IF NOT EXISTS pattern.

ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS headers_opened BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url_inspected  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auth_status    TEXT,
  ADD COLUMN IF NOT EXISTS has_reply_to   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_url        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN DEFAULT FALSE;

-- Indexes for common analytical queries
CREATE INDEX IF NOT EXISTS idx_answers_headers_opened ON answers (headers_opened);
CREATE INDEX IF NOT EXISTS idx_answers_url_inspected  ON answers (url_inspected);
CREATE INDEX IF NOT EXISTS idx_answers_auth_status    ON answers (auth_status);
