'use client';

import { GIMMICK_DEFS } from '@/lib/roguelike';
import type { GimmickId } from '@/lib/roguelike';

interface FloorIntroProps {
  floor: number;
  gimmick: GimmickId | null;
  secondaryGimmick?: GimmickId | null;
  onSkip: () => void;
}

export function RoguelikeFloorIntro({ floor, gimmick, secondaryGimmick, onSkip }: FloorIntroProps) {
  const introGimmickDef = gimmick ? GIMMICK_DEFS[gimmick] : null;
  const isBossFloor = introGimmickDef?.tier === 3;
  const introGimmickColor = introGimmickDef
    ? (isBossFloor ? '#ff3333' : introGimmickDef.tier === 1 ? '#00ff41' : '#00d4ff')
    : '#00ff41';
  const floorGlowStyle = isBossFloor
    ? { color: '#ff3333', textShadow: '0 0 20px #ff3333, 0 0 40px #ff333388, 0 0 80px #ff333344' }
    : { color: 'var(--c-primary)' };

  return (
    <div
      onClick={onSkip}
      className="flex flex-col items-center justify-center gap-4 p-8 font-mono min-h-[300px] cursor-pointer select-none"
    >
      <div className="anim-floor-intro text-center space-y-3">
        {isBossFloor && (
          <p className="text-sm font-bold tracking-widest animate-pulse" style={{ color: '#ff3333' }}>
            ⚠ BOSS FLOOR ⚠
          </p>
        )}
        <p
          className="text-4xl font-black tracking-widest glow"
          style={floorGlowStyle}
        >
          FLOOR {floor + 1}
        </p>
        {introGimmickDef && (
          <p
            className="text-lg font-bold tracking-widest"
            style={{ color: introGimmickColor }}
          >
            {introGimmickDef.label.toUpperCase()}
          </p>
        )}
        {introGimmickDef && (
          <p className="text-xs text-[var(--c-muted)] max-w-xs">
            {introGimmickDef.description}
          </p>
        )}
        {secondaryGimmick && GIMMICK_DEFS[secondaryGimmick] && (
          <>
            <p className="text-xs text-[var(--c-muted)] tracking-widest mt-2">+</p>
            <p
              className="text-sm font-bold tracking-widest"
              style={{ color: '#ffaa00' }}
            >
              {GIMMICK_DEFS[secondaryGimmick].label.toUpperCase()}
            </p>
            <p className="text-xs text-[var(--c-muted)] max-w-xs">
              {GIMMICK_DEFS[secondaryGimmick].description}
            </p>
          </>
        )}
      </div>
      <p className="text-[var(--c-muted)] text-xs mt-4 animate-pulse">TAP TO START</p>
    </div>
  );
}
