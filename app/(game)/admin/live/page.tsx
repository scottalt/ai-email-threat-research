'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { THEMES } from '@/lib/themes';

interface PresencePlayer {
  playerId: string;
  callsign: string;
  rank: string;
  level: number;
  themeId: string;
  page: string;
  joinedAt: number;
}

function pageLabel(path: string): string {
  if (path === '/play' || path === '/') return 'HOME';
  if (path.startsWith('/admin')) return 'ADMIN';
  if (path.startsWith('/inventory')) return 'INVENTORY';
  if (path.startsWith('/profile')) return 'PROFILE';
  if (path.startsWith('/intel')) return 'INTEL';
  if (path.startsWith('/changelog')) return 'CHANGELOG';
  if (path.startsWith('/methodology')) return 'METHODOLOGY';
  if (path.startsWith('/shop')) return 'SHOP';
  if (path.startsWith('/player/')) return 'VIEWING PROFILE';
  if (path.startsWith('/privacy')) return 'PRIVACY';
  if (path.startsWith('/terms')) return 'TERMS';
  return path.toUpperCase().replace(/^\//, '') || 'HOME';
}

function pageColor(label: string): string {
  if (label === 'HOME') return 'var(--c-primary)';
  if (label === 'ADMIN') return '#ff3333';
  if (label === 'INVENTORY') return 'var(--c-accent)';
  if (label === 'PROFILE') return 'var(--c-secondary)';
  return 'var(--c-muted)';
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AdminLivePage() {
  const [players, setPlayers] = useState<PresencePlayer[]>([]);
  const [recentLeft, setRecentLeft] = useState<(PresencePlayer & { leftAt: number })[]>([]);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0); // force re-render for time updates
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null);
  const prevPlayersRef = useRef<Map<string, PresencePlayer>>(new Map());

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel('presence:lobby');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online: PresencePlayer[] = [];
        for (const key in state) {
          const entries = state[key] as unknown as PresencePlayer[];
          if (entries?.[0]) online.push(entries[0]);
        }
        online.sort((a, b) => a.callsign.localeCompare(b.callsign));

        // Track who left
        const onlineIds = new Set(online.map((p) => p.playerId));
        const prev = prevPlayersRef.current;
        for (const [id, p] of prev) {
          if (!onlineIds.has(id)) {
            setRecentLeft((r) => [{ ...p, leftAt: Date.now() }, ...r].slice(0, 20));
          }
        }
        prevPlayersRef.current = new Map(online.map((p) => [p.playerId, p]));

        setPlayers(online);
      })
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // Tick every 10s to update "time ago" displays
    const ticker = setInterval(() => setTick((t) => t + 1), 10000);

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      clearInterval(ticker);
    };
  }, []);

  // Group by page for summary
  const pageCounts: Record<string, number> = {};
  for (const p of players) {
    const label = pageLabel(p.page);
    pageCounts[label] = (pageCounts[label] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--c-primary)] animate-pulse' : 'bg-[var(--c-muted)]'}`} />
          <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">
            {connected ? 'LIVE — REAL-TIME' : 'CONNECTING...'}
          </span>
        </div>
        <span className="text-[var(--c-primary)] text-lg font-mono font-black">{players.length} ONLINE</span>
      </div>

      {/* Page distribution */}
      {Object.keys(pageCounts).length > 0 && (
        <div className="term-border px-4 py-3">
          <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-2">ACTIVITY_DISTRIBUTION</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
              <div
                key={label}
                className="px-2 py-1 border text-xs font-mono tracking-wider"
                style={{ color: pageColor(label), borderColor: `color-mix(in srgb, ${pageColor(label)} 30%, transparent)` }}
              >
                {label} <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active players */}
      <div className="term-border">
        <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-4 py-2 flex items-center justify-between">
          <span className="text-[var(--c-accent)] text-xs font-mono tracking-widest">ACTIVE_OPERATIVES</span>
          <span className="text-[var(--c-primary)] text-xs font-mono font-bold">{players.length}</span>
        </div>

        <div className="overflow-x-auto">
          {players.length === 0 ? (
            <div className="text-[var(--c-muted)] text-sm font-mono text-center py-6">NO OPERATIVES ONLINE</div>
          ) : (
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]">
                  <th className="px-3 py-2 text-left text-[var(--c-muted)] text-xs tracking-widest">CALLSIGN</th>
                  <th className="px-3 py-2 text-left text-[var(--c-muted)] text-xs tracking-widest">LVL</th>
                  <th className="px-3 py-2 text-left text-[var(--c-muted)] text-xs tracking-widest">RANK</th>
                  <th className="px-3 py-2 text-left text-[var(--c-muted)] text-xs tracking-widest">THEME</th>
                  <th className="px-3 py-2 text-left text-[var(--c-muted)] text-xs tracking-widest">LOCATION</th>
                  <th className="px-3 py-2 text-right text-[var(--c-muted)] text-xs tracking-widest">SESSION</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const theme = THEMES.find((t) => t.id === p.themeId);
                  const label = pageLabel(p.page);
                  return (
                    <tr key={p.playerId} className="border-b border-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/players/${p.playerId}`} className="text-[var(--c-primary)] hover:underline">
                          {p.callsign}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[var(--c-secondary)]">{p.level}</td>
                      <td className="px-3 py-2 text-[var(--c-secondary)] text-xs">{p.rank}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: theme?.colors.primary ?? 'var(--c-muted)' }}>
                          {theme?.name ?? 'PHOSPHOR'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: pageColor(label) }}>{label}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--c-dark)] text-xs">
                        {timeAgo(p.joinedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recently left */}
      {recentLeft.length > 0 && (
        <div className="term-border">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-4 py-2 flex items-center justify-between">
            <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">RECENTLY_LEFT</span>
            <span className="text-[var(--c-dark)] text-xs font-mono">{recentLeft.length}</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {recentLeft.map((p, i) => (
              <div key={`${p.playerId}-${i}`} className="flex items-center justify-between text-xs font-mono py-1 border-b border-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--c-dark)]" />
                  <Link href={`/admin/players/${p.playerId}`} className="text-[var(--c-muted)] hover:text-[var(--c-secondary)]">
                    {p.callsign}
                  </Link>
                  <span className="text-[var(--c-dark)]">LVL {p.level}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--c-dark)]">{pageLabel(p.page)}</span>
                  <span className="text-[var(--c-dark)]">{timeAgo(p.leftAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
