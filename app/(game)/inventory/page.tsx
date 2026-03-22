'use client';

import { useState } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { THEMES, isThemeUnlocked } from '@/lib/themes';
import { useTheme } from '@/lib/ThemeContext';
import Link from 'next/link';

type Tab = 'themes' | 'badges';

export default function InventoryPage() {
  const { profile, loading, signedIn } = usePlayer();
  const { theme: activeTheme, setThemeId } = useTheme();
  const [tab, setTab] = useState<Tab>('themes');

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

        {/* Tab bar */}
        <div className="term-border bg-[var(--c-bg)] flex">
          {(['themes', 'badges'] as Tab[]).map((t) => (
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
          <div className="term-border bg-[var(--c-bg)] px-4 py-8 text-center">
            <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">COMING_SOON</div>
            <div className="text-[var(--c-muted)] text-sm font-mono mt-2">Badge collection is under development.</div>
          </div>
        )}
      </div>
    </main>
  );
}
