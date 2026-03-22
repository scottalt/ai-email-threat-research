-- Add featured badge column to players table
-- Stores the achievement_id of the player's chosen display badge for H2H
ALTER TABLE players ADD COLUMN IF NOT EXISTS featured_badge TEXT;
