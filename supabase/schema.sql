-- ============================================================
-- Retro Phish — Research Platform Schema
-- Run this in the Supabase SQL editor to initialise the DB.
-- ============================================================

-- cards_staging: raw imported emails + AI preprocessing results
CREATE TABLE cards_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_email_hash TEXT UNIQUE NOT NULL,
  import_batch_id UUID,
  source_corpus TEXT NOT NULL,
  raw_from TEXT,
  raw_subject TEXT,
  raw_body TEXT NOT NULL,
  email_headers_json JSONB,
  received_date TIMESTAMPTZ,
  has_html BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count SMALLINT DEFAULT 0,
  attachment_types TEXT[],
  link_count SMALLINT DEFAULT 0,
  links_json JSONB,
  language_detected TEXT DEFAULT 'en',
  inferred_type TEXT NOT NULL CHECK (inferred_type IN ('email', 'sms')),
  is_phishing BOOLEAN,
  -- AI preprocessing outputs
  processed_from TEXT,
  processed_subject TEXT,
  processed_body TEXT,
  sanitized_body TEXT,
  suggested_technique TEXT,
  suggested_secondary_technique TEXT,
  suggested_difficulty TEXT CHECK (suggested_difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  suggested_highlights TEXT[],
  suggested_clues TEXT[],
  suggested_explanation TEXT,
  -- Linguistic quality scores 0-5
  grammar_quality SMALLINT CHECK (grammar_quality BETWEEN 0 AND 5),
  prose_fluency SMALLINT CHECK (prose_fluency BETWEEN 0 AND 5),
  personalization_level SMALLINT CHECK (personalization_level BETWEEN 0 AND 5),
  contextual_coherence SMALLINT CHECK (contextual_coherence BETWEEN 0 AND 5),
  -- GenAI classification
  genai_detector_score FLOAT CHECK (genai_detector_score BETWEEN 0 AND 1),
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  genai_ai_assessment TEXT CHECK (genai_ai_assessment IN ('low', 'medium', 'high')),
  genai_ai_reasoning TEXT,
  -- Content moderation
  content_flagged BOOLEAN DEFAULT FALSE,
  content_flag_reason TEXT,
  -- AI metadata
  ai_provider TEXT,
  ai_model TEXT,
  ai_preprocessing_version TEXT,
  ai_processed_at TIMESTAMPTZ,
  -- Review state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_staging_status ON cards_staging(status);
CREATE INDEX idx_cards_staging_batch ON cards_staging(import_batch_id);

-- cards_real: curated live dataset
CREATE TABLE cards_real (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id UUID REFERENCES cards_staging(id) ON DELETE SET NULL,
  card_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  is_phishing BOOLEAN NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  body_truncated BOOLEAN DEFAULT FALSE,
  word_count INT,
  char_count INT,
  link_count_in_display SMALLINT DEFAULT 0,
  technique TEXT,
  secondary_technique TEXT,
  -- Linguistic quality scores 0-5
  grammar_quality SMALLINT CHECK (grammar_quality BETWEEN 0 AND 5),
  prose_fluency SMALLINT CHECK (prose_fluency BETWEEN 0 AND 5),
  personalization_level SMALLINT CHECK (personalization_level BETWEEN 0 AND 5),
  contextual_coherence SMALLINT CHECK (contextual_coherence BETWEEN 0 AND 5),
  -- Computed readability metrics
  flesch_kincaid_score FLOAT,
  avg_sentence_length FLOAT,
  sentence_length_variance FLOAT,
  -- GenAI classification
  genai_detector_score FLOAT CHECK (genai_detector_score BETWEEN 0 AND 1),
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  genai_ai_reasoning TEXT,
  genai_reviewer_reasoning TEXT,
  -- Curation metadata
  is_verbatim BOOLEAN DEFAULT FALSE,
  source_corpus TEXT NOT NULL,
  highlights TEXT[],
  clues TEXT[],
  explanation TEXT,
  review_notes TEXT,
  review_time_ms INT,
  ai_model TEXT,
  ai_preprocessing_version TEXT,
  auth_status TEXT CHECK (auth_status IN ('verified', 'unverified', 'fail')),
  dataset_version TEXT DEFAULT 'v1',
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_real_card_id ON cards_real(card_id);
CREATE INDEX idx_cards_real_phishing ON cards_real(is_phishing);
CREATE INDEX idx_cards_real_technique ON cards_real(technique);
CREATE INDEX idx_cards_real_dataset ON cards_real(dataset_version);
CREATE INDEX idx_cards_real_genai ON cards_real(is_genai_suspected);

-- answers: every research mode answer event
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  card_id TEXT NOT NULL,
  card_source TEXT NOT NULL CHECK (card_source IN ('generated', 'real')),
  is_phishing BOOLEAN NOT NULL,
  technique TEXT,
  secondary_technique TEXT,
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  -- Denormalised linguistic scores for fast analytical queries
  grammar_quality SMALLINT,
  prose_fluency SMALLINT,
  personalization_level SMALLINT,
  contextual_coherence SMALLINT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  user_answer TEXT NOT NULL CHECK (user_answer IN ('phishing', 'legit')),
  correct BOOLEAN NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('guessing', 'likely', 'certain')),
  -- Timing (milliseconds)
  time_from_render_ms INT,
  time_from_confidence_ms INT,
  confidence_selection_time_ms INT,
  -- Behaviour
  scroll_depth_pct SMALLINT CHECK (scroll_depth_pct BETWEEN 0 AND 100),
  answer_method TEXT CHECK (answer_method IN ('swipe', 'button')),
  answer_ordinal SMALLINT CHECK (answer_ordinal BETWEEN 1 AND 10),
  streak_at_answer_time SMALLINT,
  correct_count_at_time SMALLINT,
  -- Context
  game_mode TEXT NOT NULL CHECK (game_mode IN ('research', 'freeplay', 'daily', 'expert', 'preview')),
  is_daily_challenge BOOLEAN DEFAULT FALSE,
  dataset_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_session ON answers(session_id);
CREATE INDEX idx_answers_created ON answers(created_at);
CREATE INDEX idx_answers_card ON answers(card_id);
CREATE INDEX idx_answers_technique ON answers(technique);
CREATE INDEX idx_answers_genai ON answers(is_genai_suspected);
CREATE INDEX idx_answers_correct ON answers(correct);

-- sessions: one row per game played
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('research', 'freeplay', 'daily', 'expert', 'preview')),
  is_daily_challenge BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cards_answered SMALLINT DEFAULT 0,
  final_score INT,
  final_rank TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  viewport_width SMALLINT,
  viewport_height SMALLINT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- import_batches: tracks each corpus import run
CREATE TABLE import_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_corpus TEXT NOT NULL,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  raw_count INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  notes TEXT
);

-- dataset_versions: version registry
CREATE TABLE dataset_versions (
  version TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ,
  total_cards INT DEFAULT 0,
  phishing_count INT DEFAULT 0,
  legit_count INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO dataset_versions (version, description)
VALUES ('v1', 'Initial dataset — GenAI era phishing, post-2023 samples, 600 phishing / 400 legitimate');

-- card_flags: player-reported issues with cards
CREATE TABLE card_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL,
  session_id TEXT,
  reason TEXT CHECK (reason IN ('wrong_answer', 'too_obvious', 'poor_quality', 'other')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
