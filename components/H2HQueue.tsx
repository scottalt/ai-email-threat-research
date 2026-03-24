'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getRankFromPoints } from '@/lib/h2h';
import { H2HRankGuide } from './H2HRankGuide';

interface Props {
  profile: { id: string; displayName: string | null };
  onMatchFound: (matchId: string, isBot: boolean) => void;
  onCancel: () => void;
}

const POLL_INTERVAL_MS = 2000;
const BOT_TIMEOUT_S = 30;

export function H2HQueue({ profile, onMatchFound, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [rankLabel, setRankLabel] = useState('BRONZE');
  const [rankPoints, setRankPoints] = useState(0);
  const [rankColor, setRankColor] = useState('#003a0e');
  const [ratedMatchesLeft, setRatedMatchesLeft] = useState<number | null>(null);
  const [winStreak, setWinStreak] = useState(0);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchedRef = useRef(false);
  const mountedRef = useRef(true);
  const joinedRef = useRef(false);

  // Keep joinedRef in sync
  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  // ── Cleanup helper ──
  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Leave queue ──
  const leaveQueue = useCallback(async () => {
    try {
      await fetch('/api/h2h/queue', { method: 'DELETE' });
    } catch {
      // best-effort
    }
  }, []);

  // ── Poll for match ──
  const pollForMatch = useCallback(async () => {
    if (matchedRef.current || !mountedRef.current) return;

    try {
      const res = await fetch('/api/h2h/queue');
      if (!mountedRef.current) return;

      if (!res.ok) return;

      const data = await res.json();
      if (data.matched && data.matchId) {
        matchedRef.current = true;
        cleanup();
        onMatchFound(data.matchId, data.isBot ?? false);
      }
    } catch {
      // network hiccup — keep polling
    }
  }, [cleanup, onMatchFound]);

  // ── Fetch stats on mount ──
  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch('/api/h2h/stats');
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setRankPoints(data.rankPoints ?? 0);
        setRankLabel(data.rankLabel ?? getRankFromPoints(data.rankPoints ?? 0).label.toUpperCase());
        setRankColor(data.rankColor ?? '#003a0e');
        const today = data.ratedMatchesToday ?? 0;
        setRatedMatchesLeft(Math.max(0, 20 - today));
        setWinStreak(data.winStreak ?? 0);
      } catch {
        // non-critical
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // ── Join queue on mount ──
  useEffect(() => {
    mountedRef.current = true;
    matchedRef.current = false;

    async function joinQueue() {
      try {
        const res = await fetch('/api/h2h/queue', { method: 'POST' });
        if (!mountedRef.current) return;

        if (res.status === 409) {
          // Already queued — that's fine, start polling
          setJoined(true);
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Failed to join queue');
          return;
        }

        setJoined(true);
      } catch {
        if (mountedRef.current) {
          setError('Network error — could not join queue');
        }
      }
    }

    joinQueue();

    return () => {
      mountedRef.current = false;
      cleanup();
      if (joinedRef.current && !matchedRef.current) {
        leaveQueue();
      }
    };
  }, [cleanup, leaveQueue]);

  // ── Start polling + timer once joined ──
  useEffect(() => {
    if (!joined) return;

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Start polling
    pollForMatch(); // immediate first poll
    pollRef.current = setInterval(pollForMatch, POLL_INTERVAL_MS);

    return () => {
      cleanup();
    };
  }, [joined, pollForMatch, cleanup]);

  // ── Cancel handler ──
  const handleCancel = useCallback(async () => {
    matchedRef.current = true; // prevent further polling
    cleanup();
    await leaveQueue();
    onCancel();
  }, [cleanup, leaveQueue, onCancel]);

  // ── Scanning animation dots ──
  const dots = '.'.repeat((elapsed % 3) + 1);
  const botCountdown = Math.max(0, BOT_TIMEOUT_S - elapsed);

  const displayName = profile.displayName ?? 'AGENT';

  // ── Error state ──
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="term-border w-full max-w-sm bg-[var(--c-bg)] p-4 font-mono">
          <div className="text-[var(--c-accent)] text-sm tracking-widest mb-4">
            ERROR
          </div>
          <p className="text-[var(--c-primary)] text-sm mb-4">{error}</p>
          <button
            onClick={onCancel}
            className="w-full py-3 border border-[var(--c-primary)] text-[var(--c-primary)] text-sm tracking-widest hover:bg-[var(--c-primary)] hover:text-[var(--c-bg)] active:scale-95 transition-all"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md lg:max-w-lg mx-auto px-4 space-y-3">
      <div className="term-border w-full bg-[var(--c-bg)] font-mono">
        {/* Header */}
        <div className="border-b border-[rgba(255,0,128,0.3)] px-4 py-3 flex items-center justify-between">
          <h2 className="text-[#ff0080] text-sm tracking-widest font-bold">
            PvP_MODE
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[#ffaa00] text-[10px] tracking-widest border border-[#ffaa0050] px-1.5 py-0.5">BETA</span>
            <span className="text-[var(--c-muted)] text-xs tracking-widest">SEASON 0</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-5 space-y-5">
          {/* Status */}
          <div className="text-center">
            <p className="text-[var(--c-primary)] text-sm tracking-widest animate-pulse">
              SEARCHING FOR OPPONENT{dots}
            </p>
            <p className="text-[var(--c-muted)] text-sm mt-1">
              5 cards. Wrong answer = eliminated. Fastest perfect run wins.
            </p>
          </div>

          {/* VS panel */}
          <div className="border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] p-4">
            <div className="flex items-center">
              {/* You */}
              <div className="flex-1 min-w-0">
                <p className="text-[var(--c-muted)] text-xs tracking-widest mb-1">YOU</p>
                <p className="text-[var(--c-primary)] text-sm font-bold truncate">{displayName}</p>
                <p className="text-sm mt-1 font-bold" style={{ color: rankColor }}>
                  {rankLabel}
                </p>
                <p className="text-[var(--c-muted)] text-xs">{rankPoints} pts</p>
              </div>

              {/* VS divider */}
              <div className="px-4 lg:px-6">
                <span className="text-[var(--c-muted)] text-xl font-black">VS</span>
              </div>

              {/* Opponent */}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[var(--c-muted)] text-xs tracking-widest mb-1">OPPONENT</p>
                <p className="text-[var(--c-muted)] text-sm animate-pulse">scanning{dots}</p>
              </div>
            </div>
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-[var(--c-muted)]">
              Queue: <span className="text-[var(--c-primary)]">{elapsed}s</span>
            </span>
            <span className="text-[var(--c-muted)]">
              {botCountdown > 0
                ? <>Bot in <span className="text-[var(--c-secondary)]">{botCountdown}s</span></>
                : <span className="text-[var(--c-primary)] animate-pulse">Launching bot...</span>
              }
            </span>
            {ratedMatchesLeft !== null && (
              <span className="text-[var(--c-muted)]">
                Rated: <span className={ratedMatchesLeft > 0 ? 'text-[var(--c-secondary)]' : 'text-[#ffaa00]'}>{ratedMatchesLeft} left</span>
              </span>
            )}
          </div>

          {winStreak >= 2 && (
            <div className="text-center">
              <span className="text-[var(--c-primary)] text-sm font-bold tracking-widest">{winStreak}-WIN STREAK</span>
            </div>
          )}

          {/* Cancel button */}
          <button
            onClick={handleCancel}
            className="w-full py-3 border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] text-[var(--c-secondary)] text-sm tracking-widest hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] active:scale-95 transition-all"
          >
            CANCEL
          </button>
        </div>
      </div>

      {/* Rank tiers guide — same width as main panel */}
      <H2HRankGuide currentPoints={rankPoints} />
    </div>
  );
}
