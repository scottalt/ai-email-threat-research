'use client';

import { useEffect } from 'react';
import { ACHIEVEMENT_MAP, RARITY_COLORS } from '@/lib/achievements';
import { playAchievement } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  achievementIds: string[];
}

export function AchievementToast({ achievementIds }: Props) {
  const { soundEnabled } = useSoundEnabled();

  useEffect(() => {
    if (achievementIds.length > 0 && soundEnabled) {
      playAchievement();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (achievementIds.length === 0) return null;

  return (
    <div className="space-y-2">
      {achievementIds.map((id) => {
        const def = ACHIEVEMENT_MAP.get(id);
        if (!def) return null;
        const color = RARITY_COLORS[def.rarity];

        return (
          <div
            key={id}
            className="term-border bg-[var(--c-bg)] anim-fade-in-up overflow-hidden"
            style={{ borderColor: `${color}44` }}
          >
            <div
              className="border-b px-3 py-1.5 flex items-center gap-2"
              style={{ borderColor: `${color}33` }}
            >
              <span style={{ color }} className="text-sm font-mono">★</span>
              <span style={{ color }} className="text-sm font-mono tracking-widest font-bold">
                ACHIEVEMENT UNLOCKED
              </span>
            </div>
            <div className="px-3 py-3 flex items-center gap-3">
              <span
                className="relative text-2xl font-mono anim-rank-pulse anim-achievement-burst"
                style={{ color }}
              >
                <span className="absolute inset-0 rounded-full anim-glow-ring" style={{ backgroundColor: 'currentColor' }} />
                {def.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-mono font-bold tracking-wider"
                  style={{ color }}
                >
                  {def.name}
                </div>
                <div className="text-[var(--c-secondary)] text-sm font-mono mt-0.5">
                  {def.description}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
