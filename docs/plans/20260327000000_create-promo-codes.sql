-- Migration: promo_codes table + promo_redemptions join table
-- Supports limited-use promo codes that award badges

CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  badge_id text NOT NULL,          -- achievement ID to award
  max_uses integer NOT NULL,       -- max number of redemptions (e.g. 100)
  current_uses integer DEFAULT 0,
  expires_at timestamptz,          -- null = never expires
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  UNIQUE(promo_code_id, player_id)  -- each player can only redeem a code once
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_player
  ON promo_redemptions(player_id);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Players can read active promo codes (to check validity)
CREATE POLICY "Anyone can read active promo codes"
  ON promo_codes FOR SELECT USING (active = true);

-- Players can read their own redemptions
CREATE POLICY "Players can read own redemptions"
  ON promo_redemptions FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE auth_id = auth.uid()));

-- Writes go through admin client (service role)

-- Seed the THOUGHT_LEADER promo code (first 100 redemptions)
INSERT INTO promo_codes (code, badge_id, max_uses, active)
VALUES ('THOUGHT-LEADER', 'thought_leader', 100, true)
ON CONFLICT (code) DO NOTHING;
