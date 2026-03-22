'use client';

import { useState } from 'react';

const TIERS = [
  { label: 'BRONZE', min: 0, color: '#003a0e' },
  { label: 'SILVER', min: 100, color: '#00aa28' },
  { label: 'GOLD', min: 250, color: '#ffaa00' },
  { label: 'PLATINUM', min: 450, color: '#00aaff' },
  { label: 'DIAMOND', min: 700, color: '#ff0080' },
  { label: 'MASTER', min: 1000, color: '#ff3333' },
  { label: 'ELITE', min: 1400, color: '#ffd700' },
];

export function H2HRankGuide({ currentPoints }: { currentPoints: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full term-border bg-[var(--c-bg)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-colors"
      >
        <span className="text-[var(--c-secondary)] tracking-widest">RANK_TIERS</span>
        <span className="text-[var(--c-secondary)]">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-3 space-y-1.5">
          {TIERS.map((tier, i) => {
            const nextMin = TIERS[i + 1]?.min;
            const isCurrent = currentPoints >= tier.min && (nextMin === undefined || currentPoints < nextMin);
            const pointsToNext = nextMin !== undefined ? nextMin - currentPoints : null;

            return (
              <div
                key={tier.label}
                className={`flex items-center justify-between text-sm font-mono px-2 py-1 ${isCurrent ? 'border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: tier.color }}>{'\u25C6'}</span>
                  <span style={{ color: tier.color }} className="font-bold">{tier.label}</span>
                  {isCurrent && <span className="text-[var(--c-primary)] text-xs">{'\u25C0'} YOU</span>}
                </div>
                <div className="text-right">
                  <span className="text-[var(--c-dark)]">{tier.min}+ pts</span>
                  {isCurrent && pointsToNext !== null && pointsToNext > 0 && (
                    <span className="text-[var(--c-muted)] text-xs ml-2">({pointsToNext} to next)</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="text-[var(--c-dark)] text-xs font-mono pt-2 space-y-0.5">
            <div>Win: +12 to +45 pts (more vs higher ranks)</div>
            <div>Loss: -8 to -30 pts (less vs higher ranks)</div>
          </div>
        </div>
      )}
    </div>
  );
}
