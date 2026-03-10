-- Add dealt_card_ids column to sessions for server-side card validation
-- Stores the card IDs dealt to a research session, enabling the answer
-- endpoint to reject answers for cards that were never shown.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS dealt_card_ids TEXT[] DEFAULT NULL;
