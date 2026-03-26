'use client';

import { useState, useEffect, useRef } from 'react';
import { getRankFromPoints, H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import type { H2HRank } from '@/lib/h2h';
import { ACHIEVEMENTS, RARITY_BADGE_CLASS, type AchievementRarity } from '@/lib/achievements';
import { LevelMeter } from './LevelMeter';
import { playVictory, playDefeat, playLevelUp } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { usePlayer } from '@/lib/usePlayer';
import { useSigint } from '@/lib/SigintContext';

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
  myBadgeName: string | null;
  oppBadgeIcon: string | null;
  oppBadgeName: string | null;
  myBadgeRarity: AchievementRarity | null;
  oppBadgeRarity: AchievementRarity | null;
  oppThemeColor: string;
  myCards: number;
  oppCards: number;
  myTimeMs: number;
  oppTimeMs: number;
  myEliminated: boolean;
  oppEliminated: boolean;
  oppPointsDelta: number | null;
  myPointsDeltaFromServer: number | null;
  serverWinnerId: string | null;
}

interface StatsData {
  rankPoints: number;
  rank: H2HRank;
  winStreak: number;
  wins: number;
  losses: number;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

// playerSummary removed — scoreboard now uses inline JSX with real names

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

  // XP bar
  const { profile, refreshProfile } = usePlayer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewCards, setReviewCards] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myAnswers, setMyAnswers] = useState<any[]>([]);

  const { soundEnabled } = useSoundEnabled();
  const { triggerSigint } = useSigint();

  // Prefer server-fetched winnerId over client prop (client passes null for eliminations/forfeits)
  const resolvedWinnerId = matchData?.serverWinnerId ?? winnerId;
  const isWin = resolvedWinnerId === playerId;
  const isLoss = resolvedWinnerId !== null && resolvedWinnerId !== playerId;
  const noResult = resolvedWinnerId === null;

  // SIGINT: PvP result moments (non-bot only, fire once per mount)
  // Multiple can fire — SigintContext queue shows them one at a time.
  const sigintFired = useRef(false);
  useEffect(() => {
    if (!matchData || !stats || isBot || sigintFired.current) return;
    sigintFired.current = true;

    if (isWin) {
      if (matchData.myCards === H2H_CARDS_PER_MATCH) triggerSigint('perfect_match');
      triggerSigint('first_pvp_win');
      if (stats.winStreak >= 5) triggerSigint('win_streak_5');
      else if (stats.winStreak >= 3) triggerSigint('win_streak_3');
      // Comeback: won this one with winStreak === 1 (just broke a losing run)
      if (stats.winStreak === 1 && stats.losses > 0) triggerSigint('comeback_win');
      // Rank milestones
      if (stats.rankPoints >= 250) triggerSigint('rank_up_gold');
      else if (stats.rankPoints >= 100) triggerSigint('rank_up_silver');
    } else if (isLoss) {
      if (reason === 'eliminated') triggerSigint('first_elimination');
      triggerSigint('first_pvp_loss');
    }
  }, [matchData, stats, isWin, isLoss, isBot, reason, triggerSigint]);

  // Play victory/defeat sound when server data resolves the winner
  const soundPlayed = useRef(false);
  useEffect(() => {
    if (soundPlayed.current || !soundEnabled) return;
    // Wait for server data before playing sound (resolvedWinnerId may change)
    if (!matchData && !isBot) return;
    soundPlayed.current = true;
    if (isWin) playVictory();
    else if (!isBot) playDefeat();
  }, [matchData, isWin, isBot, soundEnabled]);

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

          const myAch = myBadgeId ? ACHIEVEMENTS.find(a => a.id === myBadgeId) : null;
          const oppAch = oppBadgeId ? ACHIEVEMENTS.find(a => a.id === oppBadgeId) : null;

          setMatchData({
            myName: myPlayer?.displayName ?? 'YOU',
            oppName: oppPlayer?.displayName ?? 'OPPONENT',
            myBadgeIcon: myAch?.icon ?? null,
            myBadgeName: myAch?.name ?? null,
            oppBadgeIcon: oppAch?.icon ?? null,
            oppBadgeName: oppAch?.name ?? null,
            myBadgeRarity: myAch?.rarity ?? null,
            oppBadgeRarity: oppAch?.rarity ?? null,
            oppThemeColor: oppPlayer?.themeColor ?? '#00ff41',
            myCards,
            oppCards,
            myTimeMs,
            oppTimeMs,
            myEliminated: !isWin && reason === 'eliminated',
            oppEliminated: isWin && oppCards < H2H_CARDS_PER_MATCH,
            oppPointsDelta: oppPointsDelta ?? null,
            myPointsDeltaFromServer: serverMyDelta ?? null,
            serverWinnerId: m.winnerId ?? null,
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
            wins: s.wins ?? 0,
            losses: s.losses ?? 0,
          });
        }
      } catch {
        // silently handle — UI will show what it can
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Refresh profile to get updated XP after match
          refreshProfile();
        }
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
  const headerText = isWin ? 'VICTORY' : (isBot || isLoss) ? 'DEFEATED' : 'MATCH OVER';
  const headerColor = isWin ? 'text-[var(--c-primary)]' : (isBot || isLoss) ? 'text-[#ff3333]' : 'text-[var(--c-muted)]';

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
  const deltaSign = effectiveDelta >= 0 ? '+' : '';
  const deltaColor = effectiveDelta >= 0 ? 'text-[var(--c-primary)]' : 'text-[#ff3333]';

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
        <div className="w-full term-border p-4 space-y-3">
          {/* You */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {matchData.myBadgeIcon && <span className={`text-lg text-[var(--c-primary)] ${matchData.myBadgeRarity ? RARITY_BADGE_CLASS[matchData.myBadgeRarity] : ''}`}>{matchData.myBadgeIcon}</span>}
              <div className="min-w-0">
                <div className="text-[var(--c-primary)] font-bold text-sm truncate">{matchData.myName}</div>
                {matchData.myBadgeName && <div className="text-[var(--c-accent)] text-[10px] tracking-widest">{matchData.myBadgeName}</div>}
              </div>
            </div>
            <span className={`text-xs font-mono shrink-0 ${matchData.myEliminated ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}`}>
              {matchData.myEliminated
                ? `${matchData.myCards}/${H2H_CARDS_PER_MATCH} eliminated`
                : `${matchData.myCards}/${H2H_CARDS_PER_MATCH} · ${formatTime(matchData.myTimeMs)}`
              }
            </span>
          </div>
          {/* Opponent */}
          {!isBot ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {matchData.oppBadgeIcon && <span className={`text-lg ${matchData.oppBadgeRarity ? RARITY_BADGE_CLASS[matchData.oppBadgeRarity] : ''}`} style={{ color: matchData.oppThemeColor }}>{matchData.oppBadgeIcon}</span>}
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: matchData.oppThemeColor }}>{matchData.oppName}</div>
                  {matchData.oppBadgeName && <div className="text-[10px] tracking-widest" style={{ color: matchData.oppThemeColor, opacity: 0.7 }}>{matchData.oppBadgeName}</div>}
                </div>
              </div>
              <span className={`text-xs font-mono shrink-0 ${matchData.oppEliminated ? 'text-[#ff3333]' : 'text-[var(--c-secondary)]'}`}>
                {matchData.oppEliminated
                  ? `${matchData.oppCards}/${H2H_CARDS_PER_MATCH} eliminated`
                  : `${matchData.oppCards}/${H2H_CARDS_PER_MATCH} · ${formatTime(matchData.oppTimeMs)}`
                }
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[var(--c-muted)] text-sm">BOT</span>
              <span className="text-[var(--c-muted)] text-xs">practice match</span>
            </div>
          )}
        </div>
      )}

      {/* Rank + Points */}
      {isBot ? (
        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-muted)_30%,transparent)] px-4 py-3 text-center space-y-1">
          <p className="text-sm text-[var(--c-muted)] tracking-widest font-mono">PRACTICE MATCH</p>
          <p className="text-xs text-[var(--c-muted)] font-mono">No XP, rank points, or stats awarded. Play against a real opponent for ranked rewards.</p>
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
            <span className="text-[var(--c-secondary)]">{stats.rankPoints} pts</span>
            {' '}
            <span className={deltaColor}>({deltaSign}{effectiveDelta})</span>
          </p>
          {rankedUp && (
            <p className="mt-2 text-sm font-bold" style={{ color: newRank.color }}>
              RANK UP! {newRank.label.toUpperCase()}
            </p>
          )}
        </div>
      ) : null}

      {/* XP Bar */}
      {profile && !isBot && (
        <div className="w-full term-border p-3">
          <LevelMeter xp={profile.xp} level={profile.level} />
        </div>
      )}

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
          className="flex-1 py-3 term-border text-sm font-mono tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
        >
          [ QUEUE AGAIN ]
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 term-border text-sm font-mono tracking-widest text-[var(--c-secondary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
        >
          [ BACK ]
        </button>
      </div>
    </div>
  );
}
