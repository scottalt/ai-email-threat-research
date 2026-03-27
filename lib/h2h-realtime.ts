import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase-browser';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MatchProgressEvent {
  playerId: string;
  cardIndex: number;
  timestamp: number;
}

export interface MatchResultEvent {
  winnerId: string | null;
  player1PointsDelta: number;
  player2PointsDelta: number;
  reason: 'completed' | 'eliminated' | 'forfeit';
}

// ---------------------------------------------------------------------------
// subscribeToMatch — returns the channel for the caller to manage
// ---------------------------------------------------------------------------

export function subscribeToMatch(
  matchId: string,
  playerId: string,
  onOpponentProgress: (event: MatchProgressEvent) => void,
  onMatchResult: (event: MatchResultEvent) => void,
  onOpponentReady?: () => void,
): RealtimeChannel {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on('broadcast', { event: 'ready' }, (payload: any) => {
      if (payload.payload?.playerId !== playerId && onOpponentReady) {
        onOpponentReady();
      }
    })
    .subscribe();

  return ch;
}

// ---------------------------------------------------------------------------
// broadcastProgress — no longer includes `correct` to prevent info leaks
// ---------------------------------------------------------------------------

export function broadcastProgress(
  channel: RealtimeChannel | null,
  playerId: string,
  cardIndex: number,
): void {
  if (!channel) return;

  const event: MatchProgressEvent = {
    playerId,
    cardIndex,
    timestamp: Date.now(),
  };

  channel.send({ type: 'broadcast', event: 'progress', payload: event });
}

// ---------------------------------------------------------------------------
// broadcastResult
// ---------------------------------------------------------------------------

export function broadcastResult(
  channel: RealtimeChannel | null,
  result: MatchResultEvent,
): void {
  if (!channel) return;

  channel.send({ type: 'broadcast', event: 'result', payload: result });
}

// ---------------------------------------------------------------------------
// broadcastReady
// ---------------------------------------------------------------------------

export function broadcastReady(channel: RealtimeChannel | null, playerId: string): void {
  if (!channel) return;
  channel.send({ type: 'broadcast', event: 'ready', payload: { playerId } });
}

// ---------------------------------------------------------------------------
// unsubscribeFromMatch — accepts channel directly, no module singleton
// ---------------------------------------------------------------------------

export function unsubscribeFromMatch(channel: RealtimeChannel | null): void {
  if (channel) {
    channel.unsubscribe();
  }
}
