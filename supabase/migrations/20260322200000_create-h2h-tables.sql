-- H2H Competitive Mode tables for Threat Terminal
-- Creates match records, per-card answers, and seasonal player stats

-- 1. h2h_matches — match records
CREATE TABLE h2h_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL DEFAULT 'season-0',
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  ghost_run_id UUID REFERENCES h2h_matches(id),
  card_ids TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'complete', 'cancelled')),
  winner_id UUID REFERENCES players(id),
  player1_time_ms INT,
  player2_time_ms INT,
  player1_cards_completed SMALLINT DEFAULT 0,
  player2_cards_completed SMALLINT DEFAULT 0,
  player1_rank_tier TEXT,
  player2_rank_tier TEXT,
  player1_points_delta INT,
  player2_points_delta INT,
  is_ghost_match BOOLEAN DEFAULT FALSE,
  is_rated BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_h2h_matches_player1 ON h2h_matches(player1_id);
CREATE INDEX idx_h2h_matches_player2 ON h2h_matches(player2_id);
CREATE INDEX idx_h2h_matches_season ON h2h_matches(season);
CREATE INDEX idx_h2h_matches_status ON h2h_matches(status);

ALTER TABLE h2h_matches ENABLE ROW LEVEL SECURITY;

-- 2. h2h_match_answers — per-card answers within a match
CREATE TABLE h2h_match_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES h2h_matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  card_index SMALLINT NOT NULL,
  card_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  user_answer TEXT NOT NULL CHECK (user_answer IN ('phishing', 'legit')),
  time_from_render_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, player_id, card_index)
);

CREATE INDEX idx_h2h_match_answers_match ON h2h_match_answers(match_id);
CREATE INDEX idx_h2h_match_answers_player ON h2h_match_answers(player_id);

ALTER TABLE h2h_match_answers ENABLE ROW LEVEL SECURITY;

-- 3. h2h_player_stats — seasonal player stats
CREATE TABLE h2h_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  season TEXT NOT NULL DEFAULT 'season-0',
  rank_points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  win_streak INT NOT NULL DEFAULT 0,
  best_win_streak INT NOT NULL DEFAULT 0,
  peak_rank_points INT NOT NULL DEFAULT 0,
  rated_matches_today SMALLINT NOT NULL DEFAULT 0,
  last_match_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, season)
);

CREATE INDEX idx_h2h_player_stats_leaderboard ON h2h_player_stats(season, rank_points DESC);
CREATE INDEX idx_h2h_player_stats_player ON h2h_player_stats(player_id);

ALTER TABLE h2h_player_stats ENABLE ROW LEVEL SECURITY;
