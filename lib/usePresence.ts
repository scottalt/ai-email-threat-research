'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from './supabase-browser';

interface PresenceState {
  playerId: string;
  callsign: string;
  rank: string;
  level: number;
  themeId: string;
  page: string;
  joinedAt: number;
}

/**
 * Broadcasts player presence via Supabase Realtime.
 * Only activates for signed-in players with a callsign.
 * Automatically updates when the player navigates between pages.
 */
export function usePresence(
  playerId: string | null,
  callsign: string | null,
  rank: string | null,
  level: number | null,
  themeId: string | null,
) {
  const pathname = usePathname();
  const channelRef = useRef<ReturnType<typeof getSupabaseBrowserClient>['channel'] extends (name: string, ...args: unknown[]) => infer R ? R : never>(null);

  useEffect(() => {
    if (!playerId || !callsign) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel('presence:lobby', {
      config: { presence: { key: playerId } },
    });

    const state: PresenceState = {
      playerId,
      callsign,
      rank: rank ?? 'CLICK_HAPPY',
      level: level ?? 1,
      themeId: themeId ?? 'phosphor',
      page: pathname ?? '/play',
      joinedAt: Date.now(),
    };

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(state);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [playerId, callsign, rank, level, themeId, pathname]);
}
