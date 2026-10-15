-- Lock down content registry tables.
-- The original "Service role full access" policies had no TO clause, so they
-- applied to anon and authenticated too, letting anyone with the public anon key
-- read and write these tables. The service role bypasses RLS on its own, and the
-- only code touching these tables is app/api/admin/content/* via
-- getSupabaseAdminClient(), so dropping the policies leaves admin access intact
-- while RLS (still enabled) denies everyone else.

DROP POLICY IF EXISTS "Service role full access" ON registry_seasons;
DROP POLICY IF EXISTS "Service role full access" ON registry_themes;
DROP POLICY IF EXISTS "Service role full access" ON registry_achievements;
DROP POLICY IF EXISTS "Service role full access" ON registry_ranks;
DROP POLICY IF EXISTS "Service role full access" ON registry_h2h_tiers;
DROP POLICY IF EXISTS "Service role full access" ON registry_h2h_point_deltas;
DROP POLICY IF EXISTS "Service role full access" ON registry_quests;
DROP POLICY IF EXISTS "Service role full access" ON registry_xp_config;
DROP POLICY IF EXISTS "Service role full access" ON registry_changelog;
