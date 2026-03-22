'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { SafeDealCard } from '@/lib/card-utils';
import { parseFrom } from '@/lib/parseFrom';
import { H2H_CARDS_PER_MATCH } from '@/lib/h2h';
import {
  subscribeToMatch,
  broadcastProgress,
  broadcastResult,
  unsubscribeFromMatch,
} from '@/lib/h2h-realtime';
import type { MatchProgressEvent, MatchResultEvent } from '@/lib/h2h-realtime';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  matchId: string;
  playerId: string;
  isGhost: boolean;
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
              ? 'text-[var(--c-primary)]'
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
                  className="ml-1 text-sm text-[var(--c-dark)] hover:text-[#ffaa00] transition-colors"
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
          className={`px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap font-mono ${bodyExpanded ? '' : 'max-h-52 lg:max-h-none momentum-scroll lg:overflow-auto scroll-fade-bottom lg:scroll-fade-none'}`}
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
            className="lg:hidden w-full py-1.5 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-xs font-mono tracking-widest transition-colors"
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
              className="text-[var(--c-dark)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors p-2 -m-2"
              aria-label="Close URL inspector"
            >
              [ x ]
            </button>
          </div>
          <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function H2HMatch({ matchId, playerId, isGhost, onMatchEnd }: Props) {
  // ── Card / match state ──
  const [cards, setCards] = useState<SafeDealCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Opponent state ──
  const [opponentName, setOpponentName] = useState<string>('OPPONENT');
  const [opponentIndex, setOpponentIndex] = useState(0);
  const [opponentEliminated, setOpponentEliminated] = useState(false);

  // ── Player state ──
  const [eliminated, setEliminated] = useState(false);
  const [eliminatedAt, setEliminatedAt] = useState<number>(0);
  const [finished, setFinished] = useState(false);
  const [playingItOut, setPlayingItOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  // ── Timing ──
  const renderTime = useRef<number>(Date.now());

  // ── Refs for callbacks that need latest state ──
  const matchEndedRef = useRef(false);

  // Reset render timer when card changes
  useEffect(() => {
    renderTime.current = Date.now();
  }, [cardIndex]);

  // ── Handle incoming match result (from realtime or API) ──
  const handleMatchResult = useCallback(
    (event: MatchResultEvent) => {
      if (matchEndedRef.current) return;
      matchEndedRef.current = true;

      onMatchEnd({
        winnerId: event.winnerId,
        myPointsDelta: event.player1PointsDelta,
        opponentPointsDelta: event.player2PointsDelta,
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

        // Determine opponent name
        const isPlayer1 = playerId === matchData.match.player1Id;
        const opponentId = isPlayer1
          ? matchData.match.player2Id
          : matchData.match.player1Id;

        if (opponentId && matchData.players[opponentId]) {
          setOpponentName(matchData.players[opponentId]);
        } else if (isGhost) {
          setOpponentName('GHOST');
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

        // Subscribe to realtime (skip for ghost matches — no opponent to listen to)
        if (!isGhost) {
          try {
            subscribeToMatch(
              matchId,
              playerId,
              (event: MatchProgressEvent) => {
                setOpponentIndex(event.cardIndex + 1);
                if (!event.correct) {
                  setOpponentEliminated(true);
                }
              },
              handleMatchResult,
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
      unsubscribeFromMatch();
    };
  }, [matchId, playerId, isGhost, onMatchEnd, handleMatchResult]);

  // ── Submit answer ──
  async function submitAnswer(userAnswer: 'phishing' | 'legit') {
    if (submitting) return;
    setSubmitting(true);

    const timeFromRenderMs = Date.now() - renderTime.current;
    const isPlayingOut = playingItOut;

    if (!isPlayingOut) {
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
          return;
        }

        // Broadcast progress (skip for ghost — no opponent listening)
        if (!isGhost) {
          try { broadcastProgress(matchId, playerId, cardIndex, data.correct); } catch { /* non-fatal */ }
        }

        if (data.correct) {
          const nextIndex = cardIndex + 1;
          setCardIndex(nextIndex);

          if (nextIndex >= H2H_CARDS_PER_MATCH) {
            setFinished(true);
          }
        } else {
          // Eliminated
          setEliminated(true);
          setEliminatedAt(cardIndex + 1);
        }
      } catch {
        // Network error — allow retry
      }
    } else {
      // Playing it out — just advance locally, no server submission
      const nextIndex = cardIndex + 1;
      setCardIndex(nextIndex);
      if (nextIndex >= H2H_CARDS_PER_MATCH) {
        setFinished(true);
      }
    }

    setSubmitting(false);
  }

  // ── Forfeit ──
  function handleForfeit() {
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;

    broadcastResult(matchId, {
      winnerId: null,
      player1PointsDelta: 0,
      player2PointsDelta: 0,
      reason: 'forfeit',
    });

    onMatchEnd({
      winnerId: null,
      myPointsDelta: 0,
      opponentPointsDelta: 0,
      reason: 'forfeit',
    });
  }

  // ── Play it out (after elimination) ──
  function handlePlayItOut() {
    setPlayingItOut(true);
    setEliminated(false);
    const nextIndex = eliminatedAt;
    setCardIndex(nextIndex);
  }

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

  const currentCard = cards[cardIndex];
  const myProgress = cardIndex;

  // ── Waiting for opponent (finished all cards) ──
  if (finished && !matchEndedRef.current) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="w-full term-border px-3 py-2">
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-[var(--c-secondary)]">
              OPP: <span className="text-[var(--c-primary)]">{opponentName}</span>
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
  if (eliminated && !playingItOut) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
        <div className="w-full term-border px-3 py-2">
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-[var(--c-secondary)]">
              OPP: <span className="text-[var(--c-primary)]">{opponentName}</span>
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

        <div className="term-border px-6 py-8 text-center w-full space-y-4">
          <div className="text-[#ff3333] font-mono text-lg tracking-widest">
            ELIMINATED
          </div>
          <div className="text-[var(--c-secondary)] font-mono text-sm">
            Wrong answer on card {eliminatedAt}/{H2H_CARDS_PER_MATCH}
          </div>

          <div className="flex gap-3 pt-2">
            {eliminatedAt < H2H_CARDS_PER_MATCH && (
              <button
                onClick={handlePlayItOut}
                className="flex-1 py-3 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] active:scale-95 transition-all"
              >
                PLAY IT OUT
              </button>
            )}
            <button
              onClick={() => {
                if (!matchEndedRef.current) {
                  matchEndedRef.current = true;
                  onMatchEnd({
                    winnerId: null,
                    myPointsDelta: 0,
                    opponentPointsDelta: 0,
                    reason: 'eliminated',
                  });
                }
              }}
              className="flex-1 py-3 border border-[color-mix(in_srgb,var(--c-dark)_50%,transparent)] text-[var(--c-dark)] font-mono text-sm tracking-widest hover:text-[var(--c-secondary)] hover:border-[color-mix(in_srgb,var(--c-secondary)_50%,transparent)] active:scale-95 transition-all"
            >
              BACK
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="w-full flex items-center justify-between text-sm font-mono">
        <div className="flex items-center gap-3">
          {!showForfeitConfirm ? (
            <button
              onClick={() => setShowForfeitConfirm(true)}
              className="text-[var(--c-dark)] hover:text-[#ff3333] transition-colors p-2 -m-2"
            >
              [FORFEIT]
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[#ff3333]">FORFEIT?</span>
              <button
                onClick={handleForfeit}
                className="text-[#ff3333] hover:text-[#ff6666] transition-colors"
              >
                [YES]
              </button>
              <button
                onClick={() => setShowForfeitConfirm(false)}
                className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] transition-colors"
              >
                [NO]
              </button>
            </div>
          )}
          {playingItOut && (
            <span className="text-[var(--c-dark)] text-xs tracking-widest">[UNRANKED]</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--c-secondary)]">
            YOU: <span className="text-[var(--c-primary)]">{myProgress}/{H2H_CARDS_PER_MATCH}</span>
          </span>
          <ProgressSquares completed={myProgress} total={H2H_CARDS_PER_MATCH} />
        </div>
      </div>

      {/* Opponent progress bar */}
      <div className="w-full term-border px-3 py-2">
        <div className="flex items-center justify-between text-sm font-mono">
          <span className="text-[var(--c-secondary)]">
            OPP: <span className="text-[var(--c-primary)]">{opponentName}</span>
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

      {/* Card */}
      <div className="w-full anim-card-entry">
        <CardDisplay card={currentCard} />
      </div>

      {/* Answer buttons */}
      <div className="w-full flex gap-3">
        <button
          onClick={() => submitAnswer('phishing')}
          disabled={submitting}
          className="flex-1 py-4 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.1)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          PHISHING
        </button>
        <button
          onClick={() => submitAnswer('legit')}
          disabled={submitting}
          className="flex-1 py-4 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          LEGIT
        </button>
      </div>
    </div>
  );
}
