'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { SafeDealCard } from '@/lib/card-utils';
import { parseFrom } from '@/lib/parseFrom';
import { H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  subscribeToMatch,
  broadcastProgress,
  broadcastResult,
  broadcastReady,
  unsubscribeFromMatch,
} from '@/lib/h2h-realtime';
import type { MatchProgressEvent, MatchResultEvent } from '@/lib/h2h-realtime';
import { ACHIEVEMENTS, RARITY_BADGE_CLASS, type AchievementRarity } from '@/lib/achievements';
import { playOpponentDown, playCountdownBeep, playCountdownGo } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  matchId: string;
  playerId: string;
  isBot: boolean;
  onMatchEnd: (result: {
    winnerId: string | null;
    myPointsDelta: number;
    opponentPointsDelta: number;
    reason: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Body parser (URLs / markdown links)
// ---------------------------------------------------------------------------

type Segment =
  | { type: 'text'; content: string }
  | { type: 'url'; display: string; actual: string };

function parseBody(text: string): Segment[] {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s]+)/g;
  const segments: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) });
    }
    if (match[1] && match[2]) {
      segments.push({ type: 'url', display: match[1], actual: match[2] });
    } else {
      segments.push({ type: 'url', display: match[3], actual: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Progress squares component
// ---------------------------------------------------------------------------

function ProgressSquares({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  return (
    <span className="font-mono tracking-wider">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < completed
              ? 'text-[var(--c-primary)] anim-square-fill'
              : 'text-[var(--c-dark)]'
          }
        >
          {i < completed ? '\u25A0' : '\u25A1'}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Card display (simplified from GameCard's EmailDisplay/SMSDisplay)
// ---------------------------------------------------------------------------

function CardDisplay({ card }: { card: SafeDealCard }) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [showFromEmail, setShowFromEmail] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  const urlInspectorRef = (el: HTMLDivElement | null) => {
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  function toggleUrl(url: string) {
    setInspectedUrl((prev) => (prev === url ? null : url));
  }

  const segments = parseBody(card.body);
  const { displayName, email } = parseFrom(card.from);
  const isEmail = card.type === 'email';

  useEffect(() => {
    const el = bodyRef.current;
    if (el) setBodyOverflows(el.scrollHeight > el.clientHeight);
  }, [card.body]);

  return (
    <div className="term-border bg-[var(--c-bg)] select-none scanline">
      {/* Header bar */}
      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between">
        <span className="text-[var(--c-secondary)] text-sm tracking-widest">
          {isEmail ? 'INCOMING_EMAIL' : 'INCOMING_SMS'}
        </span>
        <span className="text-[var(--c-dark)] text-sm font-mono">{'\u25A0'} {'\u25A1'} {'\u25A1'}</span>
      </div>

      {/* Metadata rows */}
      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] space-y-1">
        <div className="flex gap-2 text-sm">
          <span className="text-[var(--c-secondary)] w-10 shrink-0">FROM:</span>
          <span className="text-[var(--c-primary)] font-mono">
            {isEmail && displayName ? (
              <>
                <span className="break-all">{displayName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFromEmail((o) => !o); }}
                  className="ml-1 text-sm text-[var(--c-dark)] hover:text-[#ffaa00] active:scale-95 transition-all"
                  aria-label={showFromEmail ? 'Hide sender email address' : 'Show sender email address'}
                >
                  {showFromEmail ? '[\u2212]' : '[\u2197]'}
                </button>
                {showFromEmail && (
                  <span className="block text-[#ffaa00] text-sm break-all mt-0.5">&lt;{email}&gt;</span>
                )}
              </>
            ) : (
              <span className="break-all">{email}</span>
            )}
          </span>
        </div>
        {card.subject && (
          <div className="flex gap-2 text-sm">
            <span className="text-[var(--c-secondary)] w-10 shrink-0">SUBJ:</span>
            <span className="text-[var(--c-primary)] font-mono">{card.subject}</span>
          </div>
        )}
        {card.attachmentName && (
          <div className="flex gap-2 text-sm">
            <span className="text-[var(--c-secondary)] w-10 shrink-0">ATCH:</span>
            <span className="text-[#ffaa00] font-mono">{card.attachmentName}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative">
        <div
          ref={bodyRef}
          className={`px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap break-words font-mono ${bodyExpanded ? '' : 'max-h-52 lg:max-h-none momentum-scroll lg:overflow-auto scroll-fade-bottom lg:scroll-fade-none'}`}
        >
          {segments.map((seg, i) =>
            seg.type === 'url' ? (
              <span
                key={i}
                className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleUrl(seg.actual); }}
              >
                {seg.display}
                <span className="opacity-50 text-sm ml-0.5">
                  {inspectedUrl === seg.actual ? '[\u2212]' : '[\u2197]'}
                </span>
              </span>
            ) : (
              <span key={i}>{seg.content}</span>
            ),
          )}
        </div>
        {(bodyOverflows || bodyExpanded) && (
          <button
            onClick={(e) => { e.stopPropagation(); setBodyExpanded((o) => !o); }}
            className="lg:hidden w-full py-3 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] active:scale-95 text-xs font-mono tracking-widest transition-all"
          >
            {bodyExpanded ? '[ COLLAPSE ]' : '[ EXPAND ]'}
          </button>
        )}
      </div>

      {/* URL inspector */}
      {inspectedUrl && (
        <div ref={urlInspectorRef} className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
            <button
              onClick={() => setInspectedUrl(null)}
              className="text-[var(--c-dark)] text-sm font-mono hover:text-[var(--c-secondary)] active:scale-95 transition-all p-2 -m-2"
              aria-label="Close URL inspector"
            >
              [ x ]
            </button>
          </div>
          <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
        </div>
      )}
      <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] px-3 py-1.5">
        <p className="text-[var(--c-muted)] text-[9px] font-mono opacity-50 text-center">AI-generated for research. Brand names used for realism only — no affiliation.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function H2HMatch({ matchId, playerId, isBot, onMatchEnd }: Props) {
  const { soundEnabled } = useSoundEnabled();
  // ── Card / match state ──
  const [cards, setCards] = useState<SafeDealCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Opponent state ──
  const [myName, setMyName] = useState<string>('YOU');
  const [opponentName, setOpponentName] = useState<string>('OPPONENT');
  const [opponentIndex, setOpponentIndex] = useState(0);
  const [opponentEliminated, setOpponentEliminated] = useState(false);
  const [opponentBadgeIcon, setOpponentBadgeIcon] = useState<string | null>(null);
  const [opponentBadgeName, setOpponentBadgeName] = useState<string | null>(null);
  const [opponentBadgeRarity, setOpponentBadgeRarity] = useState<AchievementRarity | null>(null);
  const [opponentThemeColor, setOpponentThemeColor] = useState<string>('#00ff41');
  const [myBadgeIcon, setMyBadgeIcon] = useState<string | null>(null);
  const [myBadgeName, setMyBadgeName] = useState<string | null>(null);
  const [myBadgeRarity, setMyBadgeRarity] = useState<AchievementRarity | null>(null);

  // ── Ready-up lobby ──
  const [ready, setReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);

  // ── Player state ──
  const [eliminated, setEliminated] = useState(false);
  const [eliminatedAt, setEliminatedAt] = useState<number>(0);
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  // playingItOut removed — elimination goes straight to result screen
  const [submitting, setSubmitting] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [afkWarning, setAfkWarning] = useState<number | null>(null); // seconds remaining before AFK forfeit

  // ── Timing ──
  const renderTime = useRef<number>(Date.now());

  // ── Refs for callbacks that need latest state ──
  const matchEndedRef = useRef(false);
  const isPlayer1Ref = useRef(true);
  const opponentIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Reset render timer + scroll to top when card changes
  useEffect(() => {
    renderTime.current = Date.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [cardIndex]);

  // ── Handle incoming match result (from realtime or API) ──
  const handleMatchResult = useCallback(
    (event: MatchResultEvent) => {
      if (matchEndedRef.current) return;
      matchEndedRef.current = true;

      onMatchEnd({
        winnerId: event.winnerId,
        myPointsDelta: isPlayer1Ref.current ? event.player1PointsDelta : event.player2PointsDelta,
        opponentPointsDelta: isPlayer1Ref.current ? event.player2PointsDelta : event.player1PointsDelta,
        reason: event.reason,
      });
    },
    [onMatchEnd],
  );

  // ── Mount: fetch cards + match state, subscribe to realtime ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Fetch cards and match state in parallel
        const [cardsRes, matchRes] = await Promise.all([
          fetch(`/api/h2h/cards?matchId=${matchId}`),
          fetch(`/api/h2h/match/${matchId}`),
        ]);

        if (cancelled) return;

        if (!cardsRes.ok) {
          setError('Failed to load match cards');
          setLoading(false);
          return;
        }
        if (!matchRes.ok) {
          setError('Failed to load match state');
          setLoading(false);
          return;
        }

        const cardsData: SafeDealCard[] = await cardsRes.json();
        const matchData = await matchRes.json();

        if (cancelled) return;

        setCards(cardsData);

        // Determine opponent name and badges
        const isPlayer1 = playerId === matchData.match.player1Id;
        isPlayer1Ref.current = isPlayer1;
        const opponentId = isPlayer1
          ? matchData.match.player2Id
          : matchData.match.player1Id;
        opponentIdRef.current = opponentId;

        if (opponentId && matchData.players[opponentId]) {
          const opp = matchData.players[opponentId];
          setOpponentName(opp.displayName);
          if (opp.themeColor) setOpponentThemeColor(opp.themeColor);
          if (opp.featuredBadge) {
            const oppAch = ACHIEVEMENTS.find(a => a.id === opp.featuredBadge);
            setOpponentBadgeIcon(oppAch?.icon ?? null);
            setOpponentBadgeName(oppAch?.name ?? null);
            setOpponentBadgeRarity(oppAch?.rarity ?? null);
          }
        } else if (isBot) {
          const { getRandomBotName } = await import('@/lib/h2h');
          setOpponentName(getRandomBotName());
        }

        // Set own name + badge
        const me = matchData.players[playerId];
        if (me?.displayName) setMyName(me.displayName);
        if (me?.featuredBadge) {
          const myAch = ACHIEVEMENTS.find(a => a.id === me.featuredBadge);
          setMyBadgeIcon(myAch?.icon ?? null);
          setMyBadgeName(myAch?.name ?? null);
          setMyBadgeRarity(myAch?.rarity ?? null);
        }

        // Restore progress if reconnecting
        const myCompleted = isPlayer1
          ? matchData.match.player1CardsCompleted
          : matchData.match.player2CardsCompleted;
        const oppCompleted = isPlayer1
          ? matchData.match.player2CardsCompleted
          : matchData.match.player1CardsCompleted;

        if (myCompleted > 0) {
          setCardIndex(myCompleted);
        }
        if (oppCompleted > 0) {
          setOpponentIndex(oppCompleted);
        }

        // Check if match is already complete
        if (matchData.match.status === 'complete') {
          const myDelta = isPlayer1
            ? matchData.match.player1PointsDelta ?? 0
            : matchData.match.player2PointsDelta ?? 0;
          const oppDelta = isPlayer1
            ? matchData.match.player2PointsDelta ?? 0
            : matchData.match.player1PointsDelta ?? 0;

          if (!matchEndedRef.current) {
            matchEndedRef.current = true;
            onMatchEnd({
              winnerId: matchData.match.winnerId,
              myPointsDelta: myDelta,
              opponentPointsDelta: oppDelta,
              reason: 'completed',
            });
          }
          return;
        }

        // Subscribe to realtime (skip for bot matches — no opponent to listen to)
        if (!isBot) {
          try {
            channelRef.current = subscribeToMatch(
              matchId,
              playerId,
              (event: MatchProgressEvent) => {
                // Validate event is from the actual opponent (prevents spoofed events)
                if (opponentIdRef.current && event.playerId !== opponentIdRef.current) return;
                setOpponentIndex(event.cardIndex + 1);
              },
              handleMatchResult,
              () => setOpponentReady(true), // opponent ready callback
            );
          } catch (rtErr) {
            // Realtime failure is non-fatal — match still works, just no live opponent updates
            console.warn('[H2H] Realtime subscription failed:', rtErr);
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      unsubscribeFromMatch(channelRef.current);
      channelRef.current = null;
    };
  }, [matchId, playerId, isBot, onMatchEnd, handleMatchResult]);

  // ── Poll match state as Realtime fallback (every 3s for real matches) ──
  useEffect(() => {
    if (isBot || loading || matchEndedRef.current) return;

    const interval = setInterval(async () => {
      if (matchEndedRef.current) { clearInterval(interval); return; }
      try {
        const res = await fetch(`/api/h2h/match/${matchId}`);
        if (!res.ok) return;
        const data = await res.json();
        const m = data.match;

        // Update opponent progress from server
        const isP1 = playerId === m.player1Id;
        const oppCards = isP1 ? m.player2CardsCompleted : m.player1CardsCompleted;
        if (oppCards > 0) setOpponentIndex(oppCards);

        // Match finalized or cancelled on server — end it
        if ((m.status === 'complete' || m.status === 'cancelled') && !matchEndedRef.current) {
          matchEndedRef.current = true;
          clearInterval(interval);

          if (m.status === 'cancelled') {
            // Both players AFK — no winner, no rank changes
            onMatchEnd({
              winnerId: null,
              myPointsDelta: 0,
              opponentPointsDelta: 0,
              reason: 'completed',
            });
          } else {
            const myDelta = isP1 ? (m.player1PointsDelta ?? 0) : (m.player2PointsDelta ?? 0);
            const oppDelta = isP1 ? (m.player2PointsDelta ?? 0) : (m.player1PointsDelta ?? 0);
            onMatchEnd({
              winnerId: m.winnerId,
              myPointsDelta: myDelta,
              opponentPointsDelta: oppDelta,
              reason: m.winnerId === playerId ? 'completed' : 'eliminated',
            });
          }
        }
      } catch {
        // polling failure is non-fatal
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [matchId, playerId, isBot, loading, onMatchEnd]);

  // ── AFK warning countdown (visual only — server enforces the timeout) ──
  useEffect(() => {
    if (isBot || loading || eliminated || finished || matchEndedRef.current) {
      setAfkWarning(null);
      return;
    }
    const AFK_WARN_AFTER_MS = 60_000; // show warning after 60s
    const AFK_TOTAL_MS = 90_000;      // server forfeits at 90s

    const interval = setInterval(() => {
      const elapsed = Date.now() - renderTime.current;
      if (elapsed > AFK_WARN_AFTER_MS) {
        const remaining = Math.max(0, Math.ceil((AFK_TOTAL_MS - elapsed) / 1000));
        setAfkWarning(remaining);
      } else {
        setAfkWarning(null);
      }
    }, 1000);

    return () => { clearInterval(interval); setAfkWarning(null); };
  }, [isBot, loading, eliminated, finished, cardIndex]);

  // ── Bot opponent simulation ──
  // Simulates a realistic human opponent: variable speed, hesitation, mistakes
  useEffect(() => {
    if (!isBot || loading || eliminated || finished || cards.length === 0) return;

    // ── Personality: randomize bot behavior per match ──
    // Some bots are fast+reckless, others are slow+careful
    const speedFactor = 0.7 + Math.random() * 0.6; // 0.7x (fast) to 1.3x (slow)

    // ── Per-card timing: realistic human reading patterns ──
    const botTimes = cards.map((card) => {
      const len = card.body.length;
      let baseMs: number;
      if (len < 300) baseMs = 4000 + Math.random() * 5000;       // 4-9s
      else if (len < 600) baseMs = 7000 + Math.random() * 7000;  // 7-14s
      else baseMs = 10000 + Math.random() * 10000;                // 10-20s

      // Apply personality speed factor
      baseMs *= speedFactor;

      // Occasional hesitation: 20% chance the bot pauses an extra 2-5s on a card
      // (like a real player re-reading something suspicious)
      if (Math.random() < 0.2) {
        baseMs += 2000 + Math.random() * 3000;
      }

      return baseMs;
    });

    // ── Failure: ~30% chance the bot gets eliminated somewhere ──
    // Later cards are harder — cumulative fail chance increases
    let botEliminationCard = -1;
    for (let i = 0; i < cards.length; i++) {
      const len = cards[i].body.length;
      // Base fail chance + increases on later cards (fatigue/complexity)
      const cardPositionBonus = i * 0.02; // +2% per card position
      const failChance = (len < 300 ? 0.04 : len < 600 ? 0.07 : 0.11) + cardPositionBonus;
      if (Math.random() < failChance) {
        botEliminationCard = i;
        break;
      }
    }

    let totalElapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < H2H_CARDS_PER_MATCH; i++) {
      totalElapsed += botTimes[i];

      if (i === botEliminationCard) {
        // Bot gets eliminated — add a small "thinking" delay before the wrong answer
        const thinkDelay = 1000 + Math.random() * 2000;
        const t = setTimeout(() => {
          setOpponentIndex(i + 1);
          setOpponentEliminated(true);
          // Bot eliminated — player wins, end match after brief pause
          setTimeout(() => {
            if (!matchEndedRef.current) {
              matchEndedRef.current = true;
              try {
                fetch(`/api/h2h/match/${matchId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'complete', winnerId: playerId }),
                  keepalive: true,
                });
              } catch { /* best effort */ }
              onMatchEnd({
                winnerId: playerId,
                myPointsDelta: 0,
                opponentPointsDelta: 0,
                reason: 'eliminated',
              });
            }
          }, 1500);
        }, totalElapsed + thinkDelay);
        timers.push(t);
        break;
      }

      const capturedIndex = i;
      const capturedElapsed = totalElapsed;
      const t = setTimeout(() => {
        setOpponentIndex(capturedIndex + 1);

        // Bot finished all cards — if player hasn't finished yet, bot wins
        if (capturedIndex + 1 >= H2H_CARDS_PER_MATCH && !matchEndedRef.current) {
          setTimeout(() => {
            if (!matchEndedRef.current) {
              matchEndedRef.current = true;
              // Mark complete server-side — keepalive survives unmount
              try {
                fetch(`/api/h2h/match/${matchId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'complete', winnerId: null }),
                  keepalive: true,
                });
              } catch { /* best effort */ }
              onMatchEnd({
                winnerId: null,
                myPointsDelta: 0,
                opponentPointsDelta: 0,
                reason: 'completed',
              });
            }
          }, 1500);
        }
      }, capturedElapsed);
      timers.push(t);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isBot, loading, eliminated, finished, cards.length]);

  // ── Submit answer ──
  async function submitAnswer(userAnswer: 'phishing' | 'legit') {
    if (submitting) return;
    setSubmitting(true);

    const timeFromRenderMs = Date.now() - renderTime.current;

    // Submit to server
    try {
        const res = await fetch(`/api/h2h/match/${matchId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardIndex,
            userAnswer,
            timeFromRenderMs,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSubmitting(false);
          // Match ended while we were submitting — go to result screen
          if (res.status === 409 && !matchEndedRef.current) {
            matchEndedRef.current = true;
            onMatchEnd({ winnerId: null, myPointsDelta: 0, opponentPointsDelta: 0, reason: 'completed' });
          }
          return;
        }

        // Broadcast progress (skip for bot — no opponent listening)
        if (!isBot) {
          try { broadcastProgress(channelRef.current, playerId, cardIndex); } catch { /* non-fatal */ }
        }

        if (data.correct) {
          // Brief green flash for correct answer feedback
          setFlash('correct');
          setTimeout(() => setFlash(null), 200);

          const nextIndex = cardIndex + 1;
          // Small delay so the flash is visible before card changes
          setTimeout(() => {
            setSubmitting(false);
            setCardIndex(nextIndex);
            if (nextIndex >= H2H_CARDS_PER_MATCH) {
              if (isBot) {
                // Bot match — player finished all cards
                if (!matchEndedRef.current) {
                  matchEndedRef.current = true;
                  try {
                    fetch(`/api/h2h/match/${matchId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'complete', winnerId: playerId }),
                      keepalive: true,
                    });
                  } catch { /* best effort */ }
                  onMatchEnd({
                    winnerId: playerId,
                    myPointsDelta: 0,
                    opponentPointsDelta: 0,
                    reason: 'completed',
                  });
                }
              } else if (data.matchOver && !matchEndedRef.current) {
                // Server finalized — first to finish wins, notify opponent
                matchEndedRef.current = true;
                broadcastResult(channelRef.current, {
                  winnerId: data.winnerId ?? playerId,
                  player1PointsDelta: isPlayer1Ref.current ? (data.myPointsDelta ?? 0) : 0,
                  player2PointsDelta: isPlayer1Ref.current ? 0 : (data.myPointsDelta ?? 0),
                  reason: 'completed',
                });
                onMatchEnd({
                  winnerId: data.winnerId ?? playerId,
                  myPointsDelta: 0,
                  opponentPointsDelta: 0,
                  reason: 'completed',
                });
              } else {
                setFinished(true);
              }
            }
          }, 200);
        } else {
          // Wrong answer — match over immediately
          setFlash('wrong');
          // For bot matches, mark complete server-side so it doesn't stay active
          if (isBot) {
            try {
              fetch(`/api/h2h/match/${matchId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'complete', winnerId: null }),
                keepalive: true,
              });
            } catch { /* best effort */ }
          }
          setTimeout(() => {
            setSubmitting(false);
            if (!matchEndedRef.current) {
              matchEndedRef.current = true;
              onMatchEnd({
                winnerId: null, // result screen fetches actual winner from server
                myPointsDelta: 0,
                opponentPointsDelta: 0,
                reason: 'eliminated',
              });
            }
          }, 600);
        }
    } catch {
      // Network error — allow retry
      setSubmitting(false);
    }
  }

  // ── Forfeit ──
  async function handleForfeit() {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;

    // Notify server to finalize the match (opponent wins if present)
    try {
      await fetch(`/api/h2h/match/${matchId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIndex: -1, userAnswer: 'forfeit', timeFromRenderMs: 0 }),
      });
    } catch { /* best effort */ }

    // Don't broadcast — let opponent's polling detect the finalized match server-side
    // Broadcasting null winnerId would show "MATCH OVER" instead of "VICTORY" to opponent

    onMatchEnd({
      winnerId: null, // result screen fetches real winner from server
      myPointsDelta: 0,
      opponentPointsDelta: 0,
      reason: 'forfeit',
    });
  }

  // ── Ready-up lobby hooks (MUST be above early returns to avoid hook count mismatch) ──
  const [readyTimer, setReadyTimer] = useState(30);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Bot matches skip the lobby and start immediately
  useEffect(() => {
    if (isBot && !loading && cards.length > 0) {
      setReady(true);
      setOpponentReady(true);
      setMatchStarted(true);
    }
  }, [isBot, loading, cards.length]);

  // Both ready → start dramatic countdown (3, 2, 1, GO), then begin match
  useEffect(() => {
    if (!ready || !opponentReady || matchStarted || countdown !== null) return;
    setCountdown(3);
  }, [ready, opponentReady, matchStarted, countdown]);

  useEffect(() => {
    if (countdown === null || matchStarted) return;
    // Play sounds on each tick
    if (soundEnabled) {
      if (countdown > 0) playCountdownBeep();
      if (countdown === 0) playCountdownGo();
    }
    if (countdown <= 0) {
      // Brief pause after "GO" before match starts
      const t = setTimeout(() => setMatchStarted(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 700);
    return () => clearTimeout(t);
  }, [countdown, matchStarted, soundEnabled]);

  // Ready timeout — 30s to accept, otherwise cancel match (no rank point cost)
  useEffect(() => {
    if (loading || matchStarted || isBot || countdown !== null) return;
    const interval = setInterval(() => {
      setReadyTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Cancel match — no winner, no rank changes (just cancel, don't forfeit)
          if (!matchEndedRef.current) {
            matchEndedRef.current = true;
            // Cancel — no rank changes (not forfeit which triggers finalizeMatch)
            fetch(`/api/h2h/match/${matchId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'cancel' }),
              keepalive: true,
            }).catch(() => {});
            onMatchEnd({
              winnerId: null,
              myPointsDelta: 0,
              opponentPointsDelta: 0,
              reason: 'forfeit',
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, matchStarted, isBot, countdown, onMatchEnd]);

  function handleReady() {
    setReady(true);
    broadcastReady(channelRef.current, playerId);
  }

  // Re-broadcast ready every 2s until match starts (handles missed initial broadcast)
  useEffect(() => {
    if (!ready || matchStarted || isBot || countdown !== null) return;
    const interval = setInterval(() => {
      broadcastReady(channelRef.current, playerId);
    }, 2000);
    return () => clearInterval(interval);
  }, [ready, matchStarted, isBot, countdown, playerId]);

  // ── Loading / error states ──
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="text-[var(--c-secondary)] font-mono text-sm tracking-widest animate-pulse">
          LOADING MATCH...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="text-[#ff3333] font-mono text-sm tracking-widest">
          ERROR: {error}
        </div>
      </div>
    );
  }

  // ── Ready-up lobby (rendered as early return — safe because all hooks are above) ──
  if (!matchStarted && !isBot) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="w-full term-border bg-[var(--c-bg)]">
          <div className="border-b border-[rgba(255,0,128,0.35)] px-3 py-2">
            <span className="text-[#ff0080] text-sm tracking-widest">MATCH_LOBBY</span>
          </div>
          <div className="px-4 py-5 space-y-5 text-center font-mono">
            {/* VS display — vertical layout, clean and even */}

            {/* You */}
            <div className="flex items-center gap-3 px-2">
              <div className={`w-10 h-10 flex items-center justify-center text-2xl text-[var(--c-primary)] ${myBadgeRarity ? RARITY_BADGE_CLASS[myBadgeRarity] : ''}`}>
                {myBadgeIcon ?? '●'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-[var(--c-primary)] font-black tracking-wide truncate">{myName}</div>
                <div className="text-[var(--c-accent)] text-[10px] tracking-widest">{myBadgeName ?? 'NO BADGE'}</div>
              </div>
              <div className={`text-xs tracking-widest shrink-0 ${ready ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}>
                {ready ? '✓ READY' : 'NOT READY'}
              </div>
            </div>

            {/* VS divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]" />
              <span className="text-[#ff0080] text-lg font-black tracking-widest">VS</span>
              <div className="flex-1 h-px bg-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]" />
            </div>

            {/* Opponent */}
            <div className="flex items-center gap-3 px-2">
              <div className={`w-10 h-10 flex items-center justify-center text-2xl ${opponentBadgeRarity ? RARITY_BADGE_CLASS[opponentBadgeRarity] : ''}`} style={{ color: opponentThemeColor }}>
                {opponentBadgeIcon ?? '●'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-black tracking-wide truncate" style={{ color: opponentThemeColor }}>{opponentName}</div>
                <div className="text-[10px] tracking-widest" style={{ color: opponentThemeColor, opacity: 0.7 }}>{opponentBadgeName ?? 'NO BADGE'}</div>
              </div>
              <div className={`text-xs tracking-widest shrink-0 ${opponentReady ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)] animate-pulse'}`}>
                {opponentReady ? '✓ READY' : 'WAITING...'}
              </div>
            </div>

            {countdown !== null ? (
              /* Both ready — dramatic countdown */
              <div className="space-y-3">
                {countdown > 0 ? (
                  <div key={countdown} className="text-8xl font-black text-[var(--c-primary)] anim-countdown-bounce text-glow">
                    {countdown}
                  </div>
                ) : (
                  <div className="text-8xl font-black text-[var(--c-accent)] anim-countdown-go">
                    GO
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Timer */}
                <div className="text-[var(--c-muted)] text-xs font-mono">
                  Match cancelled in {readyTimer}s if not accepted
                </div>

                {!ready ? (
                  <div className="space-y-2">
                    <button
                      onClick={handleReady}
                      className="w-full py-3 term-border border-2 border-[rgba(255,0,128,0.5)] text-[#ff0080] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,0,128,0.06)] active:scale-95 transition-all"
                    >
                      [ ACCEPT MATCH ]
                    </button>
                    <button
                      onClick={handleForfeit}
                      className="w-full py-2 text-[var(--c-muted)] font-mono text-xs tracking-widest hover:text-[#ff3333] transition-colors"
                    >
                      [ DECLINE ]
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[var(--c-muted)] text-sm font-mono animate-pulse">
                      Waiting for opponent...
                    </div>
                    <button
                      onClick={handleForfeit}
                      className="w-full py-2 text-[var(--c-muted)] font-mono text-xs tracking-widest hover:text-[#ff3333] transition-colors"
                    >
                      [ CANCEL ]
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentCard = cards[cardIndex];
  const myProgress = cardIndex;

  // ── Waiting for opponent (finished all cards) — real PvP only, not bot matches ──
  if (finished && !matchEndedRef.current && !isBot) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="w-full term-border px-3 py-2">
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-[var(--c-secondary)]">
              <span style={{ color: opponentThemeColor }}>OPP:</span> {opponentBadgeIcon && <span className={opponentBadgeRarity ? RARITY_BADGE_CLASS[opponentBadgeRarity] : ''} style={{ color: opponentThemeColor }}>{opponentBadgeIcon} </span>}<span style={{ color: opponentThemeColor }}>{opponentName}</span>
            </span>
            <div className="flex items-center gap-2">
              <ProgressSquares completed={opponentIndex} total={H2H_CARDS_PER_MATCH} />
              <span className="text-[var(--c-dark)]">{opponentIndex}/{H2H_CARDS_PER_MATCH}</span>
            </div>
          </div>
          {opponentEliminated && (
            <div className="text-[#ff3333] text-xs font-mono tracking-widest mt-1">
              OPPONENT ELIMINATED
            </div>
          )}
        </div>

        <div className="term-border px-6 py-8 text-center w-full">
          <div className="text-[var(--c-primary)] font-mono text-sm tracking-widest mb-2">
            ALL CARDS COMPLETE
          </div>
          <div className="text-[var(--c-secondary)] font-mono text-sm animate-pulse">
            WAITING FOR OPPONENT...
          </div>
        </div>
      </div>
    );
  }

  // ── Elimination screen ──
  // ── No card available (shouldn't happen) ──
  if (!currentCard) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="text-[#ff3333] font-mono text-sm tracking-widest">
          ERROR: No card data
        </div>
      </div>
    );
  }

  // ── Active gameplay ──
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
      {/* Top bar: forfeit + my progress */}
      {/* AFK warning countdown */}
      {afkWarning !== null && afkWarning > 0 && (
        <div className="w-full text-center font-mono text-sm text-[#ff3333] animate-pulse mb-1">
          ANSWER IN {afkWarning}s OR AUTO-FORFEIT
        </div>
      )}

      <div className="w-full flex items-center justify-between text-sm font-mono">
        <div className="flex items-center gap-3">
          {!showForfeitConfirm ? (
            <button
              onClick={() => setShowForfeitConfirm(true)}
              className="text-[var(--c-dark)] hover:text-[#ff3333] active:scale-95 transition-all p-2 -m-2"
            >
              [FORFEIT]
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[#ff3333]">FORFEIT?</span>
              <button
                onClick={handleForfeit}
                className="text-[#ff3333] hover:text-[#ff6666] active:scale-95 transition-all"
              >
                [YES]
              </button>
              <button
                onClick={() => setShowForfeitConfirm(false)}
                className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] active:scale-95 transition-all"
              >
                [NO]
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {myBadgeIcon && <span className={`text-[var(--c-primary)] ${myBadgeRarity ? RARITY_BADGE_CLASS[myBadgeRarity] : ''}`}>{myBadgeIcon}</span>}
          <span className="text-[var(--c-primary)] font-bold text-base">YOU</span>
          <ProgressSquares completed={myProgress} total={H2H_CARDS_PER_MATCH} />
          <span className="text-[var(--c-primary)] text-sm">{myProgress}/{H2H_CARDS_PER_MATCH}</span>
        </div>
      </div>

      {/* Opponent progress bar */}
      <div className="w-full term-border px-3 py-2" style={{ borderColor: `color-mix(in srgb, ${opponentThemeColor} 30%, transparent)` }}>
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            {opponentBadgeIcon && <span className={opponentBadgeRarity ? RARITY_BADGE_CLASS[opponentBadgeRarity] : ''} style={{ color: opponentThemeColor }}>{opponentBadgeIcon}</span>}
            <span className="font-bold text-base" style={{ color: opponentThemeColor }}>{opponentName}</span>
          </div>
          <div className="flex items-center gap-2">
            <ProgressSquares completed={opponentIndex} total={H2H_CARDS_PER_MATCH} />
            <span className="text-sm" style={{ color: opponentThemeColor }}>{opponentIndex}/{H2H_CARDS_PER_MATCH}</span>
          </div>
        </div>
        {opponentEliminated && (
          <div className="text-[#ff3333] text-xs font-mono tracking-widest mt-1">
            OPPONENT ELIMINATED
          </div>
        )}
      </div>

      {/* Card */}
      <div className={`w-full anim-card-entry transition-all duration-200 ${
        flash === 'correct' ? 'ring-2 ring-[var(--c-primary)] ring-opacity-60' :
        flash === 'wrong' ? 'ring-2 ring-[#ff3333] ring-opacity-60' : ''
      }`}>
        <CardDisplay key={cardIndex} card={currentCard} />
      </div>

      {/* Answer buttons */}
      <div className="w-full flex gap-3">
        <button
          onClick={() => submitAnswer('phishing')}
          disabled={submitting}
          className="flex-1 py-4 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.1)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none btn-glow"
        >
          PHISHING
        </button>
        <button
          onClick={() => submitAnswer('legit')}
          disabled={submitting}
          className="flex-1 py-4 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none btn-glow"
        >
          LEGIT
        </button>
      </div>
    </div>
  );
}
