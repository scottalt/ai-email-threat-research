// ─── Constants ───────────────────────────────────────────────────────────────

export const ROGUELIKE_FLOORS = 5;
export const ROGUELIKE_CARDS_PER_FLOOR = 5;
export const ROGUELIKE_DEFAULT_LIVES = 3;
export const ROGUELIKE_MAX_LIVES = 5;
export const ROGUELIKE_SESSION_TTL = 3600;

// Intel economy (perfect floor ~47-55, good floor ~30-38, decent floor ~24-30; floor clear scales with difficulty)
export const INTEL_CORRECT = 5;
export const INTEL_SPEED_BONUS = 2;
export const INTEL_SPEED_THRESHOLD_MS = 5000;
export const INTEL_STREAK_BONUS = 2;
export const INTEL_STREAK_MIN = 3;
export const INTEL_FLOOR_CLEAR = [8, 10, 12, 15, 20] as const;
export const INTEL_WRONG = -2;
export const INTEL_WAGER_MULTIPLIER = 2;
export const INTEL_WAGER_OPTIONS = [5, 10, 15] as const;
export const INVESTIGATION_INSPECT_COST = 8;

// Clearance (balanced: full perfect clear = ~60, realistic run = 15-30, max tree ~15-20 runs)
export const CLEARANCE_PER_FLOOR = [2, 3, 5, 7, 10] as const;
export const CLEARANCE_FULL_CLEAR = 5;
export const CLEARANCE_NO_DEATHS = 3;

// Score
export const SCORE_CORRECT_BASE = 100;
export const SCORE_FLOOR_MULTIPLIER = [1, 1.5, 2, 3, 4] as const;
export const SCORE_SPEED_BONUS = 50;
export const SCORE_MODIFIER_BONUS = 25;
export const SCORE_WRONG_BASE = -50;
export const SCORE_DEATH_PENALTY = -100;
export const SCORE_FLOOR_CLEAR = 200;
export const SCORE_FULL_CLEAR = 500;
export const SCORE_NO_DEATHS = 300;
export const SCORE_STREAK_BONUS = 20;

// ─── Floor Difficulty & Modifier Mapping ─────────────────────────────────────

import type { Difficulty } from './types';

/** Difficulty pools for each floor index (0-based) */
export const FLOOR_DIFFICULTY_POOLS: Difficulty[][] = [
  ['easy'],                   // floor 0
  ['easy', 'medium'],         // floor 1
  ['medium', 'hard'],         // floor 2
  ['hard', 'extreme'],        // floor 3
  ['extreme'],                // floor 4
];

/** [min, max] number of modifiers assigned per card on each floor */
export const FLOOR_MODIFIER_RANGE: [number, number][] = [
  [0, 1], // floor 0
  [0, 1], // floor 1
  [1, 2], // floor 2
  [2, 3], // floor 3
  [2, 3], // floor 4
];

// ─── Card Modifiers ───────────────────────────────────────────────────────────

export type CardModifier =
  | 'LOOKALIKE_DOMAIN'
  | 'DECOY_RED_FLAGS'
  | 'AI_ENHANCED'
  | 'TIMED'
  | 'REDACTED_SENDER';

export interface ModifierDef {
  id: CardModifier;
  label: string;
  description: string;
}

export const MODIFIER_DEFS: Record<CardModifier, ModifierDef> = {
  LOOKALIKE_DOMAIN: {
    id: 'LOOKALIKE_DOMAIN',
    label: 'Lookalike Domain',
    description: 'The sender domain closely resembles a legitimate one.',
  },
  DECOY_RED_FLAGS: {
    id: 'DECOY_RED_FLAGS',
    label: 'Decoy Red Flags',
    description: 'Obvious red flags have been removed or obscured.',
  },
  AI_ENHANCED: {
    id: 'AI_ENHANCED',
    label: 'AI-Enhanced',
    description: 'The message has been polished by an AI to seem more convincing.',
  },
  TIMED: {
    id: 'TIMED',
    label: 'Timed',
    description: 'You must answer within the time limit.',
  },
  REDACTED_SENDER: {
    id: 'REDACTED_SENDER',
    label: 'Redacted Sender',
    description: 'The sender identity has been partially hidden.',
  },
};

// ─── Gimmicks ─────────────────────────────────────────────────────────────────

export type GimmickId =
  // Tier 1
  | 'FIRST_LOOK'
  | 'TRIAGE'
  | 'QUICK_SCAN'
  // Tier 2
  | 'UNDER_PRESSURE'
  | 'INVESTIGATION'
  | 'DECEPTION'
  | 'BLACKOUT'
  | 'CHAIN_MAIL'
  | 'DOUBLE_AGENT'
  | 'CONFIDENCE'
  // Tier 3 (boss)
  | 'BREACH'
  | 'SUPPLY_CHAIN'
  | 'INSIDER_THREAT'
  | 'APT';

export interface GimmickDef {
  id: GimmickId;
  tier: 1 | 2 | 3;
  label: string;
  description: string;
}

export const GIMMICK_DEFS: Record<GimmickId, GimmickDef> = {
  FIRST_LOOK: {
    id: 'FIRST_LOOK',
    tier: 1,
    label: 'First Look',
    description: 'Cards are revealed one section at a time.',
  },
  TRIAGE: {
    id: 'TRIAGE',
    tier: 1,
    label: 'Triage',
    description: 'You must sort cards into categories before answering.',
  },
  QUICK_SCAN: {
    id: 'QUICK_SCAN',
    tier: 1,
    label: 'Quick Scan',
    description: 'Cards are only visible for a limited preview.',
  },
  UNDER_PRESSURE: {
    id: 'UNDER_PRESSURE',
    tier: 2,
    label: 'Under Pressure',
    description: 'Each card has a countdown timer.',
  },
  INVESTIGATION: {
    id: 'INVESTIGATION',
    tier: 2,
    label: 'Investigation',
    description: 'Extra forensic details are shown for each card.',
  },
  DECEPTION: {
    id: 'DECEPTION',
    tier: 2,
    label: 'Deception',
    description: 'Some clue indicators are misleading.',
  },
  BLACKOUT: {
    id: 'BLACKOUT',
    tier: 2,
    label: 'Blackout',
    description: 'Portions of the card are redacted.',
  },
  CHAIN_MAIL: {
    id: 'CHAIN_MAIL',
    tier: 2,
    label: 'Chain Mail',
    description: 'Cards are presented as a chain of forwarded messages.',
  },
  DOUBLE_AGENT: {
    id: 'DOUBLE_AGENT',
    tier: 2,
    label: 'Double Agent',
    description: 'One card per floor is a decoy with inverted answer.',
  },
  CONFIDENCE: {
    id: 'CONFIDENCE',
    tier: 2,
    label: 'Confidence',
    description: 'You must also declare your confidence level on each answer.',
  },
  BREACH: {
    id: 'BREACH',
    tier: 3,
    label: 'Breach',
    description: 'Company under attack. Find compromised messages.',
  },
  SUPPLY_CHAIN: {
    id: 'SUPPLY_CHAIN',
    tier: 3,
    label: 'Supply Chain',
    description: 'Vendor compromise. Spot the poisoned link.',
  },
  INSIDER_THREAT: {
    id: 'INSIDER_THREAT',
    tier: 3,
    label: 'Insider Threat',
    description: 'Internal employee gone rogue. Spot the exfil.',
  },
  APT: {
    id: 'APT',
    tier: 3,
    label: 'APT',
    description: 'Advanced persistent threat. Multi-stage attack.',
  },
};

export const TIER1_GIMMICKS: GimmickId[] = ['FIRST_LOOK', 'TRIAGE', 'QUICK_SCAN'];

/** Phase 1 Tier 2 gimmicks only */
export const TIER2_GIMMICKS: GimmickId[] = [
  'UNDER_PRESSURE',
  'INVESTIGATION',
  'DECEPTION',
  'BLACKOUT',
  'CONFIDENCE',
];

export const TIER3_GIMMICKS: GimmickId[] = ['BREACH', 'SUPPLY_CHAIN', 'INSIDER_THREAT', 'APT'];

// ─── Perks ────────────────────────────────────────────────────────────────────

export type PerkId =
  | 'EXTRA_LIFE'
  | 'SHIELD'
  | 'DOUBLE_INTEL'
  // Phase 3: SKIP_CARD — skip the current card without penalty
  // Phase 3: REVEAL_CLUE — reveal one hidden clue per card this floor
  // Phase 3: FLOOR_SKIP — skip the next floor entirely
  | 'SLOW_TIME'
  | 'STREAK_SAVER'
  | 'INTEL_CACHE';

export interface PerkDef {
  id: PerkId;
  label: string;
  description: string;
  cost: number;
  stackable: boolean;
  maxOwned: number;
}

export const PERK_DEFS: PerkDef[] = [
  {
    id: 'EXTRA_LIFE',
    label: 'Extra Life',
    description: 'Gain one additional life (up to max).',
    cost: 40,
    stackable: true,
    maxOwned: ROGUELIKE_MAX_LIVES,
  },
  {
    id: 'SHIELD',
    label: 'Shield',
    description: 'Negate the next wrong answer — no life lost.',
    cost: 35,
    stackable: false,
    maxOwned: 1,
  },
  {
    id: 'DOUBLE_INTEL',
    label: 'Double Intel',
    description: 'Next correct answer earns double Intel.',
    cost: 25,
    stackable: false,
    maxOwned: 1,
  },
  // Phase 3: SKIP_CARD, REVEAL_CLUE, FLOOR_SKIP — not yet implemented
  {
    id: 'SLOW_TIME',
    label: 'Slow Time',
    description: 'Double the time limit on timed cards for this floor.',
    cost: 20,
    stackable: false,
    maxOwned: 1,
  },
  {
    id: 'STREAK_SAVER',
    label: 'Streak Saver',
    description: 'Preserve your streak on the next wrong answer.',
    cost: 18,
    stackable: false,
    maxOwned: 1,
  },
  {
    id: 'INTEL_CACHE',
    label: 'Intel Cache',
    description: 'Immediately gain 20 Intel.',
    cost: 10,
    stackable: true,
    maxOwned: 2,
  },
];

// ─── Perk Synergies ──────────────────────────────────────────────────────────

export interface SynergyDef {
  id: string;
  perkA: PerkId;
  perkB: PerkId;
  name: string;
  description: string;
}

export const SYNERGY_DEFS: SynergyDef[] = [
  {
    id: 'FAILSAFE',
    perkA: 'SHIELD',
    perkB: 'STREAK_SAVER',
    name: 'Failsafe',
    description: 'When either triggers, refund 25% of its cost as Intel.',
  },
  {
    id: 'COMPOUND_INTEREST',
    perkA: 'DOUBLE_INTEL',
    perkB: 'INTEL_CACHE',
    name: 'Compound Interest',
    description: 'Intel Cache gives 25 instead of 20.',
  },
  {
    id: 'MOMENTUM',
    perkA: 'SLOW_TIME',
    perkB: 'STREAK_SAVER',
    name: 'Momentum',
    description: 'Streak intel bonus doubled (+4 instead of +2).',
  },
  {
    id: 'FORTIFIED',
    perkA: 'EXTRA_LIFE',
    perkB: 'SHIELD',
    name: 'Fortified',
    description: 'Start each floor with a free Shield.',
  },
];

// ─── Run State ────────────────────────────────────────────────────────────────

export interface RoguelikeRunState {
  runId: string;
  operationName: string;
  playerId: string;
  currentFloor: number;
  totalFloors: number;
  lives: number;
  maxLives: number;
  intel: number;
  score: number;
  streak: number;
  bestStreak: number;
  deaths: number;
  perks: PerkId[];
  floorsCleared: number;
  cardHistory: (string | { cardId: string; technique: string | null; correct: boolean; isPhishing: boolean })[];      // cardIds answered so far
  cardsCorrect: number;       // count of correct answers
  currentFloorCardIds: string[];
  currentCardIndex: number;
  currentGimmick: GimmickId | null;
  floorGimmicks: (GimmickId | null)[];
  floorSecondaryGimmicks?: (GimmickId | null)[];
  startedAt: string;          // ISO timestamp
  completedAt: string | null;
  status: 'active' | 'dead' | 'completed' | 'paused';
  usedDefensivePerk?: boolean;     // True if SHIELD or STREAK_SAVER was consumed (for glass cannon achievement)
  // Phase 2: permanent upgrades active for this run
  activeUpgrades?: string[];       // UpgradeId[] active for this run
  freeInspections?: number;        // ANALYST_EYE: free inspections remaining
  intelMultiplier?: number;        // HAZARD_PAY: 1.15x intel
  shopSlots?: number;              // BLACK_MARKET: 4 instead of 3
  perkDiscount?: number;           // INSIDER_TRADING: 0.9 multiplier
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface RoguelikeLeaderboardEntry {
  runId: string;
  playerId: string;
  displayName: string | null;
  operationName: string;
  score: number;
  floorsCleared: number;
  totalFloors: number;
  deaths: number;
  bestStreak: number;
  clearance: number;
  completedAt: string;
}

// ─── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Calculate the score earned for a single card answer.
 */
export function calculateCardScore(
  correct: boolean,
  floor: number,
  modifierCount: number,
  answeredInMs: number,
  speedThresholdMs: number = INTEL_SPEED_THRESHOLD_MS,
): number {
  if (!correct) {
    const multiplier = SCORE_FLOOR_MULTIPLIER[Math.min(floor, SCORE_FLOOR_MULTIPLIER.length - 1)] ?? 1;
    return Math.round(SCORE_WRONG_BASE * multiplier);
  }

  const multiplier = SCORE_FLOOR_MULTIPLIER[Math.min(floor, SCORE_FLOOR_MULTIPLIER.length - 1)] ?? 1;
  let score = Math.round(SCORE_CORRECT_BASE * multiplier);

  // Modifier bonus
  score += modifierCount * SCORE_MODIFIER_BONUS;

  // Speed bonus
  if (answeredInMs <= speedThresholdMs) {
    score += SCORE_SPEED_BONUS;
  }

  return score;
}

/**
 * Calculate streak Intel bonus earned when a streak milestone is hit.
 * Returns 0 if the streak is below the minimum threshold.
 */
export function calculateStreakIntel(streak: number, streakMin: number = INTEL_STREAK_MIN): number {
  if (streak < streakMin) return 0;
  return INTEL_STREAK_BONUS; // flat bonus per qualifying streak card, not multiplicative
}

/**
 * Calculate the clearance score for a completed run.
 */
export function calculateRunClearance(
  floorsCleared: number,
  deaths: number,
  totalFloors: number,
): number {
  let clearance = 0;

  for (let i = 0; i < floorsCleared; i++) {
    clearance += CLEARANCE_PER_FLOOR[Math.min(i, CLEARANCE_PER_FLOOR.length - 1)] ?? 0;
  }

  if (floorsCleared === totalFloors) {
    clearance += CLEARANCE_FULL_CLEAR;
  }

  if (deaths === 0) {
    clearance += CLEARANCE_NO_DEATHS;
  }

  return clearance;
}

/**
 * Calculate the final run score including bonuses.
 */
export function calculateFinalScore(
  baseScore: number,
  floorsCleared: number,
  deaths: number,
  bestStreak: number,
  totalFloors: number,
): number {
  let final = baseScore;

  // Floor clear bonuses
  final += floorsCleared * SCORE_FLOOR_CLEAR;

  // Death penalties
  final += deaths * SCORE_DEATH_PENALTY;

  // Full clear bonus
  if (floorsCleared === totalFloors) {
    final += SCORE_FULL_CLEAR;
  }

  // No-death bonus
  if (deaths === 0) {
    final += SCORE_NO_DEATHS;
  }

  // Streak bonus
  final += bestStreak * SCORE_STREAK_BONUS;

  return Math.max(0, final);
}
