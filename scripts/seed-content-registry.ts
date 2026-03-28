/**
 * Seed script: populates content registry tables from hard-coded constants.
 * Ensures exact parity between the existing TypeScript arrays and the DB.
 *
 * Usage:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-content-registry.ts
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

import { createClient } from '@supabase/supabase-js';
import { THEMES } from '../lib/themes';
import { ACHIEVEMENTS } from '../lib/achievements';
import { H2H_RANKS, CURRENT_SEASON } from '../lib/h2h';
import { QUESTS } from '../lib/quests';
import {
  XP_PER_CORRECT, XP_PER_SESSION_COMPLETE, RESEARCH_GRADUATION_SESSIONS,
  RESEARCH_GRADUATION_ANSWERS, RESEARCH_FULL_UNLOCK_ANSWERS,
  LEVEL_THRESHOLDS, MAX_LEVEL,
} from '../lib/xp';
import { CHANGELOG_ENTRIES } from '../lib/changelog';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function seed() {
  console.log('Seeding content registry...\n');

  // ── 1. Seasons ──
  {
    const { error } = await supabase.from('registry_seasons').upsert([
      { id: CURRENT_SEASON, name: 'Season 0 — The Founding', start_date: '2026-03-22', status: 'active', sort_order: 0 },
    ], { onConflict: 'id' });
    if (error) console.error('seasons:', error.message);
    else console.log('✓ seasons: 1 row');
  }

  // ── 2. Themes ──
  {
    const rows = THEMES.map((t, i) => ({
      id: t.id,
      name: t.name,
      subtitle: t.subtitle,
      unlock_level: t.unlockLevel,
      unlock_label: t.unlockLabel,
      requires_graduation: t.id !== 'phosphor',
      sort_order: i,
      colors: t.colors,
    }));
    const { error } = await supabase.from('registry_themes').upsert(rows, { onConflict: 'id' });
    if (error) console.error('themes:', error.message);
    else console.log(`✓ themes: ${rows.length} rows`);
  }

  // ── 3. Achievements ──
  {
    const rows = ACHIEVEMENTS.map((a, i) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      rarity: a.rarity,
      icon: a.icon,
      season_id: a.season ?? null,
      sort_order: i,
    }));
    const { error } = await supabase.from('registry_achievements').upsert(rows, { onConflict: 'id' });
    if (error) console.error('achievements:', error.message);
    else console.log(`✓ achievements: ${rows.length} rows`);
  }

  // ── 4. Solo Ranks ──
  {
    const ranks = [
      { label: 'CLICK_HAPPY',      min_level: 1,  max_level: 3,  color: '#2a4a2a' },
      { label: 'PHISH_BAIT',       min_level: 4,  max_level: 6,  color: '#447744' },
      { label: 'LINK_CHECKER',     min_level: 7,  max_level: 9,  color: '#00aa28' },
      { label: 'HEADER_READER',    min_level: 10, max_level: 12, color: '#00ff41' },
      { label: 'SOC_ANALYST',      min_level: 13, max_level: 15, color: '#00ff41' },
      { label: 'THREAT_HUNTER',    min_level: 16, max_level: 18, color: '#ffcc00' },
      { label: 'INCIDENT_HANDLER', min_level: 19, max_level: 21, color: '#ffaa00' },
      { label: 'RED_TEAMER',       min_level: 22, max_level: 24, color: '#ffaa00' },
      { label: 'APT_ANALYST',      min_level: 25, max_level: 27, color: '#ff4400' },
      { label: 'ZERO_DAY',         min_level: 28, max_level: 30, color: '#ff3333' },
    ].map((r, i) => ({ ...r, sort_order: i }));
    const { error } = await supabase.from('registry_ranks').upsert(ranks, { onConflict: 'label' });
    if (error) console.error('ranks:', error.message);
    else console.log(`✓ ranks: ${ranks.length} rows`);
  }

  // ── 5. H2H Tiers ──
  {
    const rows = H2H_RANKS.map((r, i) => ({
      tier: r.tier,
      season_id: CURRENT_SEASON,
      label: r.label,
      icon: r.icon,
      min_points: r.minPoints,
      color: r.color,
      sort_order: i,
    }));
    const { error } = await supabase.from('registry_h2h_tiers').upsert(rows, { onConflict: 'tier,season_id' });
    if (error) console.error('h2h_tiers:', error.message);
    else console.log(`✓ h2h_tiers: ${rows.length} rows`);
  }

  // ── 6. H2H Point Deltas ──
  {
    // Extracted from calculatePointsDelta() in lib/h2h.ts
    // tierDiff: positive = winner is higher ranked
    const deltas = [
      // Winner deltas
      { is_winner: true, tier_diff: 2, delta: 8 },    // 2+ tiers above
      { is_winner: true, tier_diff: 1, delta: 14 },   // 1 tier above
      { is_winner: true, tier_diff: 0, delta: 20 },   // same tier
      { is_winner: true, tier_diff: -1, delta: 30 },  // 1 tier below (upset)
      { is_winner: true, tier_diff: -2, delta: 40 },  // 2+ tiers below (big upset)
      // Loser deltas
      { is_winner: false, tier_diff: 2, delta: -35 },  // lost to 2+ tiers below
      { is_winner: false, tier_diff: 1, delta: -28 },  // lost to 1 tier below
      { is_winner: false, tier_diff: 0, delta: -20 },  // same tier
      { is_winner: false, tier_diff: -1, delta: -12 }, // lost to 1 tier above
      { is_winner: false, tier_diff: -2, delta: -8 },  // lost to 2+ tiers above
    ].map(d => ({ ...d, season_id: CURRENT_SEASON }));

    const { error } = await supabase.from('registry_h2h_point_deltas').upsert(deltas, { onConflict: 'season_id,is_winner,tier_diff' });
    if (error) console.error('h2h_point_deltas:', error.message);
    else console.log(`✓ h2h_point_deltas: ${deltas.length} rows`);
  }

  // ── 7. Quests ──
  {
    const rows = QUESTS.map((q, i) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      detail: q.detail,
      target_count: q.target,
      reward_text: q.reward,
      xp_reward: q.xpReward,
      icon: q.icon,
      sort_order: i,
    }));
    const { error } = await supabase.from('registry_quests').upsert(rows, { onConflict: 'id' });
    if (error) console.error('quests:', error.message);
    else console.log(`✓ quests: ${rows.length} rows`);
  }

  // ── 8. XP Config ──
  {
    const configs = [
      { key: 'xp_per_correct', value_int: XP_PER_CORRECT, description: 'XP per correct answer' },
      { key: 'session_complete_bonus', value_int: XP_PER_SESSION_COMPLETE, description: 'Flat bonus for finishing a session' },
      { key: 'perfect_bonus', value_int: 50, description: 'Bonus for perfect round (replaces session_complete_bonus)' },
      { key: 'expert_multiplier', value_int: 2, description: 'XP multiplier for expert/freeplay mode' },
      { key: 'graduation_sessions', value_int: RESEARCH_GRADUATION_SESSIONS, description: 'Sessions needed to graduate research' },
      { key: 'graduation_answers', value_int: RESEARCH_GRADUATION_ANSWERS, description: 'Answers to unlock H2H' },
      { key: 'full_unlock_answers', value_int: RESEARCH_FULL_UNLOCK_ANSWERS, description: 'Answers to unlock all modes' },
      { key: 'max_level', value_int: MAX_LEVEL, description: 'Maximum player level' },
      { key: 'streak_bonus_per_day', value_int: 5, description: 'XP bonus per streak day' },
      { key: 'streak_bonus_cap', value_int: 35, description: 'Max daily streak XP bonus' },
      { key: 'level_thresholds', value_int: null, value_json: LEVEL_THRESHOLDS, description: 'Cumulative XP per level (30 values)' },
      { key: 'h2h_cards_per_match', value_int: 5, description: 'Cards per H2H match' },
      { key: 'h2h_queue_timeout_ms', value_int: 30000, description: 'Queue timeout before ghost match' },
      { key: 'h2h_daily_rated_cap', value_int: 20, description: 'Max rated H2H matches per day' },
      { key: 'h2h_daily_half_rate_after', value_int: 10, description: 'Diminishing returns kick in after N matches' },
    ];
    const { error } = await supabase.from('registry_xp_config').upsert(configs, { onConflict: 'key' });
    if (error) console.error('xp_config:', error.message);
    else console.log(`✓ xp_config: ${configs.length} rows`);
  }

  // ── 9. Changelog ──
  {
    const rows = CHANGELOG_ENTRIES.map((e, i) => ({
      date: e.date,
      category: e.category,
      title: e.title,
      body: e.body ?? null,
      highlight: e.highlight ?? false,
      sort_order: i,
    }));
    // Changelog uses auto-increment id, so we insert (not upsert). Skip if already populated.
    const { count } = await supabase.from('registry_changelog').select('*', { count: 'exact', head: true });
    if (count && count > 0) {
      console.log(`✓ changelog: ${count} rows (already populated, skipped)`);
    } else {
      const { error } = await supabase.from('registry_changelog').insert(rows);
      if (error) console.error('changelog:', error.message);
      else console.log(`✓ changelog: ${rows.length} rows`);
    }
  }

  console.log('\nDone.');
}

seed().catch(console.error);
