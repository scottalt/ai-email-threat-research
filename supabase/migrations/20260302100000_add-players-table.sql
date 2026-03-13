-- Creates the players table and adds player_id to answers/sessions.
-- This was originally applied directly to prod via SQL editor.
-- Captured here as a migration for dev DB setup and future reproducibility.

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL,
  display_name TEXT,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  total_sessions INT DEFAULT 0,
  research_sessions_completed INT DEFAULT 0,
  research_graduated BOOLEAN DEFAULT FALSE,
  personal_best_score INT DEFAULT 0,
  background TEXT CHECK (background IN ('other', 'technical', 'infosec', 'prefer_not_to_say')),
  last_xp_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_auth_id ON players(auth_id);

-- Add player_id to answers for per-player analytics
ALTER TABLE answers ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id);
CREATE INDEX IF NOT EXISTS idx_answers_player_id ON answers(player_id);

-- Add player_id and dealt_card_ids to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS dealt_card_ids TEXT[];
