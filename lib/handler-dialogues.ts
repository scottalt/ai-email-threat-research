// SIGINT dialogue system — imports personality from sigint-personality.ts
// This file handles the display/tracking logic. Edit personality in sigint-personality.ts.

export type { SigintDialogue as HandlerDialogue } from './sigint-personality';
import { ALL_DIALOGUES } from './sigint-personality';

export const HANDLER_DIALOGUES = ALL_DIALOGUES;

/** Check if a handler moment has been seen */
export function hasSeenMoment(momentId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
    return seen.includes(momentId);
  } catch { return false; }
}

/** Mark a handler moment as seen */
export function markMomentSeen(momentId: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
    if (!seen.includes(momentId)) {
      seen.push(momentId);
      localStorage.setItem('handler_moments_seen', JSON.stringify(seen));
    }
  } catch { /* ignore */ }
}
