'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { THEMES, isThemeUnlocked } from '@/lib/themes';
import { ACHIEVEMENTS, RARITY_COLORS } from '@/lib/achievements';
import { useTheme } from '@/lib/ThemeContext';
import { getRankFromPoints } from '@/lib/h2h';
import Link from 'next/link';

import { RARITY_ORDER } from '@/lib/achievements';
import type { AchievementRarity } from '@/lib/achievements';

type Tab = 'themes' | 'badges' | 'shop';

export default function InventoryPage() {
  const { profile, loading, signedIn, refreshProfile } = usePlayer();
  const { theme: activeTheme, setThemeId } = useTheme();
  const [tab, setTab] = useState<Tab>('themes');
  const [showPreview, setShowPreview] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<AchievementRarity | 'all'>('all');
  const [h2hRank, setH2HRank] = useState<{ rankLabel: string; rankPoints: number; rankColor: string } | null>(null);
  const [achievementStats, setAchievementStats] = useState<Record<string, number>>({});
  const researchComplete = (profile?.researchAnswersSubmitted ?? 0) >= 30;

  useEffect(() => {
    if (!profile?.researchGraduated) return;
    fetch('/api/h2h/stats').then(async (res) => {
      if (res.ok) setH2HRank(await res.json());
    }).catch(() => {});
  }, [profile?.researchGraduated]);

  useEffect(() => {
    fetch('/api/achievements/stats')
      .then((r) => r.json())
      .then((d) => setAchievementStats(d.stats ?? {}))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
        <span className="text-[var(--c-secondary)] text-sm font-mono">LOADING...</span>
      </main>
    );
  }

  if (!signedIn || !profile) {
    return (
      <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-center justify-center px-4 lg:pt-16 pb-20 lg:pb-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3">
            <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">NOT_AUTHENTICATED</div>
            <div className="text-[var(--c-secondary)] text-sm font-mono opacity-70">Sign in to access your inventory.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[var(--c-secondary)] text-sm font-mono tracking-wider hover:text-[var(--c-primary)] transition-colors"
          >
            &lt; BACK
          </Link>
          <h1 className="text-[var(--c-primary)] text-sm font-mono tracking-widest font-bold">INVENTORY</h1>
          <div className="w-12" />
        </div>

        {/* Opponent preview — what others see */}
        <div className="term-border bg-[var(--c-bg)]">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] active:scale-[0.98] transition-all"
          >
            <span className="text-[var(--c-secondary)] tracking-widest">OPPONENT_VIEW</span>
            <span className="text-[var(--c-secondary)]">{showPreview ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showPreview && (() => {
            const featuredAchievement = profile.featuredBadge
              ? ACHIEVEMENTS.find((a) => a.id === profile.featuredBadge)
              : null;
            return (
              <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-4 py-4">
                <div className="text-[var(--c-muted)] text-xs font-mono mb-3 text-center">This is how you appear to opponents in PvP</div>
                <div className="border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] p-4 max-w-xs mx-auto">
                  <div className="text-center space-y-2">
                    <div className="text-[var(--c-primary)] text-sm font-mono font-bold">
                      {profile.displayName ?? 'ANON'}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-mono">
                      {featuredAchievement && (
                        <span style={{ color: RARITY_COLORS[featuredAchievement.rarity] }}>
                          {featuredAchievement.icon}
                        </span>
                      )}
                      <span style={{ color: h2hRank?.rankColor ?? 'var(--c-muted)' }}>
                        {h2hRank?.rankLabel ?? 'BRONZE'}
                      </span>
                      <span className="text-[var(--c-muted)]">{h2hRank?.rankPoints ?? 0} pts</span>
                    </div>
                    {featuredAchievement && (
                      <div className="text-xs font-mono" style={{ color: RARITY_COLORS[featuredAchievement.rarity] }}>
                        {featuredAchievement.name}
                      </div>
                    )}
                    {!featuredAchievement && (
                      <div className="text-[var(--c-muted)] text-xs font-mono">No badge equipped</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tab bar */}
        <div className="term-border bg-[var(--c-bg)] flex">
          {(['themes', 'badges', 'shop'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-mono tracking-widest transition-colors ${
                tab === t
                  ? 'text-[var(--c-primary)] bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] border-b-2 border-[var(--c-primary)]'
                  : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)] border-b-2 border-transparent'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'themes' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const unlocked = isThemeUnlocked(t, profile.level, profile.researchGraduated);
              const isActive = activeTheme.id === t.id;
              return (
                <button
                  key={t.id}
                  disabled={!unlocked}
                  onClick={() => { if (unlocked) setThemeId(t.id); }}
                  className={`text-left transition-all term-border bg-[var(--c-bg)] p-3 ${
                    unlocked
                      ? 'hover:scale-[1.02] cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{
                    borderColor: isActive
                      ? t.colors.primary
                      : undefined,
                    boxShadow: isActive
                      ? `0 0 12px color-mix(in srgb, ${t.colors.primary} 25%, transparent)`
                      : 'none',
                  }}
                >
                  {/* Color swatch + name */}
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: t.colors.primary }}
                    />
                    <span
                      className="text-xs font-mono font-bold tracking-widest"
                      style={{ color: unlocked ? t.colors.primary : '#555' }}
                    >
                      {t.name}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <div
                    className="text-[10px] font-mono mb-2"
                    style={{ color: unlocked ? t.colors.secondary : '#444' }}
                  >
                    {t.subtitle}
                  </div>

                  {/* Status */}
                  {isActive && (
                    <div
                      className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 border inline-block"
                      style={{
                        color: t.colors.primary,
                        borderColor: `color-mix(in srgb, ${t.colors.primary} 50%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${t.colors.primary} 8%, transparent)`,
                      }}
                    >
                      EQUIPPED
                    </div>
                  )}
                  {!unlocked && (
                    <div className="text-[10px] font-mono text-[#555] tracking-wider">
                      LVL {t.unlockLevel}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {tab === 'badges' && (
          <>
          {/* Rarity filter */}
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              onClick={() => setRarityFilter('all')}
              className={`text-xs font-mono px-2 py-1 border transition-all ${rarityFilter === 'all' ? 'text-[var(--c-primary)] border-[var(--c-primary)]' : 'text-[var(--c-muted)] border-[var(--c-dark)] hover:text-[var(--c-secondary)]'}`}
            >ALL</button>
            {RARITY_ORDER.map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`text-xs font-mono px-2 py-1 border transition-all ${rarityFilter === r ? 'border-current' : 'border-[var(--c-dark)] hover:border-current'}`}
                style={{ color: rarityFilter === r ? RARITY_COLORS[r] : 'var(--c-muted)' }}
              >{r.toUpperCase()}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {ACHIEVEMENTS.filter((a) => rarityFilter === 'all' || a.rarity === rarityFilter).map((achievement) => {
              const earned = profile.achievements?.includes(achievement.id) ?? false;
              const onShelf = profile.featuredBadges?.includes(achievement.id) ?? false;
              const featured = profile.featuredBadge === achievement.id;
              const highlighted = onShelf || featured;
              const rarityColor = RARITY_COLORS[achievement.rarity];
              const shelfFull = (profile.featuredBadges?.length ?? 0) >= 5;

              return (
                <button
                  key={achievement.id}
                  disabled={!earned || (shelfFull && !onShelf)}
                  onClick={async () => {
                    if (!earned) return;
                    await fetch('/api/player/featured-badge', {
                      method: 'PATCH',
                      body: JSON.stringify({ badgeId: achievement.id, action: 'shelf' }),
                    });
                    refreshProfile();
                  }}
                  className={`text-left transition-all term-border bg-[var(--c-bg)] p-3 ${
                    earned
                      ? (shelfFull && !onShelf) ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{
                    borderColor: highlighted ? rarityColor : undefined,
                    boxShadow: highlighted
                      ? `0 0 12px color-mix(in srgb, ${rarityColor} 25%, transparent)`
                      : 'none',
                  }}
                >
                  {/* Icon */}
                  <div className="text-2xl text-center mb-1" style={{ color: earned ? rarityColor : '#555' }}>
                    {earned ? achievement.icon : '🔒'}
                  </div>

                  {/* Name */}
                  <div
                    className="text-xs font-mono font-bold tracking-widest text-center mb-0.5"
                    style={{ color: earned ? rarityColor : '#555' }}
                  >
                    {achievement.name}
                  </div>

                  {/* Description — hidden for locked badges until 30 research answers */}
                  <div className="text-[10px] font-mono text-center mb-2" style={{ color: earned ? 'var(--c-secondary)' : '#444' }}>
                    {earned || researchComplete ? achievement.description : '???'}
                  </div>

                  {/* Rarity + season label */}
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className="text-[10px] font-mono tracking-widest"
                      style={{ color: earned ? rarityColor : '#555' }}
                    >
                      {achievement.rarity.toUpperCase()}
                    </span>
                    {achievement.season && (
                      <span className="text-[10px] font-mono text-[#ff0080]">
                        S0
                      </span>
                    )}
                  </div>

                  {/* Completion percentage */}
                  <div className="text-[10px] font-mono text-[var(--c-muted)] text-center">
                    {achievementStats[achievement.id] !== undefined
                      ? `${achievementStats[achievement.id]}% of players`
                      : ''}
                  </div>

                  {/* Shelf / Featured badge indicator */}
                  {onShelf && (
                    <div
                      className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 border mt-1.5 text-center"
                      style={{
                        color: rarityColor,
                        borderColor: `color-mix(in srgb, ${rarityColor} 50%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${rarityColor} 8%, transparent)`,
                      }}
                    >
                      {profile.featuredBadges?.[0] === achievement.id ? 'PvP BADGE' : 'ON SHELF'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          </>
        )}

        {tab === 'shop' && (
          <div className="term-border bg-[var(--c-bg)] px-4 py-8 text-center space-y-4">
            <div className="text-4xl">🏪</div>
            <div className="text-[#ff0080] text-lg font-mono font-bold tracking-widest">COMING SOON</div>
            <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed max-w-sm mx-auto">
              Earn coins through gameplay. Spend them on exclusive themes, badges, and cosmetics your opponents will see in PvP.
            </div>
            <div className="text-[var(--c-muted)] text-xs font-mono">Season 1</div>
          </div>
        )}
      </div>
    </main>
  );
}
