-- Roguelike mode tables

-- Run records
CREATE TABLE IF NOT EXISTS roguelike_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  operation_name TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  floor_reached SMALLINT NOT NULL DEFAULT 0,
  floors_cleared SMALLINT NOT NULL DEFAULT 0,
  lives_remaining SMALLINT NOT NULL DEFAULT 3,
  lives_max SMALLINT NOT NULL DEFAULT 3,
  intel_earned INT NOT NULL DEFAULT 0,
  intel_spent INT NOT NULL DEFAULT 0,
  clearance_earned INT NOT NULL DEFAULT 0,
  gimmick_assignments JSONB NOT NULL DEFAULT '[]',
  perks_purchased TEXT[] DEFAULT '{}',
  cards_answered SMALLINT NOT NULL DEFAULT 0,
  cards_correct SMALLINT NOT NULL DEFAULT 0,
  best_streak SMALLINT NOT NULL DEFAULT 0,
  deaths SMALLINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roguelike_runs_player ON roguelike_runs(player_id);
CREATE INDEX IF NOT EXISTS idx_roguelike_runs_score ON roguelike_runs(score DESC);
CREATE INDEX IF NOT EXISTS idx_roguelike_runs_status ON roguelike_runs(status);

ALTER TABLE roguelike_runs ENABLE ROW LEVEL SECURITY;

-- Player permanent upgrade state (for Phase 2, create table now)
CREATE TABLE IF NOT EXISTS roguelike_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, upgrade_id)
);

CREATE INDEX IF NOT EXISTS idx_roguelike_upgrades_player ON roguelike_upgrades(player_id);
ALTER TABLE roguelike_upgrades ENABLE ROW LEVEL SECURITY;

-- Add roguelike clearance to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS roguelike_clearance INT NOT NULL DEFAULT 0;

-- Add roguelike pool to cards_generated check constraint
ALTER TABLE cards_generated DROP CONSTRAINT IF EXISTS cards_generated_pool_check;
ALTER TABLE cards_generated ADD CONSTRAINT cards_generated_pool_check
  CHECK (pool IN ('freeplay', 'expert', 'roguelike'));
