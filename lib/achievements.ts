// Achievement definitions — static registry, no DB needed for definitions.
// Rarity determines badge color: common=dim green, uncommon=green, rare=amber, legendary=red

export type AchievementCategory = 'progression' | 'skill' | 'streak' | 'speed' | 'investigation' | 'xp';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string; // Unicode/ASCII icon for terminal display
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Progression
  { id: 'first_blood',    name: 'FIRST_BLOOD',        description: 'First threat analyzed',            category: 'progression', rarity: 'common',    icon: '◆' },
  { id: 'veteran',        name: 'VETERAN_ANALYST',     description: '10 sessions in the field',         category: 'progression', rarity: 'uncommon',  icon: '◆' },
  { id: 'graduate',       name: 'RESEARCH_GRADUATE',   description: 'Earned Expert clearance',          category: 'progression', rarity: 'uncommon',  icon: '⬡' },
  { id: 'apex',           name: 'APEX_OPERATOR',       description: 'Reach level 30',                   category: 'progression', rarity: 'legendary', icon: '◆' },

  // Skill
  { id: 'perfect_round',  name: 'ZERO_MISS',           description: 'Perfect round - zero breaches',    category: 'skill', rarity: 'rare',      icon: '★' },
  { id: 'certain_correct', name: 'DEAD_CERTAIN',       description: '5 correct with CERTAIN confidence in one round', category: 'skill', rarity: 'rare', icon: '★' },
  { id: 'hard_sweep',     name: 'HARD_TARGET',         description: '10/10 on hard or extreme cards',   category: 'skill', rarity: 'rare',      icon: '★' },
  { id: 'expert_ace',     name: 'EXPERT_ACE',          description: '10/10 in Expert mode',              category: 'skill', rarity: 'legendary', icon: '★' },

  // Streak
  { id: 'streak_5',       name: 'HOT_STREAK',          description: '5 correct in a row',               category: 'streak', rarity: 'common',   icon: '▶' },
  { id: 'streak_10',      name: 'UNTOUCHABLE',         description: 'Entire round without a miss',      category: 'streak', rarity: 'rare',     icon: '▶' },
  { id: 'daily_3',        name: 'DAILY_OPERATOR',      description: 'Complete 3 daily challenges',      category: 'streak', rarity: 'uncommon', icon: '▶' },

  // Speed
  { id: 'speed_demon',    name: 'SPEED_DEMON',         description: 'Correct in under 5s with CERTAIN confidence', category: 'speed', rarity: 'rare', icon: '⚡' },
  { id: 'methodical',     name: 'METHODICAL',          description: 'Avg 30s+ per card, 8+ correct',   category: 'speed', rarity: 'uncommon', icon: '⊕' },

  // Investigation
  { id: 'header_hunter',  name: 'HEADER_HUNTER',       description: 'Open headers on 5+ cards in one round', category: 'investigation', rarity: 'common', icon: '⊞' },
  { id: 'url_inspector',  name: 'URL_INSPECTOR',       description: 'Inspect URLs on 5+ cards in one round', category: 'investigation', rarity: 'common', icon: '⊞' },
  { id: 'full_recon',     name: 'FULL_RECON',          description: 'Headers + URL on same card, 3 times',   category: 'investigation', rarity: 'uncommon', icon: '⊞' },

  // XP
  { id: 'xp_1000',        name: 'KILOBYTE',            description: 'Earn 1,000 total XP',              category: 'xp', rarity: 'common',    icon: '◈' },
  { id: 'xp_5000',        name: 'ENCRYPTED',           description: 'Earn 5,000 total XP',              category: 'xp', rarity: 'uncommon',  icon: '◈' },
  { id: 'xp_20000',       name: 'CLASSIFIED',          description: 'Earn 20,000 total XP',             category: 'xp', rarity: 'rare',      icon: '◈' },
  { id: 'pb_2500',        name: 'HIGH_SCORE',          description: 'Score 2,500+ pts in a single round', category: 'xp', rarity: 'rare',      icon: '◈' },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export const RARITY_COLORS: Record<AchievementRarity, string> = {
  common:    '#00aa28',
  uncommon:  '#00ff41',
  rare:      '#ffaa00',
  legendary: '#ff3333',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progression:   'PROGRESSION',
  skill:         'SKILL',
  streak:        'STREAK',
  speed:         'SPEED',
  investigation: 'INVESTIGATION',
  xp:            'XP / RANK',
};
