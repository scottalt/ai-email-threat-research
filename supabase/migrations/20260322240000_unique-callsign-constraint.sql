-- Enforce unique callsigns (case-insensitive), excluding NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_display_name_unique
  ON players (LOWER(display_name))
  WHERE display_name IS NOT NULL;
