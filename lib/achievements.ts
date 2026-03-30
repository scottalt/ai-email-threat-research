// Achievement definitions — static registry, no DB needed for definitions.
// Rarity determines badge color: common=dim green, uncommon=green, rare=amber, legendary=red

export type AchievementCategory = 'progression' | 'skill' | 'streak' | 'speed' | 'investigation' | 'xp' | 'daily' | 'h2h' | 'roguelike' | 'season';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic' | 'secret' | 'unique';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string; // Unicode/ASCII icon for terminal display
  season?: string; // null = permanent, 'season-0' = Season 0 exclusive
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Progression ──
  { id: 'first_blood',    name: 'FIRST_BLOOD',        description: 'First threat analyzed',            category: 'progression', rarity: 'common',    icon: '◆' },
  { id: 'veteran',        name: 'VETERAN_ANALYST',     description: '10 sessions in the field',         category: 'progression', rarity: 'uncommon',  icon: '◆' },
  { id: 'graduate',       name: 'RESEARCH_GRADUATE',   description: 'Completed 10 research answers',    category: 'progression', rarity: 'uncommon',  icon: '⬡' },
  { id: 'research_20',    name: 'DATA_CONTRIBUTOR',    description: 'Completed 20 research answers',    category: 'progression', rarity: 'rare',      icon: '⬡' },
  { id: 'research_30',    name: 'FULL_CLEARANCE',      description: 'Completed all 30 research answers', category: 'progression', rarity: 'legendary', icon: '⬡' },
  { id: 'apex',           name: 'APEX_OPERATOR',       description: 'Reach level 30',                   category: 'progression', rarity: 'legendary', icon: '◆' },

  // ── Skill ──
  { id: 'perfect_round',  name: 'ZERO_MISS',           description: 'Perfect round — zero breaches',    category: 'skill', rarity: 'rare',      icon: '★' },
  { id: 'certain_correct', name: 'DEAD_CERTAIN',       description: '5 correct with CERTAIN confidence in one round', category: 'skill', rarity: 'rare', icon: '★' },
  { id: 'hard_sweep',     name: 'HARD_TARGET',         description: '10/10 on hard or extreme cards',   category: 'skill', rarity: 'rare',      icon: '★' },
  { id: 'expert_ace',     name: 'EXPERT_ACE',          description: '10/10 in Expert mode',              category: 'skill', rarity: 'legendary', icon: '★' },

  // ── Streak ──
  { id: 'streak_5',       name: 'HOT_STREAK',          description: '5 correct in a row',               category: 'streak', rarity: 'common',   icon: '▶' },
  { id: 'streak_10',      name: 'UNTOUCHABLE',         description: 'Entire round without a miss',      category: 'streak', rarity: 'rare',     icon: '▶' },
  { id: 'daily_3',        name: 'DAILY_OPERATOR',      description: 'Complete 3 daily challenges',      category: 'streak', rarity: 'uncommon', icon: '▶' },

  // ── Speed ──
  { id: 'speed_demon',    name: 'SPEED_DEMON',         description: 'Correct in under 5s with CERTAIN confidence', category: 'speed', rarity: 'rare', icon: '⚡' },
  { id: 'methodical',     name: 'METHODICAL',          description: 'Avg 30s+ per card, 8+ correct',   category: 'speed', rarity: 'uncommon', icon: '⊕' },

  // ── Investigation ──
  { id: 'header_hunter',  name: 'HEADER_HUNTER',       description: 'Open headers on 5+ cards in one round', category: 'investigation', rarity: 'common', icon: '⊞' },
  { id: 'url_inspector',  name: 'URL_INSPECTOR',       description: 'Inspect URLs on 5+ cards in one round', category: 'investigation', rarity: 'common', icon: '⊞' },
  { id: 'full_recon',     name: 'FULL_RECON',          description: 'Headers + URL on same card, 3 times',   category: 'investigation', rarity: 'uncommon', icon: '⊞' },

  // ── XP ──
  { id: 'xp_1000',        name: 'KILOBYTE',            description: 'Earn 1,000 total XP',              category: 'xp', rarity: 'common',    icon: '◈' },
  { id: 'xp_5000',        name: 'ENCRYPTED',           description: 'Earn 5,000 total XP',              category: 'xp', rarity: 'uncommon',  icon: '◈' },
  { id: 'xp_20000',       name: 'CLASSIFIED',          description: 'Earn 20,000 total XP',             category: 'xp', rarity: 'rare',      icon: '◈' },
  { id: 'pb_2500',        name: 'HIGH_SCORE',          description: 'Score 2,500+ pts in a single round', category: 'xp', rarity: 'rare',      icon: '◈' },

  // ── Daily streak ──
  { id: 'streak_3d',  name: 'CONSISTENT',      description: 'Play 3 days in a row',   category: 'daily', rarity: 'common',   icon: '▶' },
  { id: 'streak_7d',  name: 'DEDICATED',        description: 'Play 7 days in a row',   category: 'daily', rarity: 'uncommon', icon: '▶' },
  { id: 'streak_30d', name: 'RELENTLESS',       description: 'Play 30 days in a row',  category: 'daily', rarity: 'rare',     icon: '▶' },

  // ── H2H Ranked ──
  { id: 'h2h_first_win',  name: 'FIRST_KILL',          description: 'Win your first H2H match',         category: 'h2h', rarity: 'common',    icon: '⚔' },
  { id: 'h2h_10_wins',    name: 'SERIAL_WINNER',       description: 'Win 10 H2H matches',               category: 'h2h', rarity: 'uncommon',  icon: '⚔' },
  { id: 'h2h_50_wins',    name: 'APEX_PREDATOR',       description: 'Win 50 H2H matches',               category: 'h2h', rarity: 'rare',      icon: '⚔' },
  { id: 'h2h_perfect',    name: 'FLAWLESS_VICTORY',    description: 'Win H2H with 5/5 correct',         category: 'h2h', rarity: 'rare',      icon: '⚔' },
  { id: 'h2h_streak_5',   name: 'DOMINATION',          description: '5 H2H wins in a row',              category: 'h2h', rarity: 'rare',      icon: '⚔' },

  // ── Roguelike (DEADLOCK) ──
  { id: 'rl_first_breach',  name: 'FIRST BREACH',   description: 'Complete a DEADLOCK run',               category: 'roguelike', rarity: 'common',    icon: '⚡' },
  { id: 'rl_tower_clear',   name: 'TOWER CLEAR',    description: 'Clear all 5 floors',                    category: 'roguelike', rarity: 'rare',      icon: '🏔️' },
  { id: 'rl_flawless',      name: 'FLAWLESS OP',    description: 'Full clear with no deaths',             category: 'roguelike', rarity: 'legendary', icon: '💎' },
  { id: 'rl_deep_pockets',  name: 'DEEP POCKETS',   description: 'Accumulate 100 Intel in a single run',  category: 'roguelike', rarity: 'uncommon',  icon: '💰' },
  { id: 'rl_high_roller',   name: 'HIGH ROLLER',    description: 'Win a 20-Intel confidence wager',        category: 'roguelike', rarity: 'uncommon',  icon: '🎰' },
  { id: 'rl_speed_demon',   name: 'SPEED DEMON',    description: 'Clear floor 1 in under 30 seconds',     category: 'roguelike', rarity: 'rare',      icon: '⚡' },
  { id: 'rl_survivor',      name: 'SURVIVOR',       description: 'Clear a floor with 1 life remaining',   category: 'roguelike', rarity: 'uncommon',  icon: '🩸' },
  { id: 'rl_glass_cannon',  name: 'GLASS CANNON',   description: 'Full clear with no defensive perks',    category: 'roguelike', rarity: 'legendary', icon: '🔫' },
  { id: 'rl_dedicated',     name: 'DEDICATED',       description: 'Complete 10 DEADLOCK runs',             category: 'roguelike', rarity: 'uncommon',  icon: '🔁' },

  // ── Season 0 Exclusive ──
  { id: 'founder',        name: 'FOUNDER',             description: 'Played during Season 0 — the founding season', category: 'season', rarity: 'mythic', icon: '♛', season: 'season-0' },
  { id: 's0_silver',      name: 'S0: SILVER',          description: 'Reached Silver rank in Season 0',  category: 'season', rarity: 'uncommon',  icon: '◆',  season: 'season-0' },
  { id: 's0_gold',        name: 'S0: GOLD',            description: 'Reached Gold rank in Season 0',    category: 'season', rarity: 'rare',      icon: '◆◆', season: 'season-0' },
  { id: 's0_platinum',    name: 'S0: PLATINUM',        description: 'Reached Platinum rank in Season 0', category: 'season', rarity: 'rare',     icon: '⬡',  season: 'season-0' },
  { id: 's0_diamond',     name: 'S0: DIAMOND',         description: 'Reached Diamond rank in Season 0', category: 'season', rarity: 'legendary', icon: '⬡⬡', season: 'season-0' },
  { id: 's0_master',      name: 'S0: MASTER',          description: 'Reached Master rank in Season 0',  category: 'season', rarity: 'legendary', icon: '★',  season: 'season-0' },
  { id: 's0_elite',       name: 'S0: ELITE',           description: 'Reached Elite rank in Season 0',   category: 'season', rarity: 'mythic',    icon: '★★', season: 'season-0' },

  // ── Promo Exclusive ──
  { id: 'thought_leader', name: 'THOUGHT_LEADER',     description: 'Certified thought leader. Agrees with everything. Open to opportunities.', category: 'season', rarity: 'mythic', icon: '🧠' },

  // ── Admin Exclusive (manually granted only) ──
  { id: 'architect', name: 'ARCHITECT', description: 'Built this world from the command line. There is no badge above this one.', category: 'season', rarity: 'unique', icon: '◈' },
  { id: 'buffer_overflow', name: 'BUFFER_OVERFLOW', description: 'Pushed more data than the system could handle. 60 answers per second. The logs don\'t lie.', category: 'season', rarity: 'secret', icon: '▓' },
  { id: 'beta_tester', name: 'BETA_TESTER', description: 'Broke things so others didn\'t have to. Tested before the terminal was ready. Early access operator.', category: 'season', rarity: 'secret', icon: '⟐' },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common:    '#00aa28',
  uncommon:  '#00ff41',
  rare:      '#ffaa00',
  legendary: '#ff3333',
  mythic:    '#ffd700',
  secret:    '#00ffcc',
  unique:    '#ff00ff',
};

export const RARITY_ORDER: AchievementRarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic', 'secret', 'unique'];

/** CSS class for badge rarity visual effects (glow, pulse, shimmer) */
export const RARITY_BADGE_CLASS: Record<AchievementRarity, string> = {
  common:    'badge-common',
  uncommon:  'badge-uncommon',
  rare:      'badge-rare',
  legendary: 'badge-legendary',
  mythic:    'badge-mythic',
  secret:    'badge-secret',
  unique:    'badge-unique',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progression:   'PROGRESSION',
  skill:         'SKILL',
  streak:        'STREAK',
  speed:         'SPEED',
  investigation: 'INVESTIGATION',
  xp:            'XP / RANK',
  daily:         'DAILY',
  h2h:           'PvP',
  roguelike:     'DEADLOCK',
  season:        'SEASON EXCLUSIVE',
};
