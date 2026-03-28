'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface PresencePlayer {
  playerId: string;
  callsign: string;
  rank: string;
  page: string;
}

// Map pathnames to friendly labels
function pageLabel(path: string): string {
  if (path === '/play' || path === '/') return 'HOME';
  if (path.startsWith('/play')) return 'PLAYING';
  if (path.startsWith('/admin')) return 'ADMIN';
  if (path.startsWith('/inventory')) return 'INVENTORY';
  if (path.startsWith('/profile')) return 'PROFILE';
  if (path.startsWith('/intel')) return 'INTEL';
  if (path.startsWith('/changelog')) return 'CHANGELOG';
  if (path.startsWith('/methodology')) return 'METHODOLOGY';
  if (path.startsWith('/player/')) return 'VIEWING PROFILE';
  return path.toUpperCase().replace(/^\//, '');
}

export default function AdminLivePage() {
  const [players, setPlayers] = useState<PresencePlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel('presence:lobby');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online: PresencePlayer[] = [];
        for (const key in state) {
          const entries = state[key] as unknown as PresencePlayer[];
          if (entries?.[0]) {
            online.push(entries[0]);
          }
        }
        // Sort by callsign
        online.sort((a, b) => a.callsign.localeCompare(b.callsign));
        setPlayers(online);
      })
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-4 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] text-sm font-mono tracking-wider transition-colors">
            [ BACK ]
          </Link>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--c-primary)] animate-pulse' : 'bg-[var(--c-muted)]'}`} />
            <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">
              {connected ? 'LIVE' : 'CONNECTING...'}
            </span>
          </div>
        </div>

        {/* Player count */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[var(--c-accent)] text-sm tracking-widest font-mono">ACTIVE_OPERATIVES</span>
            <span className="text-[var(--c-primary)] text-sm font-mono font-bold">{players.length}</span>
          </div>

          <div className="px-3 py-3">
            {players.length === 0 ? (
              <div className="text-[var(--c-muted)] text-sm font-mono text-center py-4">
                NO OPERATIVES ONLINE
              </div>
            ) : (
              <div className="space-y-1">
                {/* Column headers */}
                <div className="flex items-center gap-3 text-[var(--c-muted)] text-xs font-mono tracking-widest pb-1 border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]">
                  <span className="w-2" />
                  <span className="flex-1">CALLSIGN</span>
                  <span className="w-28 text-right">RANK</span>
                  <span className="w-24 text-right">LOCATION</span>
                </div>

                {players.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-3 py-1.5 text-sm font-mono">
                    <span className="w-2 h-2 rounded-full bg-[var(--c-primary)] shrink-0" />
                    <span className="flex-1 text-[var(--c-primary)] truncate">{p.callsign}</span>
                    <span className="w-28 text-right text-[var(--c-secondary)] text-xs tracking-wider">{p.rank}</span>
                    <span className="w-24 text-right text-[var(--c-accent)] text-xs tracking-wider">{pageLabel(p.page)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
