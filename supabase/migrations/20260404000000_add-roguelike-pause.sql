-- Add pause support to roguelike runs

-- Add paused_state column to store full run snapshot when paused
ALTER TABLE roguelike_runs ADD COLUMN IF NOT EXISTS paused_state JSONB;

-- Update status check constraint to include 'paused'
ALTER TABLE roguelike_runs DROP CONSTRAINT IF EXISTS roguelike_runs_status_check;
ALTER TABLE roguelike_runs ADD CONSTRAINT roguelike_runs_status_check
  CHECK (status IN ('active', 'complete', 'abandoned', 'paused'));
