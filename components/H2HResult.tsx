'use client';

import { useState, useEffect } from 'react';
import { getRankFromPoints, H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import type { H2HRank } from '@/lib/h2h';
import { ACHIEVEMENTS } from '@/lib/achievements';

interface Props {
  matchId: string;
  playerId: string;
  winnerId: string | null;
  myPointsDelta: number;
  isBot: boolean;
  reason: string; // 'completed' | 'eliminated' | 'forfeit'
  onRematch: () => void;
  onBack: () => void;
}

interface MatchData {
  myName: string;
  oppName: string;
  myBadgeIcon: string | null;
  oppBadgeIcon: string | null;
  oppThemeColor: string;
  myCards: number;
  oppCards: number;
  myTimeMs: number;
  oppTimeMs: number;
  myEliminated: boolean;
  oppEliminated: boolean;
  oppPointsDelta: number | null;
  myPointsDeltaFromServer: number | null;
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
  isBot,
  reason,
  onRematch,
  onBack,
}: Props) {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewCards, setReviewCards] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myAnswers, setMyAnswers] = useState<any[]>([]);

  // winnerId is the source of truth — reason is just for display flavor
  const isWin = winnerId === playerId;
  const isLoss = winnerId !== null && winnerId !== playerId;
  const noResult = winnerId === null; // bot match wrong answer

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
          const serverMyDelta = isP1 ? m.player1PointsDelta : m.player2PointsDelta;

          const myPlayer = data.players[playerId];
          const oppPlayer = data.players[oppId];
          const myBadgeId = myPlayer?.featuredBadge ?? null;
          const oppBadgeId = oppPlayer?.featuredBadge ?? null;

          setMatchData({
            myName: myPlayer?.displayName ?? 'YOU',
            oppName: oppPlayer?.displayName ?? 'OPPONENT',
            myBadgeIcon: myBadgeId ? (ACHIEVEMENTS.find(a => a.id === myBadgeId)?.icon ?? null) : null,
            oppBadgeIcon: oppBadgeId ? (ACHIEVEMENTS.find(a => a.id === oppBadgeId)?.icon ?? null) : null,
            oppThemeColor: oppPlayer?.themeColor ?? '#00ff41',
            myCards,
            oppCards,
            myTimeMs,
            oppTimeMs,
            myEliminated: !isWin && reason === 'eliminated',
            oppEliminated: isWin && oppCards < H2H_CARDS_PER_MATCH,
            oppPointsDelta: oppPointsDelta ?? null,
            myPointsDeltaFromServer: serverMyDelta ?? null,
          });

          // Store review cards and player's answers
          if (data.reviewCards) setReviewCards(data.reviewCards);
          const playerAnswers = (data.answers ?? []).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => a.playerId === playerId
          );
          setMyAnswers(playerAnswers);
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

  // Derive old rank from current points minus delta (prefer server-computed delta)
  const effectiveDelta = matchData?.myPointsDeltaFromServer ?? myPointsDelta;
  const oldPoints = stats ? stats.rankPoints - effectiveDelta : 0;
  const oldRank = getRankFromPoints(Math.max(0, oldPoints));
  const newRank = stats?.rank ?? getRankFromPoints(0);
  const rankedUp = newRank.tier !== oldRank.tier && effectiveDelta > 0;

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
            {matchData.myBadgeIcon && <span className="mr-1">{matchData.myBadgeIcon}</span>}
            {playerSummary('YOU', matchData.myCards, matchData.myTimeMs, matchData.myEliminated)}
          </p>
          <p className="mt-1" style={{ color: matchData.oppThemeColor }}>
            {matchData.oppBadgeIcon && <span className="mr-1">{matchData.oppBadgeIcon}</span>}
            {playerSummary('OPP', matchData.oppCards, matchData.oppTimeMs, matchData.oppEliminated)}
          </p>
        </div>
      )}

      {/* Rank + Points */}
      {isBot ? (
        <div className="text-center">
          <p className="text-sm text-[var(--c-muted)]">UNRATED</p>
          <p className="text-xs text-[var(--c-muted)] mt-1">Bot match — no points change</p>
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

      {/* Review cards */}
      {reviewCards.length > 0 && (
        <div className="w-full">
          <button
            onClick={() => setShowReview(!showReview)}
            className="w-full py-2 text-sm font-mono tracking-widest text-[var(--c-secondary)] hover:text-[var(--c-primary)] active:scale-[0.98] transition-all"
          >
            {showReview ? '[ HIDE REVIEW ]' : '[ REVIEW EMAILS ]'}
          </button>
          {showReview && (
            <div className="space-y-3 mt-2">
              {reviewCards.filter((card) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                myAnswers.some((a: any) => a.cardIndex === card.index)
              ).map((card) => {
                const answer = myAnswers.find(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (a: any) => a.cardIndex === card.index
                );
                const correct = answer?.correct ?? false;

                return (
                  <div
                    key={card.index}
                    className={`term-border bg-[var(--c-bg)] ${
                      correct ? 'border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)]' :
                      'border-[rgba(255,51,51,0.4)]'
                    }`}
                  >
                    <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[var(--c-muted)] text-xs tracking-widest">
                        CARD {card.index + 1}/{reviewCards.length}
                      </span>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className={correct ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}>
                          {correct ? 'CORRECT' : 'WRONG'}
                        </span>
                        <span className={card.isPhishing ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}>
                          {card.isPhishing ? 'PHISHING' : 'LEGIT'}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-sm font-mono">
                      <div className="flex gap-2">
                        <span className="text-[var(--c-muted)] w-10 shrink-0">FROM:</span>
                        <span className="text-[var(--c-secondary)] break-all">{card.from}</span>
                      </div>
                      {card.subject && (
                        <div className="flex gap-2">
                          <span className="text-[var(--c-muted)] w-10 shrink-0">SUBJ:</span>
                          <span className="text-[var(--c-secondary)]">{card.subject}</span>
                        </div>
                      )}
                    </div>
                    {card.explanation && (
                      <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] px-3 py-2">
                        <p className="text-[var(--c-muted)] text-xs font-mono leading-relaxed">{card.explanation}</p>
                      </div>
                    )}
                    {card.isPhishing && card.technique && (
                      <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] px-3 py-1.5">
                        <span className="text-[#ff3333] text-xs font-mono tracking-widest">
                          TECHNIQUE: {card.technique.toUpperCase().replace(/-/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
