-- Admin messaging system: targeted SIGINT messages + global broadcasts
-- Also adds custom_title to players for admin-granted display titles

CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_player_id UUID REFERENCES players(id),  -- null = global broadcast
  lines TEXT[] NOT NULL,                          -- SIGINT dialogue lines
  button_text TEXT NOT NULL DEFAULT 'ACKNOWLEDGED',
  created_by TEXT NOT NULL DEFAULT 'admin',       -- who sent it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                          -- null = never expires
);

-- Track which players have seen which messages
CREATE TABLE admin_message_seen (
  message_id UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, player_id)
);

CREATE INDEX idx_admin_messages_target ON admin_messages(target_player_id);
CREATE INDEX idx_admin_messages_created ON admin_messages(created_at DESC);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_message_seen ENABLE ROW LEVEL SECURITY;

-- Add custom title to players (shows in PVP instead of badge name)
ALTER TABLE players ADD COLUMN IF NOT EXISTS custom_title TEXT;
