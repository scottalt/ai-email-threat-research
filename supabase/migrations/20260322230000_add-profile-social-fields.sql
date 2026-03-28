-- Social profile fields
ALTER TABLE players ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends', 'private'));
-- Expand featured badge from single to array (up to 5 display slots)
ALTER TABLE players ADD COLUMN IF NOT EXISTS featured_badges TEXT[] DEFAULT '{}';

-- Friends system
CREATE TABLE IF NOT EXISTS player_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  friend_id UUID NOT NULL REFERENCES players(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_player_friends_player ON player_friends(player_id);
CREATE INDEX IF NOT EXISTS idx_player_friends_friend ON player_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_player_friends_status ON player_friends(status);

ALTER TABLE player_friends ENABLE ROW LEVEL SECURITY;
