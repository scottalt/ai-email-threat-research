import type { Card } from './types';
import {
  type CardModifier,
  MODIFIER_DEFS,
  FLOOR_DIFFICULTY_POOLS,
  FLOOR_MODIFIER_RANGE,
} from './roguelike';

// All difficulty levels in order from easiest to hardest
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme'] as const;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface RoguelikeCardAssignment {
  cardId: string;
  modifiers: CardModifier[];
}

/**
 * Select cards for a floor and assign modifiers.
 *
 * @param availableCards - Full pool of cards to draw from.
 * @param floor          - 0-based floor index.
 * @param excludeCardIds - Card IDs already seen in this run (no repeats).
 * @param count          - Number of cards to select.
 */
export function selectFloorCards(
  availableCards: Card[],
  floor: number,
  excludeCardIds: string[],
  count: number,
): RoguelikeCardAssignment[] {
  const difficultyPool = FLOOR_DIFFICULTY_POOLS[Math.min(floor, FLOOR_DIFFICULTY_POOLS.length - 1)] ?? ['easy'];
  const excludeSet = new Set(excludeCardIds);

  // Filter by floor difficulty and exclude already-seen cards
  const eligible = availableCards.filter(
    (c) => difficultyPool.includes(c.difficulty) && !excludeSet.has(c.id),
  );

  // Separate phishing from legit to guarantee at least 1 of each
  const phishing = shuffle(eligible.filter((c) => c.isPhishing));
  const legit = shuffle(eligible.filter((c) => !c.isPhishing));

  const selected: Card[] = [];

  // Guarantee at least 1 phishing and 1 legit if available
  if (phishing.length > 0) selected.push(phishing.pop()!);
  if (legit.length > 0) selected.push(legit.pop()!);

  // Fill the rest from the combined remainder
  const remainder = shuffle([...phishing, ...legit]);
  while (selected.length < count && remainder.length > 0) {
    selected.push(remainder.pop()!);
  }

  // Fallback: if pool too small, fill from adjacent difficulty levels
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((c) => c.id));
    // Expand to adjacent difficulties radiating outward from the floor's pool
    const adjacentDifficulties = DIFFICULTY_ORDER.filter(
      (d) => !difficultyPool.includes(d),
    );
    const fallbackPool = shuffle(
      availableCards.filter(
        (c) => adjacentDifficulties.includes(c.difficulty) && !excludeSet.has(c.id) && !selectedIds.has(c.id),
      ),
    );
    if (fallbackPool.length > 0) {
      console.warn(
        `[roguelike] selectFloorCards: floor ${floor} pool yielded only ${selected.length}/${count} cards — filling ${count - selected.length} slot(s) from adjacent difficulties`,
      );
    }
    while (selected.length < count && fallbackPool.length > 0) {
      selected.push(fallbackPool.pop()!);
    }
  }

  // Shuffle final selection order
  const finalCards = shuffle(selected);

  // Assign modifiers
  const allModifiers = Object.keys(MODIFIER_DEFS) as CardModifier[];
  const [modMin, modMax] = FLOOR_MODIFIER_RANGE[Math.min(floor, FLOOR_MODIFIER_RANGE.length - 1)] ?? [0, 0];

  return finalCards.map((card): RoguelikeCardAssignment => {
    const modCount = randInt(modMin, modMax);
    const shuffledMods = shuffle(allModifiers);
    const modifiers = shuffledMods.slice(0, modCount);
    return { cardId: card.id, modifiers };
  });
}
