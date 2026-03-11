-- Add 'expert' and 'preview' to game_mode CHECK constraints.
-- Without this, expert/preview answers and sessions are silently rejected by the DB.

-- Sessions table: drop and recreate the constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_game_mode_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_game_mode_check
  CHECK (game_mode IN ('research', 'freeplay', 'daily', 'expert', 'preview'));

-- Answers table: drop and recreate the constraint
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_game_mode_check;
ALTER TABLE answers ADD CONSTRAINT answers_game_mode_check
  CHECK (game_mode IN ('research', 'freeplay', 'daily', 'expert', 'preview'));
