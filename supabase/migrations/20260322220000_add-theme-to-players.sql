-- Store selected theme server-side so it persists across devices
ALTER TABLE players ADD COLUMN IF NOT EXISTS theme_id TEXT DEFAULT 'phosphor';
