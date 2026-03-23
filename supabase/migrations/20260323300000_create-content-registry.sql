-- Content Registry — DB-backed game content for seasonal updates without code deploys.
-- Runs in parallel with hard-coded constants. No game code reads from these tables yet.

-- ── Shared trigger for updated_at ──
CREATE OR REPLACE FUNCTION update_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── 1. Seasons ──
CREATE TABLE registry_seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'ended')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_seasons FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_seasons
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 2. Themes ──
CREATE TABLE registry_themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  unlock_level INT NOT NULL DEFAULT 1,
  unlock_label TEXT NOT NULL DEFAULT 'DEFAULT',
  requires_graduation BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  colors JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_themes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_themes
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 3. Achievements ──
CREATE TABLE registry_achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('progression','skill','streak','speed','investigation','xp','daily','h2h','season')),
  rarity TEXT NOT NULL
    CHECK (rarity IN ('common','uncommon','rare','legendary','mythic')),
  icon TEXT NOT NULL DEFAULT '◆',
  season_id TEXT REFERENCES registry_seasons(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_achievements FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_achievements
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 4. Solo Ranks ──
CREATE TABLE registry_ranks (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  min_level INT NOT NULL,
  max_level INT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_ranks FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_ranks
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 5. H2H Rank Tiers (per-season) ──
CREATE TABLE registry_h2h_tiers (
  tier TEXT NOT NULL,
  season_id TEXT NOT NULL REFERENCES registry_seasons(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  min_points INT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tier, season_id)
);
ALTER TABLE registry_h2h_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_h2h_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_h2h_tiers
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 6. H2H Point Deltas (per-season) ──
CREATE TABLE registry_h2h_point_deltas (
  id SERIAL PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES registry_seasons(id) ON DELETE CASCADE,
  is_winner BOOLEAN NOT NULL,
  tier_diff INT NOT NULL,
  delta INT NOT NULL,
  UNIQUE (season_id, is_winner, tier_diff)
);
ALTER TABLE registry_h2h_point_deltas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_h2h_point_deltas FOR ALL USING (true) WITH CHECK (true);

-- ── 7. Quests ──
CREATE TABLE registry_quests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  target_count INT NOT NULL,
  reward_text TEXT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '◆',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_quests FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_quests
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 8. XP Config (key-value) ──
CREATE TABLE registry_xp_config (
  key TEXT PRIMARY KEY,
  value_int INT,
  value_json JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE registry_xp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_xp_config FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_xp_config
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();

-- ── 9. Changelog ──
CREATE TABLE registry_changelog (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('milestone', 'update')),
  title TEXT NOT NULL,
  body TEXT,
  highlight BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_registry_changelog_date ON registry_changelog(date DESC);
ALTER TABLE registry_changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON registry_changelog FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON registry_changelog
  FOR EACH ROW EXECUTE FUNCTION update_registry_updated_at();
