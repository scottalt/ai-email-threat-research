'use client';

import { useState, useEffect } from 'react';
import { ACHIEVEMENTS, RARITY_COLORS } from '@/lib/achievements';
import { getRankFromPoints } from '@/lib/h2h';
import { H2HRankGuide } from './H2HRankGuide';
import type { PlayerProfile } from '@/lib/types';

interface Props {
  profile: PlayerProfile;
  onSearch: () => void;
  onBack: () => void;
}

export function H2HLobby({ profile, onSearch, onBack }: Props) {
  const [h2hStats, setH2HStats] = useState<{
    rankLabel: string; rankPoints: number; rankColor: string;
    wins: number; losses: number; winStreak: number; bestWinStreak: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/h2h/stats').then(async (res) => {
      if (res.ok) setH2HStats(await res.json());
    }).catch(() => {});
  }, []);

  const featuredBadge = profile.featuredBadge
    ? ACHIEVEMENTS.find((a) => a.id === profile.featuredBadge)
    : null;

  return (
    <div className="w-full max-w-md lg:max-w-lg mx-auto px-4 space-y-3">
      {/* Player card */}
      <div className="term-border bg-[var(--c-bg)]">
        <div className="border-b border-[rgba(255,0,128,0.3)] px-4 py-3 flex items-center justify-between">
          <h2 className="text-[#ff0080] text-sm font-mono tracking-widest font-bold">HEAD_2_HEAD</h2>
          <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">SEASON 0</span>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Profile card */}
          <div className="border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] p-4 text-center space-y-3">
            <div className="text-[var(--c-muted)] text-xs font-mono tracking-widest">YOUR PROFILE</div>

            {/* Callsign */}
            <div className="text-[var(--c-primary)] text-lg font-mono font-bold">
              {profile.displayName ?? 'ANON'}
            </div>

            {/* Rank */}
            <div className="flex items-center justify-center gap-3 text-sm font-mono">
              {(() => {
                const rank = getRankFromPoints(h2hStats?.rankPoints ?? 0);
                return (
                  <>
                    <span className="text-lg" style={{ color: rank.color }}>{rank.icon}</span>
                    <span className="font-bold" style={{ color: rank.color }}>{rank.label}</span>
                  </>
                );
              })()}
              <span className="text-[var(--c-muted)]">
                {h2hStats?.rankPoints ?? 0} pts
              </span>
            </div>

            {/* Featured badge */}
            {featuredBadge ? (
              <div className="flex items-center justify-center gap-2 text-sm font-mono">
                <span style={{ color: RARITY_COLORS[featuredBadge.rarity] }}>
                  {featuredBadge.icon}
                </span>
                <span style={{ color: RARITY_COLORS[featuredBadge.rarity] }}>
                  {featuredBadge.name}
                </span>
              </div>
            ) : (
              <div className="text-[var(--c-muted)] text-xs font-mono">
                No badge equipped — visit INVENTORY to equip one
              </div>
            )}

            {/* W/L record */}
            {h2hStats && (h2hStats.wins > 0 || h2hStats.losses > 0) && (
              <div className="flex items-center justify-center gap-4 text-sm font-mono text-[var(--c-muted)]">
                <span>{h2hStats.wins}W / {h2hStats.losses}L</span>
                {h2hStats.winStreak >= 2 && (
                  <span className="text-[var(--c-primary)] font-bold">{h2hStats.winStreak} streak</span>
                )}
                {h2hStats.bestWinStreak >= 3 && (
                  <span className="text-[var(--c-muted)]">best: {h2hStats.bestWinStreak}</span>
                )}
              </div>
            )}
          </div>

          {/* Rules reminder */}
          <div className="text-[var(--c-muted)] text-sm font-mono text-center leading-relaxed">
            5 cards. Wrong answer = eliminated. Fastest perfect run wins.
          </div>

          {/* Search button */}
          <button
            onClick={onSearch}
            className="w-full py-4 term-border border-2 border-[rgba(255,0,128,0.5)] text-[#ff0080] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,0,128,0.06)] active:scale-95 transition-all"
          >
            [ SEARCH FOR OPPONENT ]
          </button>

          {/* Back button */}
          <button
            onClick={onBack}
            className="w-full py-2 text-[var(--c-muted)] font-mono text-sm tracking-widest hover:text-[var(--c-secondary)] active:scale-95 transition-all"
          >
            BACK
          </button>
        </div>
      </div>

      {/* Rank tiers */}
      <H2HRankGuide currentPoints={h2hStats?.rankPoints ?? 0} />
    </div>
  );
}
