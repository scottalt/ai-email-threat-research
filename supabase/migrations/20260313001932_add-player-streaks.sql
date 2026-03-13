-- Daily streak tracking table
-- One row per player, tracks consecutive days of play
CREATE TABLE IF NOT EXISTS player_streaks (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  streak_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own streak"
  ON player_streaks FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can insert streaks"
  ON player_streaks FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update streaks"
  ON player_streaks FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
