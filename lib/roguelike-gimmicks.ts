import { type GimmickId, TIER1_GIMMICKS, TIER2_GIMMICKS, TIER3_GIMMICKS, ROGUELIKE_FLOORS } from './roguelike';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Assign gimmicks to each floor.
 * Floor 0: Tier 1 (random)
 * Floors 1 through floorCount-2: Tier 2 (unique random, no repeats)
 * Last floor (floorCount-1): Tier 3 boss gimmick (if 5+ floors)
 * If there are more floors than gimmicks available, later floors may get null.
 */
export function assignGimmicks(floorCount: number = ROGUELIKE_FLOORS): (GimmickId | null)[] {
  const tier1 = shuffle([...TIER1_GIMMICKS]);
  const tier2 = shuffle([...TIER2_GIMMICKS]);
  const tier3 = shuffle([...TIER3_GIMMICKS]);

  const gimmicks: (GimmickId | null)[] = [];

  // Floor 0: Tier 1
  gimmicks.push(tier1[0] ?? null);

  // Floors 1 through floorCount-2: Tier 2
  const tier2Count = Math.min(floorCount - 2, tier2.length);
  for (let i = 0; i < tier2Count; i++) {
    gimmicks.push(tier2[i] ?? null);
  }

  // Last floor: Tier 3 (boss) if 5+ floors
  if (floorCount >= 5 && tier3.length > 0) {
    gimmicks.push(tier3[0] ?? null);
  }

  return gimmicks;
}

/**
 * Returns the timer duration in milliseconds for a gimmick on a given floor,
 * or null if the gimmick does not impose a timer.
 *
 * UNDER_PRESSURE: 15 000ms base, minus 2 000ms per floor, minimum 8 000ms.
 */
export function getTimerDuration(gimmick: GimmickId | null, floor: number): number | null {
  if (gimmick !== 'UNDER_PRESSURE') return null;
  const duration = 15000 - floor * 2000;
  return Math.max(8000, duration);
}
