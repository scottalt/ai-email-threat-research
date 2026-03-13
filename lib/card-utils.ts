import type { Card } from './types';

/** Fields to strip from cards before sending to clients */
const ANSWER_FIELDS = ['isPhishing', 'clues', 'explanation', 'highlights', 'technique'] as const;

/** Strip answer-revealing fields from a card for client delivery */
export function stripCardAnswers(card: Card): Omit<Card, 'isPhishing' | 'clues' | 'explanation' | 'highlights' | 'technique'> {
  const stripped = { ...card };
  for (const field of ANSWER_FIELDS) {
    delete (stripped as Record<string, unknown>)[field];
  }
  return stripped;
}

/** Build a lookup map of card ID → full card from an array */
export function buildCardMap(cards: Card[]): Map<string, Card> {
  return new Map(cards.map(c => [c.id, c]));
}
