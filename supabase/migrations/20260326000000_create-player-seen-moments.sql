-- Migration: player_seen_moments table
-- Tracks which SIGINT dialogue moments each player has seen (cross-device persistence)

CREATE TABLE IF NOT EXISTS player_seen_moments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  moment_id text NOT NULL,
  seen_at timestamptz DEFAULT now(),
  UNIQUE(player_id, moment_id)
);

-- Index for fast lookups by player
CREATE INDEX IF NOT EXISTS idx_player_seen_moments_player
  ON player_seen_moments(player_id);

-- RLS: players can only read their own moments
ALTER TABLE player_seen_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own moments"
  ON player_seen_moments FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

-- Writes go through admin client (service role), no INSERT policy needed for players
