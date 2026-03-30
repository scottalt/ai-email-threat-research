'use client';

import { useState } from 'react';
import { PERK_DEFS, GIMMICK_DEFS } from '@/lib/roguelike';
import type { PerkId, GimmickId } from '@/lib/roguelike';
import { playClick, playPerkBuy } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  perks: PerkId[];          // IDs of offered perks (3 items)
  intel: number;
  lives: number;
  floor: number;            // just-cleared floor (0-indexed)
  nextGimmick: GimmickId | null;
  sigintLine?: string;
  onBuy: (perkId: PerkId) => Promise<void>;
  onSkip: () => void;
}

export function RoguelikePerkShop({
  perks,
  intel,
  lives,
  floor,
  nextGimmick,
  sigintLine,
  onBuy,
  onSkip,
}: Props) {
  const { soundEnabled } = useSoundEnabled();
  const [buying, setBuying] = useState<PerkId | null>(null);
  const [purchased, setPurchased] = useState<PerkId | null>(null);

  async function handleBuy(perkId: PerkId) {
    if (buying) return;
    setBuying(perkId);
    try {
      await onBuy(perkId);
      if (soundEnabled) playPerkBuy();
      setPurchased(perkId);
    } finally {
      setBuying(null);
    }
  }

  function handleSkip() {
    if (soundEnabled) playClick();
    onSkip();
  }

  const nextGimmickDef = nextGimmick ? GIMMICK_DEFS[nextGimmick] : null;

  return (
    <div className="flex flex-col items-center gap-5 p-6 font-mono max-w-md mx-auto anim-fade-in-up">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2
          className="text-xl font-bold tracking-widest"
          style={{ color: '#ffaa00' }}
        >
          FIELD REQUISITION
        </h2>
        <p className="text-sm text-[var(--c-muted)] tracking-wide">
          Floor {floor + 1} cleared
        </p>
      </div>

      {/* SIGINT line */}
      {sigintLine && (
        <p className="text-xs italic text-[var(--c-secondary)] text-center px-4 leading-relaxed">
          &ldquo;{sigintLine}&rdquo;
        </p>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-bold tabular-nums" style={{ color: '#ffaa00' }}>
          {intel} INTEL
        </span>
        <span className="text-[var(--c-muted)]">·</span>
        <span className="tracking-tight" aria-label={`${lives} lives`}>
          {Array.from({ length: lives }, (_, i) => (
            <span key={i} style={{ color: '#ff3333' }}>♥</span>
          ))}
        </span>
      </div>

      {/* Next floor preview */}
      {nextGimmickDef && (
        <div className="w-full term-border px-4 py-3 space-y-1">
          <p className="text-xs text-[var(--c-muted)] tracking-widest">NEXT FLOOR INTEL</p>
          <p
            className="text-sm font-bold tracking-wide"
            style={{ color: nextGimmickDef.tier === 1 ? '#00ff41' : '#00d4ff' }}
          >
            {nextGimmickDef.label.toUpperCase()}
          </p>
          <p className="text-xs text-[var(--c-secondary)] leading-relaxed">
            {nextGimmickDef.description}
          </p>
        </div>
      )}

      {/* Perk cards */}
      <div className="w-full flex flex-col sm:flex-row gap-3">
        {perks.map((perkId) => {
          const def = PERK_DEFS.find((p) => p.id === perkId);
          if (!def) return null;
          const canAfford = intel >= def.cost;
          const isBuying = buying === perkId;
          const isPurchased = purchased === perkId;
          const isDisabled = !canAfford || !!buying || !!purchased;

          return (
            <button
              key={perkId}
              onClick={() => !isDisabled && handleBuy(perkId)}
              disabled={isDisabled}
              className={`
                flex-1 term-border px-3 py-4 text-left space-y-2 transition-all active:scale-95
                ${isPurchased
                  ? 'border-[color-mix(in_srgb,#00ff41_50%,transparent)] bg-[#00ff4110]'
                  : canAfford && !purchased
                    ? 'hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-xs font-bold tracking-widest"
                  style={{ color: isPurchased ? '#00ff41' : canAfford ? '#00ff41' : 'var(--c-muted)' }}
                >
                  {isPurchased ? '✓ ' : ''}{def.label.toUpperCase()}
                </span>
                {def.cost > 0 && (
                  <span
                    className="text-xs font-bold tabular-nums shrink-0"
                    style={{ color: isPurchased ? '#00ff41' : canAfford ? '#ffaa00' : 'var(--c-muted)' }}
                  >
                    {def.cost} INTEL
                  </span>
                )}
                {def.cost === 0 && (
                  <span className="text-xs font-bold" style={{ color: '#00ff41' }}>
                    FREE
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--c-secondary)] leading-relaxed">
                {def.description}
              </p>
              {isBuying && (
                <p className="text-xs text-[var(--c-muted)] animate-pulse tracking-widest">
                  ACQUIRING...
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Skip / Continue button */}
      <button
        onClick={handleSkip}
        className="w-full py-3 text-sm tracking-widest text-[var(--c-secondary)] hover:text-[var(--c-primary)] active:scale-95 transition-all term-border"
      >
        {purchased ? '[ NEXT FLOOR ]' : '[ SKIP — SAVE INTEL ]'}
      </button>
    </div>
  );
}
