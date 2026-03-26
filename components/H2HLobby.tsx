'use client';

import { useState, useEffect } from 'react';
import { ACHIEVEMENTS, RARITY_COLORS } from '@/lib/achievements';
import { getRankFromPoints, H2H_RANKS } from '@/lib/h2h';
import { useSigint } from '@/lib/SigintContext';
import type { PlayerProfile } from '@/lib/types';

interface Props {
  profile: PlayerProfile;
  onSearch: () => void;
  onBack: () => void;
}

export function H2HLobby({ profile, onSearch, onBack }: Props) {
  const { triggerSigint } = useSigint();

  // SIGINT: first time opening PvP
  useEffect(() => {
    triggerSigint('first_pvp_open');
  }, [triggerSigint]);

  const [h2hStats, setH2HStats] = useState<{
    rankLabel: string; rankPoints: number; rankColor: string;
    wins: number; losses: number; winStreak: number; bestWinStreak: number;
    peakRankPoints: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ position: number; displayName: string; rankPoints: number; rankLabel: string; rankColor: string; wins: number; losses: number }[]>([]);

  useEffect(() => {
    fetch('/api/h2h/stats').then(async (res) => {
      if (res.ok) setH2HStats(await res.json());
    }).catch(() => {});

    fetch('/api/h2h/leaderboard').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
      }
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
          <h2 className="text-[#ff0080] text-sm font-mono tracking-widest font-bold">PvP_MODE</h2>
          <div className="flex items-center gap-2">
            <span className="text-[#ffaa00] text-[10px] font-mono tracking-widest border border-[#ffaa0050] px-1.5 py-0.5">BETA</span>
            <span className="text-[var(--c-muted)] text-xs font-mono tracking-widest">SEASON 0</span>
          </div>
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
            {h2hStats === null ? (
              <div className="text-[var(--c-muted)] text-sm font-mono animate-pulse text-center">Loading rank...</div>
            ) : (
              <div className="flex items-center justify-center gap-3 text-sm font-mono">
                {(() => {
                  const rank = getRankFromPoints(h2hStats.rankPoints ?? 0);
                  return (
                    <>
                      <span className="text-lg" style={{ color: rank.color }}>{rank.icon}</span>
                      <span className="font-bold" style={{ color: rank.color }}>{rank.label}</span>
                    </>
                  );
                })()}
                <span className="text-[var(--c-muted)]">
                  {h2hStats.rankPoints ?? 0} pts
                </span>
              </div>
            )}

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

          {/* Back to home */}
          <button
            onClick={onBack}
            className="w-full py-2 text-[var(--c-muted)] font-mono text-xs tracking-widest hover:text-[var(--c-secondary)] transition-colors"
          >
            &lt; BACK
          </button>
        </div>
      </div>

      {/* H2H stats */}
      {h2hStats && (h2hStats.wins > 0 || h2hStats.losses > 0) && (
        <div className="w-full term-border bg-[var(--c-bg)]">
          <div className="px-4 py-2 border-b border-[rgba(255,0,128,0.2)]">
            <span className="text-[#ff0080] text-sm tracking-widest">MATCH_STATS</span>
          </div>
          <div className="px-4 py-3">
            {/* Record row */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[var(--c-primary)] text-xl font-mono font-black">{h2hStats.wins}</div>
                <div className="text-[var(--c-secondary)] text-xs font-mono">WINS</div>
              </div>
              <div>
                <div className="text-[#ff3333] text-xl font-mono font-black">{h2hStats.losses}</div>
                <div className="text-[var(--c-secondary)] text-xs font-mono">LOSSES</div>
              </div>
              <div>
                <div className="text-[var(--c-primary)] text-xl font-mono font-black">
                  {Math.round((h2hStats.wins / (h2hStats.wins + h2hStats.losses)) * 100)}%
                </div>
                <div className="text-[var(--c-secondary)] text-xs font-mono">WINRATE</div>
              </div>
            </div>
            {/* Streaks */}
            <div className="flex justify-between mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] text-sm font-mono">
              <span className="text-[var(--c-secondary)]">
                Streak: <span className="text-[var(--c-primary)] font-bold">{h2hStats.winStreak}</span>
              </span>
              <span className="text-[var(--c-secondary)]">
                Best: <span className="text-[var(--c-primary)] font-bold">{h2hStats.bestWinStreak}</span>
              </span>
              <span className="text-[var(--c-secondary)]">
                Highest: <span style={{ color: getRankFromPoints(h2hStats.peakRankPoints ?? h2hStats.rankPoints).color }} className="font-bold">
                  {h2hStats.peakRankPoints ?? h2hStats.rankPoints} pts
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rank tiers — always visible, compact */}
      <div className="w-full term-border bg-[var(--c-bg)]">
        <div className="px-4 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]">
          <span className="text-[var(--c-secondary)] text-sm tracking-widest">RANK_TIERS</span>
        </div>
        <div className="px-3 py-2 space-y-0.5">
          {H2H_RANKS.map((rank) => {
            const currentRank = getRankFromPoints(h2hStats?.rankPoints ?? 0);
            const isCurrent = currentRank.tier === rank.tier;
            const pointsToThis = isCurrent ? null : rank.minPoints - (h2hStats?.rankPoints ?? 0);
            return (
              <div
                key={rank.tier}
                className={`flex items-center justify-between text-sm font-mono px-2 py-1 ${
                  isCurrent ? 'border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]' : ''
                }`}
              >
                <span style={{ color: rank.color }}>
                  {rank.icon} <span className="font-bold">{rank.label}</span>
                  {isCurrent && <span className="text-[var(--c-primary)] text-xs ml-1">{'◀ YOU'}</span>}
                </span>
                <span className="text-[var(--c-secondary)] text-xs">
                  {rank.minPoints}+
                  {pointsToThis !== null && pointsToThis > 0 && (
                    <span className="text-[var(--c-muted)] ml-1">({pointsToThis} away)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] text-xs font-mono text-[var(--c-secondary)]">
          Win: +8 to +40 · Loss: -8 to -35
        </div>
      </div>

      {/* PvP Leaderboard */}
      <div className="w-full term-border bg-[var(--c-bg)]">
        <div className="px-4 py-2 border-b border-[rgba(255,0,128,0.2)]">
          <span className="text-[#ff0080] text-sm tracking-widest">PvP_LEADERBOARD</span>
        </div>
        <div className="px-3 py-2">
          {leaderboard.length === 0 ? (
            <div className="text-[var(--c-muted)] text-sm font-mono text-center py-3">
              No ranked matches yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {leaderboard.slice(0, 10).map((entry) => {
                const rank = getRankFromPoints(entry.rankPoints);
                return (
                  <div
                    key={entry.position}
                    className="flex items-center justify-between text-sm font-mono px-2 py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--c-muted)] w-5 text-right shrink-0">{entry.position}.</span>
                      <span className="text-[var(--c-secondary)] truncate">{entry.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span style={{ color: entry.rankColor }} className="text-xs">
                        {rank.icon} {entry.rankLabel}
                      </span>
                      <span className="text-[var(--c-muted)] text-xs w-12 text-right">
                        {entry.rankPoints}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
