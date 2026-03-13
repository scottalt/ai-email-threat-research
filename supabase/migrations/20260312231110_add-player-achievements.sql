-- Player achievements table
-- Stores which achievements each player has unlocked
CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id UUID,
  UNIQUE(player_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

-- RLS: players can read their own achievements, only service role can insert
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own achievements"
  ON player_achievements FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can manage achievements"
  ON player_achievements FOR ALL
  USING (true)
  WITH CHECK (true);
