import { type GimmickId, TIER1_GIMMICKS, TIER2_GIMMICKS, TIER3_GIMMICKS, ROGUELIKE_FLOORS } from './roguelike';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Allowed secondary gimmicks — lighter modifiers that layer well */
const SECONDARY_GIMMICKS: GimmickId[] = ['UNDER_PRESSURE', 'DECEPTION', 'CHAIN_MAIL'];

interface GimmickAssignment {
  primary: (GimmickId | null)[];
  secondary: (GimmickId | null)[];
}

/**
 * Assign gimmicks to each floor.
 * Floor 0: Tier 1 (random), no secondary
 * Floor 1: Tier 2, no secondary
 * Floors 2-3: Tier 2 primary + secondary from allowed list
 * Last floor (floorCount-1): Tier 3 boss gimmick, no secondary
 */
export function assignGimmicks(floorCount: number = ROGUELIKE_FLOORS): GimmickAssignment {
  const tier1 = shuffle([...TIER1_GIMMICKS]);
  const tier2 = shuffle([...TIER2_GIMMICKS]);
  const tier3 = shuffle([...TIER3_GIMMICKS]);

  const primary: (GimmickId | null)[] = [];
  const secondary: (GimmickId | null)[] = [];

  // Floor 0: Tier 1, no secondary
  primary.push(tier1[0] ?? null);
  secondary.push(null);

  // Floors 1 through floorCount-2: Tier 2
  const tier2Count = Math.min(floorCount - 2, tier2.length);
  const shuffledSecondary = shuffle([...SECONDARY_GIMMICKS]);
  let secondaryIdx = 0;

  for (let i = 0; i < tier2Count; i++) {
    const floorIdx = i + 1;
    primary.push(tier2[i] ?? null);

    if (floorIdx >= 2) {
      // Floors 2+ get a secondary, but not the same as the primary
      let sec = shuffledSecondary[secondaryIdx] ?? null;
      if (sec === tier2[i]) {
        secondaryIdx++;
        sec = shuffledSecondary[secondaryIdx] ?? null;
      }
      secondary.push(sec);
      secondaryIdx++;
    } else {
      secondary.push(null);
    }
  }

  // Last floor: Tier 3 (boss), no secondary
  if (floorCount >= 5 && tier3.length > 0) {
    primary.push(tier3[0] ?? null);
    secondary.push(null);
  }

  return { primary, secondary };
}

/**
 * Returns the timer duration in milliseconds for a gimmick on a given floor,
 * or null if the gimmick does not impose a timer.
 *
 * UNDER_PRESSURE: 15 000ms base, minus 2 000ms per floor, minimum 8 000ms.
 * QUICK_SCAN: flat 12 000ms per card — fast pace, no floor scaling.
 */
export function getTimerDuration(gimmick: GimmickId | null, floor: number): number | null {
  if (gimmick === 'QUICK_SCAN') return 12000;
  if (gimmick !== 'UNDER_PRESSURE') return null;
  const duration = 15000 - floor * 2000;
  return Math.max(8000, duration);
}
