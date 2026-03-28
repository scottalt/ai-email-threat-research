'use client';

import { usePlayer } from '@/lib/usePlayer';
import { usePresence } from '@/lib/usePresence';
import { getRankFromLevel } from '@/lib/rank';

/**
 * Syncs player presence to Supabase Realtime.
 * Renders nothing — just a hook wrapper for the layout.
 */
export function PresenceSync() {
  const { profile, signedIn } = usePlayer();

  const playerId = signedIn ? (profile?.id ?? null) : null;
  const callsign = profile?.displayName ?? null;
  const rank = profile ? getRankFromLevel(profile.level).label : null;
  const level = profile?.level ?? null;
  const themeId = profile?.themeId ?? null;

  usePresence(playerId, callsign, rank, level, themeId);

  return null;
}
