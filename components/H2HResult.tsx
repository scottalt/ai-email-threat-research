'use client';

import { useState, useEffect } from 'react';
import { getRankFromPoints, H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import type { H2HRank } from '@/lib/h2h';

interface Props {
  matchId: string;
  playerId: string;
  winnerId: string | null;
  myPointsDelta: number;
  isGhost: boolean;
  reason: string; // 'completed' | 'eliminated' | 'forfeit'
  onRematch: () => void;
  onBack: () => void;
}

interface MatchData {
  myName: string;
  oppName: string;
  myCards: number;
  oppCards: number;
  myTimeMs: number;
  oppTimeMs: number;
  myEliminated: boolean;
  oppEliminated: boolean;
  oppPointsDelta: number | null;
}

interface StatsData {
  rankPoints: number;
  rank: H2HRank;
  winStreak: number;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

function playerSummary(
  label: string,
  cards: number,
  timeMs: number,
  eliminated: boolean,
): string {
  if (eliminated) return `${label}: ${cards}/${H2H_CARDS_PER_MATCH} (eliminated)`;
  return `${label}: ${cards}/${H2H_CARDS_PER_MATCH} (${formatTime(timeMs)})`;
}

export function H2HResult({
  matchId,
  playerId,
  winnerId,
  myPointsDelta,
  isGhost,
  reason,
  onRematch,
  onBack,
}: Props) {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // winnerId is the source of truth — reason is just for display flavor
  const isWin = winnerId === playerId;
  const isLoss = winnerId !== null && winnerId !== playerId;
  const noResult = winnerId === null; // ghost match wrong answer

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [matchRes, statsRes] = await Promise.all([
          fetch(`/api/h2h/match/${matchId}`),
          fetch('/api/h2h/stats'),
        ]);

        if (cancelled) return;

        if (matchRes.ok) {
          const data = await matchRes.json();
          const m = data.match;
          const isP1 = m.player1Id === playerId;
          const myCards = isP1 ? m.player1CardsCompleted : m.player2CardsCompleted;
          const oppCards = isP1 ? m.player2CardsCompleted : m.player1CardsCompleted;
          const myTimeMs = isP1 ? m.player1TimeMs : m.player2TimeMs;
          const oppTimeMs = isP1 ? m.player2TimeMs : m.player1TimeMs;
          const oppId = isP1 ? m.player2Id : m.player1Id;
          const oppPointsDelta = isP1 ? m.player2PointsDelta : m.player1PointsDelta;

          setMatchData({
            myName: data.players[playerId] ?? 'YOU',
            oppName: data.players[oppId] ?? 'OPPONENT',
            myCards,
            oppCards,
            myTimeMs,
            oppTimeMs,
            myEliminated: !isWin && reason === 'eliminated',
            oppEliminated: isWin && oppCards < H2H_CARDS_PER_MATCH,
            oppPointsDelta: oppPointsDelta ?? null,
          });
        }

        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats({
            rankPoints: s.rankPoints,
            rank: getRankFromPoints(s.rankPoints),
            winStreak: s.winStreak ?? 0,
          });
        }
      } catch {
        // silently handle — UI will show what it can
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [matchId, playerId, isWin, reason]);

  // Derive old rank from current points minus delta
  const oldPoints = stats ? stats.rankPoints - myPointsDelta : 0;
  const oldRank = getRankFromPoints(Math.max(0, oldPoints));
  const newRank = stats?.rank ?? getRankFromPoints(0);
  const rankedUp = newRank.tier !== oldRank.tier && myPointsDelta > 0;

  // Header
  const headerText = isWin ? 'VICTORY' : noResult ? 'MATCH OVER' : 'DEFEATED';
  const headerColor = isWin ? 'text-[var(--c-primary)]' : noResult ? 'text-[var(--c-muted)]' : 'text-[#ff3333]';

  // Subtitle
  let subtitle = '';
  if (matchData) {
    if (isWin) {
      subtitle = `${matchData.myCards}/${H2H_CARDS_PER_MATCH} correct in ${formatTime(matchData.myTimeMs)}`;
    } else if (reason === 'eliminated') {
      subtitle = `Wrong answer on card ${matchData.myCards + 1}/${H2H_CARDS_PER_MATCH}`;
    } else if (reason === 'forfeit') {
      subtitle = 'Match forfeited';
    } else {
      subtitle = `${matchData.myCards}/${H2H_CARDS_PER_MATCH} correct in ${formatTime(matchData.myTimeMs)}`;
    }
  }

  // Points display
  const deltaSign = myPointsDelta >= 0 ? '+' : '';
  const deltaColor = myPointsDelta >= 0 ? 'text-[var(--c-primary)]' : 'text-[#ff3333]';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 font-mono">
        <p className="text-[var(--c-muted)] animate-pulse">LOADING RESULTS...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-6 font-mono max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className={`text-2xl font-bold tracking-wider ${headerColor}`}>
          {headerText}
        </h2>
        {subtitle && (
          <p className="text-sm text-[var(--c-muted)] mt-1">{subtitle}</p>
        )}
      </div>

      {/* Scoreboard */}
      {matchData && (
        <div className="w-full border border-[var(--c-border)] p-3 text-sm">
          <p className="text-[var(--c-fg)]">
            {playerSummary('YOU', matchData.myCards, matchData.myTimeMs, matchData.myEliminated)}
          </p>
          <p className="text-[var(--c-muted)] mt-1">
            {playerSummary('OPP', matchData.oppCards, matchData.oppTimeMs, matchData.oppEliminated)}
          </p>
        </div>
      )}

      {/* Rank + Points */}
      {isGhost ? (
        <div className="text-center">
          <p className="text-sm text-[var(--c-muted)]">UNRATED</p>
          <p className="text-xs text-[var(--c-muted)] mt-1">Ghost match — no points change</p>
        </div>
      ) : stats ? (
        <div className="text-center text-sm">
          <p>
            <span style={{ color: oldRank.color }}>{oldRank.label.toUpperCase()}</span>
            {' → '}
            <span style={{ color: newRank.color }}>{newRank.label.toUpperCase()}</span>
          </p>
          <p className="mt-1">
            <span className="text-[var(--c-muted)]">{Math.max(0, oldPoints)} pts</span>
            {' → '}
            <span className="text-[var(--c-fg)]">{stats.rankPoints} pts</span>
            {' '}
            <span className={deltaColor}>({deltaSign}{myPointsDelta})</span>
          </p>
          {rankedUp && (
            <p className="mt-2 text-sm font-bold" style={{ color: newRank.color }}>
              RANK UP! {newRank.label.toUpperCase()}
            </p>
          )}
        </div>
      ) : null}

      {/* Win streak */}
      {isWin && stats && stats.winStreak >= 2 && (
        <div className="text-center">
          <span className="text-[var(--c-primary)] text-sm font-mono font-bold">{stats.winStreak}-WIN STREAK</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onRematch}
          className="px-4 py-3 text-sm font-mono border border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-[var(--c-bg)] active:scale-95 transition-all"
        >
          QUEUE AGAIN
        </button>
        <button
          onClick={onBack}
          className="px-4 py-3 text-sm font-mono border border-[var(--c-border)] text-[var(--c-muted)] hover:text-[var(--c-fg)] hover:border-[var(--c-fg)] active:scale-95 transition-all"
        >
          TERMINAL
        </button>
      </div>
    </div>
  );
}
