// XP earned per round outcome
export const XP_PER_CORRECT = 10;
export const XP_PER_SESSION_COMPLETE = 25; // flat bonus for finishing
export const RESEARCH_GRADUATION_SESSIONS = 3;
export const RESEARCH_GRADUATION_ANSWERS = 30;

// 30 levels. Cumulative XP thresholds — each level takes more XP than the last.
// Level 1 = 0 XP, level 2 = 100 XP, level 30 = ~37,700 XP (compounding ~15% per level)
export const LEVEL_THRESHOLDS: number[] = (() => {
  const t = [0]; // level 1 starts at 0
  for (let i = 1; i < 30; i++) {
    // Each level requires ~15% more XP than the previous gap
    const prev = t[i - 1];
    const gap = Math.round(100 * Math.pow(1.15, i - 1));
    t.push(prev + gap);
  }
  return t;
})();

export const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 30

/** XP earned from a completed round */
export function getXpForRound(correctCount: number, totalCards: number, mode: string): number {
  if (totalCards === 0) return 0; // empty session = no XP
  const correct = correctCount * XP_PER_CORRECT;
  const completionBonus = correctCount === totalCards ? 50 : XP_PER_SESSION_COMPLETE;
  // Expert mode: double XP (harder cards)
  const multiplier = mode === 'expert' ? 2 : 1;
  return (correct + completionBonus) * multiplier;
}

/** Level (1-30) for a given total XP */
export function getLevelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/** XP needed to reach the next level (0 if max level) */
export function xpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevelFromXp(xp);
  if (level >= MAX_LEVEL) return { current: 0, needed: 0, level };
  const floorXp = LEVEL_THRESHOLDS[level - 1];
  const ceilXp = LEVEL_THRESHOLDS[level];
  return { current: xp - floorXp, needed: ceilXp - floorXp, level };
}

/** Daily streak XP bonus: 5 XP per streak day, capped at 35 (day 7+) */
export function getStreakBonusXp(currentStreak: number): number {
  return Math.min(currentStreak * 5, 35);
}
