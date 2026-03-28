import { useState, useEffect } from 'react';
import { xpToNextLevel, MAX_LEVEL, LEVEL_THRESHOLDS } from '@/lib/xp';

interface LevelMeterProps {
  xp: number;
  level: number;
  compact?: boolean;
  xpEarned?: number; // if provided, animates from (xp - xpEarned) to xp
}

export function LevelMeter({ xp, level, compact, xpEarned }: LevelMeterProps) {
  const { current, needed } = xpToNextLevel(xp);
  const targetPct = needed === 0 ? 100 : Math.round((current / needed) * 100);
  const isMax = level >= MAX_LEVEL;

  // Animated bar: start from old XP position, animate to current
  const [barPct, setBarPct] = useState(() => {
    if (!xpEarned || xpEarned <= 0) return targetPct;
    const oldXp = Math.max(0, xp - xpEarned);
    const oldInfo = xpToNextLevel(oldXp);
    return oldInfo.needed === 0 ? 100 : Math.round((oldInfo.current / oldInfo.needed) * 100);
  });

  useEffect(() => {
    if (!xpEarned || xpEarned <= 0) { setBarPct(targetPct); return; }
    // Animate after a short delay
    const t = setTimeout(() => setBarPct(targetPct), 300);
    return () => clearTimeout(t);
  }, [xpEarned, targetPct]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm font-mono">
        <span className="text-[var(--c-secondary)]">LVL {level}</span>
        <div className="w-16 h-0.5 bg-[var(--c-dark)]">
          <div className="h-full bg-[var(--c-secondary)]" style={{ width: `${barPct}%` }} />
        </div>
        {!isMax && <span className="text-[var(--c-dark)]">{current}/{needed} XP</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-mono">
        <span className="text-[var(--c-secondary)]">LEVEL {level}</span>
        <div className="flex items-center gap-2">
          {xpEarned && xpEarned > 0 && (
            <span className="text-[var(--c-primary)] font-bold anim-xp-pop">+{xpEarned} XP</span>
          )}
          <span className="text-[var(--c-dark)]">{isMax ? 'MAX' : `${current} / ${needed} XP`}</span>
        </div>
      </div>
      <div className="h-2.5 bg-[var(--c-dark)] w-full overflow-hidden">
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{
            width: `${barPct}%`,
            backgroundColor: 'var(--c-primary)',
            boxShadow: '0 0 6px var(--c-primary), 0 0 12px color-mix(in srgb, var(--c-primary) 40%, transparent)',
          }}
        />
      </div>
      <div className="text-right text-sm font-mono text-[var(--c-dark)]">{xp.toLocaleString()} XP total</div>
    </div>
  );
}
