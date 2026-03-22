'use client';

import { useState, memo } from 'react';

const TIERS = [
  { label: 'BRONZE', min: 0, color: '#003a0e' },
  { label: 'SILVER', min: 100, color: '#00aa28' },
  { label: 'GOLD', min: 250, color: '#ffaa00' },
  { label: 'PLATINUM', min: 450, color: '#00aaff' },
  { label: 'DIAMOND', min: 700, color: '#ff0080' },
  { label: 'MASTER', min: 1000, color: '#ff3333' },
  { label: 'ELITE', min: 1400, color: '#ffd700' },
];

export const H2HRankGuide = memo(function H2HRankGuide({ currentPoints }: { currentPoints: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full term-border bg-[var(--c-bg)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-mono hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] active:scale-[0.98] transition-all"
      >
        <span className="text-[var(--c-secondary)] tracking-widest">RANK_TIERS</span>
        <span className="text-[var(--c-secondary)]">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-4 py-4 space-y-2">
          {TIERS.map((tier, i) => {
            const nextMin = TIERS[i + 1]?.min;
            const isCurrent = currentPoints >= tier.min && (nextMin === undefined || currentPoints < nextMin);
            const pointsToNext = nextMin !== undefined ? Math.max(0, nextMin - currentPoints) : null;

            return (
              <div
                key={tier.label}
                className={`flex items-center justify-between font-mono px-3 py-2 ${
                  isCurrent
                    ? 'border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]'
                    : 'border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg" style={{ color: tier.color }}>{'\u25C6'}</span>
                  <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
                  {isCurrent && <span className="text-[var(--c-primary)] text-xs font-bold">{'\u25C0'} YOU</span>}
                </div>
                <div className="text-right text-sm">
                  <span className="text-[var(--c-secondary)]">{tier.min}+ pts</span>
                  {isCurrent && pointsToNext !== null && pointsToNext > 0 && (
                    <span className="text-[var(--c-muted)] ml-2">({pointsToNext} to next)</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="text-[var(--c-secondary)] text-sm font-mono pt-3 space-y-1 border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
            <div>Win: +8 to +40 pts (more vs higher ranks)</div>
            <div>Loss: -8 to -35 pts (less vs lower ranks)</div>
            <div className="text-[var(--c-muted)]">50% winrate at same tier = no climb.</div>
          </div>
        </div>
      )}
    </div>
  );
});
