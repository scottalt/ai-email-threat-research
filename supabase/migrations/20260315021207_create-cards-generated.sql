-- cards_generated: freeplay, daily, and expert card pools.
-- Separate from cards_real (research) — never mixed.

CREATE TABLE cards_generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT UNIQUE NOT NULL,
  pool TEXT NOT NULL CHECK (pool IN ('freeplay', 'expert')),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  is_phishing BOOLEAN NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  clues TEXT[],
  explanation TEXT,
  highlights TEXT[],
  technique TEXT,
  auth_status TEXT CHECK (auth_status IN ('verified', 'unverified', 'fail')),
  reply_to TEXT,
  attachment_name TEXT,
  sent_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_generated_pool ON cards_generated(pool);
CREATE INDEX idx_cards_generated_phishing ON cards_generated(pool, is_phishing);

-- RLS: block anon/authenticated access, service_role bypasses automatically
ALTER TABLE cards_generated ENABLE ROW LEVEL SECURITY;
