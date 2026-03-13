-- Prevent duplicate research answers: one answer per player per card in research mode.
-- This closes the race condition where rapid submissions both pass the application-level check.
-- Uses a partial unique index so it only applies to research mode answers with a player_id.

-- Step 1: Remove existing duplicates, keeping the earliest answer per (player_id, card_id).
-- This is safe — duplicate answers are the bug we're fixing, not intentional data.
DELETE FROM answers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY player_id, card_id ORDER BY created_at ASC) AS rn
    FROM answers
    WHERE game_mode = 'research' AND player_id IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- Step 2: Now safe to create the unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_player_card_research_dedup
  ON answers (player_id, card_id)
  WHERE game_mode = 'research' AND player_id IS NOT NULL;
