'use client';

import { usePlayer } from '@/lib/usePlayer';
import { usePresence } from '@/lib/usePresence';
import { getRankFromPoints } from '@/lib/h2h';

/**
 * Syncs player presence to Supabase Realtime.
 * Renders nothing — just a hook wrapper for the layout.
 */
export function PresenceSync() {
  const { profile, signedIn } = usePlayer();

  const playerId = signedIn ? (profile?.id ?? null) : null;
  const callsign = profile?.displayName ?? null;

  // Get the player's solo rank label from their level
  const rank = profile ? getRankFromPoints(profile.xp ?? 0).label : null;

  usePresence(playerId, callsign, rank);

  return null;
}
