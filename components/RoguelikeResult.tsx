'use client';

import { useEffect, useRef, useState } from 'react';
import { GIMMICK_DEFS, ROGUELIKE_FLOORS } from '@/lib/roguelike';
import type { GimmickId } from '@/lib/roguelike';
import { playVictory, playDefeat, playClick } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { useSigint } from '@/lib/SigintContext';

interface Props {
  operationName: string;
  finalScore: number;
  clearanceEarned: number;
  floorsCleared: number;
  deaths: number;
  bestStreak: number;
  cardsAnswered: number;
  cardsCorrect: number;
  gimmicks: (GimmickId | null)[];
  won: boolean;             // true if all floors cleared
  onPlayAgain: () => void;
  onBack: () => void;
}

export function RoguelikeResult({
  operationName,
  finalScore,
  clearanceEarned,
  floorsCleared,
  deaths,
  bestStreak,
  cardsAnswered,
  cardsCorrect,
  gimmicks,
  won,
  onPlayAgain,
  onBack,
}: Props) {
  const { soundEnabled } = useSoundEnabled();
  const { triggerSigint } = useSigint();
  const [displayScore, setDisplayScore] = useState(0);

  // Play sound on mount
  const soundPlayed = useRef(false);
  useEffect(() => {
    if (soundPlayed.current || !soundEnabled) return;
    soundPlayed.current = true;
    if (won) playVictory();
    else playDefeat();
  }, [soundEnabled, won]);

  // SIGINT triggers — fire once
  const sigintFired = useRef(false);
  useEffect(() => {
    if (sigintFired.current) return;
    sigintFired.current = true;

    if (won && deaths === 0) {
      triggerSigint('roguelike_flawless');
    } else if (won) {
      triggerSigint('roguelike_clear');
    } else if (floorsCleared === 0) {
      triggerSigint('roguelike_death_floor1');
    } else {
      triggerSigint('roguelike_death');
    }
  }, [won, deaths, floorsCleared, triggerSigint]);

  // Animated score counter — 0 → finalScore over 1.2s, ease-out cubic
  useEffect(() => {
    if (finalScore === 0) { setDisplayScore(0); return; }
    const duration = 1200;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * finalScore));
      if (progress < 1) requestAnimationFrame(tick);
    }
    const timer = setTimeout(() => requestAnimationFrame(tick), 200);
    return () => clearTimeout(timer);
  }, [finalScore]);

  const accuracy = cardsAnswered > 0
    ? Math.round((cardsCorrect / cardsAnswered) * 100)
    : 0;

  const totalFloors = gimmicks.length || ROGUELIKE_FLOORS;

  return (
    <div className="flex flex-col items-center gap-5 p-6 font-mono max-w-md mx-auto anim-fade-in-up">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2
          className={`text-2xl font-bold tracking-wider ${won ? 'anim-level-up' : ''}`}
          style={{
            color: won ? '#00ff41' : '#ff3333',
            textShadow: won
              ? '0 0 12px #00ff41, 0 0 30px rgba(0,255,65,0.3)'
              : '0 0 12px #ff3333, 0 0 24px rgba(255,51,51,0.25)',
          }}
        >
          {won ? 'TOWER CLEARED' : 'OPERATION FAILED'}
        </h2>
        <p
          className="text-sm font-bold tracking-widest"
          style={{ color: '#ffaa00' }}
        >
          {operationName}
        </p>
      </div>

      {/* Score box */}
      <div
        className="w-full term-border-bright px-4 py-5 text-center space-y-1 anim-fade-in-up"
        style={{ animationDelay: '150ms', animationFillMode: 'both' }}
      >
        <p className="text-xs text-[var(--c-muted)] tracking-widest">FINAL SCORE</p>
        <p
          className="text-5xl font-black tabular-nums"
          style={{
            color: won ? '#00ff41' : '#ff3333',
            textShadow: won
              ? '0 0 8px rgba(0,255,65,0.4)'
              : '0 0 8px rgba(255,51,51,0.4)',
          }}
        >
          {displayScore.toLocaleString()}
        </p>
      </div>

      {/* Stats grid */}
      <div
        className="w-full grid grid-cols-2 gap-3 anim-fade-in-up"
        style={{ animationDelay: '300ms', animationFillMode: 'both' }}
      >
        <StatCell label="FLOORS CLEARED" value={`${floorsCleared}/${totalFloors}`} />
        <StatCell label="ACCURACY" value={`${accuracy}%`} />
        <StatCell label="BEST STREAK" value={String(bestStreak)} />
        <StatCell label="DEATHS" value={String(deaths)} valueColor={deaths > 0 ? '#ff3333' : '#00ff41'} />
        <StatCell
          label="CLEARANCE EARNED"
          value={`+${clearanceEarned}`}
          valueColor="#ffaa00"
          fullWidth
        />
      </div>

      {/* Floor breakdown */}
      <div
        className="w-full term-border anim-fade-in-up"
        style={{ animationDelay: '450ms', animationFillMode: 'both' }}
      >
        <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-3 py-1.5">
          <span className="text-xs text-[var(--c-secondary)] tracking-widest">FLOOR BREAKDOWN</span>
        </div>
        <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
          {gimmicks.map((gimmickId, i) => {
            const cleared = i < floorsCleared;
            const gimmickDef = gimmickId ? GIMMICK_DEFS[gimmickId] : null;
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-[var(--c-muted)] shrink-0 tabular-nums w-12">
                    FLOOR {i + 1}
                  </span>
                  {gimmickDef && (
                    <span
                      className="text-xs truncate"
                      style={{ color: gimmickDef.tier === 1 ? '#00ff41' : '#00d4ff' }}
                    >
                      {gimmickDef.label}
                    </span>
                  )}
                  {!gimmickDef && (
                    <span className="text-xs text-[var(--c-muted)]">—</span>
                  )}
                </div>
                <span
                  className="text-sm font-bold shrink-0"
                  style={{ color: cleared ? '#00ff41' : '#ff3333' }}
                >
                  {cleared ? '✓' : '✗'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <div
        className="flex gap-3 w-full anim-fade-in-up"
        style={{ animationDelay: '600ms', animationFillMode: 'both' }}
      >
        <button
          onClick={() => { if (soundEnabled) playClick(); onPlayAgain(); }}
          className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
        >
          [ NEW RUN ]
        </button>
        <button
          onClick={() => { if (soundEnabled) playClick(); onBack(); }}
          className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-secondary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
        >
          [ BACK ]
        </button>
      </div>
    </div>
  );
}

// ── Helper: single stat cell ──────────────────────────────────────────────────

interface StatCellProps {
  label: string;
  value: string;
  valueColor?: string;
  fullWidth?: boolean;
}

function StatCell({ label, value, valueColor, fullWidth }: StatCellProps) {
  return (
    <div
      className={`term-border bg-[var(--c-bg)] px-3 py-3 text-center${fullWidth ? ' col-span-2' : ''}`}
    >
      <p
        className="text-lg font-black tabular-nums"
        style={{ color: valueColor ?? 'var(--c-primary)' }}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--c-muted)] tracking-widest mt-0.5">{label}</p>
    </div>
  );
}
