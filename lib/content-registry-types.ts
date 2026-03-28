// TypeScript types for the content registry tables.
// These mirror the DB schema in 20260323300000_create-content-registry.sql

export interface RegistrySeason {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'upcoming' | 'active' | 'ended';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryThemeColors {
  primary: string;
  secondary: string;
  muted: string;
  dark: string;
  bg: string;
  bgAlt: string;
  accent: string;
  accentDim: string;
}

export interface RegistryTheme {
  id: string;
  name: string;
  subtitle: string;
  unlock_level: number;
  unlock_label: string;
  requires_graduation: boolean;
  sort_order: number;
  colors: RegistryThemeColors;
  created_at: string;
  updated_at: string;
}

export type AchievementCategory = 'progression' | 'skill' | 'streak' | 'speed' | 'investigation' | 'xp' | 'daily' | 'h2h' | 'season';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

export interface RegistryAchievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  season_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryRank {
  id: number;
  label: string;
  min_level: number;
  max_level: number;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryH2HTier {
  tier: string;
  season_id: string;
  label: string;
  icon: string;
  min_points: number;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryH2HPointDelta {
  id: number;
  season_id: string;
  is_winner: boolean;
  tier_diff: number;
  delta: number;
}

export interface RegistryQuest {
  id: string;
  name: string;
  description: string;
  detail: string;
  target_count: number;
  reward_text: string;
  xp_reward: number;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RegistryXPConfig {
  key: string;
  value_int: number | null;
  value_json: unknown | null;
  description: string | null;
  updated_at: string;
}

export interface RegistryChangelog {
  id: number;
  date: string;
  category: 'milestone' | 'update';
  title: string;
  body: string | null;
  highlight: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
