'use client';

import { GIMMICK_DEFS, MODIFIER_DEFS } from '@/lib/roguelike';
import type { GimmickId, CardModifier } from '@/lib/roguelike';

interface Props {
  floor: number;           // 0-indexed
  gimmick: GimmickId;
  lives: number;
  livesMax: number;
  intel: number;
  streak: number;
  cardIndex: number;       // 0-indexed
  totalCards: number;
  modifiers: CardModifier[];
}

const MODIFIER_COLORS: Record<CardModifier, string> = {
  LOOKALIKE_DOMAIN: '#ffaa00',
  DECOY_RED_FLAGS:  '#ff3333',
  AI_ENHANCED:      '#bf5fff',
  TIMED:            '#00d4ff',
  REDACTED_SENDER:  '#888888',
};

export function RoguelikeHUD({
  floor,
  gimmick,
  lives,
  livesMax,
  intel,
  streak,
  cardIndex,
  totalCards,
  modifiers,
}: Props) {
  const gimmickDef = GIMMICK_DEFS[gimmick];
  const gimmickColor = gimmickDef.tier === 1 ? '#00ff41' : '#00d4ff';

  return (
    <div className="w-full font-mono text-xs space-y-1.5 px-1 pb-2">
      {/* Row 1: Floor + Gimmick + Card Progress */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--c-muted)] tracking-widest shrink-0">
            FLOOR {floor + 1}
          </span>
          <span
            className="truncate tracking-wide font-bold"
            style={{ color: gimmickColor }}
          >
            {gimmickDef.label.toUpperCase()}
          </span>
        </div>
        <span className="text-[var(--c-muted)] shrink-0 tabular-nums">
          {cardIndex + 1}/{totalCards}
        </span>
      </div>

      {/* Row 2: Lives + Intel + Streak */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Hearts */}
          <span className="tracking-tight" aria-label={`${lives} of ${livesMax} lives`}>
            {Array.from({ length: livesMax }, (_, i) => (
              <span
                key={i}
                style={{ color: i < lives ? '#ff3333' : 'var(--c-dark)' }}
              >
                ♥
              </span>
            ))}
          </span>
          {/* Intel */}
          <span className="font-bold tabular-nums" style={{ color: '#ffaa00' }}>
            {intel} INTEL
          </span>
        </div>
        {/* Streak — only shown at >= 2 */}
        {streak >= 2 && (
          <span
            className="font-bold tracking-wide tabular-nums"
            style={{ color: '#00ff41' }}
          >
            {streak}× STREAK
          </span>
        )}
      </div>

      {/* Row 3: Modifier badges */}
      {modifiers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {modifiers.map((mod) => (
            <span
              key={mod}
              className="px-1.5 py-0.5 text-[10px] tracking-wide font-bold rounded-sm border"
              style={{
                color: MODIFIER_COLORS[mod],
                borderColor: MODIFIER_COLORS[mod] + '66',
                background: MODIFIER_COLORS[mod] + '18',
              }}
              title={MODIFIER_DEFS[mod].description}
            >
              {MODIFIER_DEFS[mod].label.toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
