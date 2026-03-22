import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase-browser';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MatchProgressEvent {
  playerId: string;
  cardIndex: number;
  correct: boolean;
  timestamp: number;
}

export interface MatchResultEvent {
  winnerId: string | null;
  player1PointsDelta: number;
  player2PointsDelta: number;
  reason: 'completed' | 'eliminated' | 'forfeit';
}

// ---------------------------------------------------------------------------
// Module-level channel state
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null;

// ---------------------------------------------------------------------------
// subscribeToMatch
// ---------------------------------------------------------------------------

export function subscribeToMatch(
  matchId: string,
  playerId: string,
  onOpponentProgress: (event: MatchProgressEvent) => void,
  onMatchResult: (event: MatchResultEvent) => void,
): RealtimeChannel {
  // Tear down any existing subscription before creating a new one
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }

  const supabase = getSupabaseBrowserClient();

  const ch = supabase.channel(`match:${matchId}`, {
    config: { broadcast: { self: false } },
  });

  ch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('broadcast', { event: 'progress' }, (payload: any) => {
      const data = payload.payload as MatchProgressEvent;
      if (data.playerId !== playerId) {
        onOpponentProgress(data);
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('broadcast', { event: 'result' }, (payload: any) => {
      const data = payload.payload as MatchResultEvent;
      onMatchResult(data);
    })
    .subscribe();

  channel = ch;
  return ch;
}

// ---------------------------------------------------------------------------
// broadcastProgress
// ---------------------------------------------------------------------------

export function broadcastProgress(
  _matchId: string,
  playerId: string,
  cardIndex: number,
  correct: boolean,
): void {
  if (!channel) return;

  const event: MatchProgressEvent = {
    playerId,
    cardIndex,
    correct,
    timestamp: Date.now(),
  };

  channel.send({ type: 'broadcast', event: 'progress', payload: event });
}

// ---------------------------------------------------------------------------
// broadcastResult
// ---------------------------------------------------------------------------

export function broadcastResult(
  _matchId: string,
  result: MatchResultEvent,
): void {
  if (!channel) return;

  channel.send({ type: 'broadcast', event: 'result', payload: result });
}

// ---------------------------------------------------------------------------
// unsubscribeFromMatch
// ---------------------------------------------------------------------------

export function unsubscribeFromMatch(): void {
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }
}
