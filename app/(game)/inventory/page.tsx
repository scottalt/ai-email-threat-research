'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { useSigint } from '@/lib/SigintContext';
import { THEMES, isThemeUnlocked } from '@/lib/themes';
import { ACHIEVEMENTS, RARITY_COLORS, RARITY_BADGE_CLASS } from '@/lib/achievements';
import { useTheme } from '@/lib/ThemeContext';
import { getRankFromPoints } from '@/lib/h2h';
import { Handler } from '@/components/Handler';
import { PROMO_DIALOGUES } from '@/lib/sigint-personality';
import Link from 'next/link';

import { RARITY_ORDER } from '@/lib/achievements';
import type { AchievementRarity } from '@/lib/achievements';

type Tab = 'themes' | 'badges' | 'codes' | 'shop';

export default function InventoryPage() {
  const { profile, loading, signedIn, refreshProfile } = usePlayer();
  const { theme: activeTheme, setThemeId } = useTheme();
  const { triggerSigint } = useSigint();

  // SIGINT: first inventory visit (fire once per mount)
  const sigintFired = useRef(false);
  useEffect(() => {
    if (signedIn && profile && !sigintFired.current) {
      sigintFired.current = true;
      triggerSigint('first_inventory');
    }
  }, [signedIn, profile, triggerSigint]);
  const [tab, setTab] = useState<Tab>('themes');

  // SIGINT: fire one-time dialogue when switching to each tab
  const TAB_MOMENTS: Record<Tab, string | null> = {
    themes: null, // covered by first_inventory on page load
    badges: 'first_tab_badges',
    codes: 'first_tab_codes',
    shop: null, // shop has its own page
  };
  function handleTabChange(t: Tab) {
    setTab(t);
    const moment = TAB_MOMENTS[t];
    if (moment) triggerSigint(moment);
  }
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
                        <span className={RARITY_BADGE_CLASS[featuredAchievement.rarity]} style={{ color: RARITY_COLORS[featuredAchievement.rarity] }}>
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
          {(['themes', 'badges', 'codes', 'shop'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
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
          {/* Instructions */}
          <div className="term-border bg-[var(--c-bg)] px-3 py-2 mb-3">
            <p className="text-[var(--c-muted)] text-xs font-mono leading-relaxed">
              Tap earned badges to add them to your <span className="text-[var(--c-secondary)]">shelf</span> (up to 5).
              Your shelf is visible on your profile. To set a <span className="text-[var(--c-accent)]">PvP display badge</span>, go to
              your <span className="text-[var(--c-secondary)]">Profile → INFO</span> tab and tap SET PvP on any shelf badge.
            </p>
            <p className="text-[var(--c-muted)] text-xs font-mono mt-1">
              Shelf: <span className="text-[var(--c-primary)]">{profile.featuredBadges?.length ?? 0}/5</span>
              {(profile.featuredBadges?.length ?? 0) >= 5 && <span className="text-[var(--c-accent)]"> — FULL</span>}
            </p>
          </div>
          {/* Rarity filter */}
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              onClick={() => setRarityFilter('all')}
              className={`text-xs font-mono px-2 py-1 border transition-all ${rarityFilter === 'all' ? 'text-[var(--c-primary)] border-[var(--c-primary)]' : 'text-[var(--c-muted)] border-[var(--c-dark)] hover:text-[var(--c-secondary)]'}`}
            >ALL</button>
            {RARITY_ORDER.filter((r) => r !== 'unique' && r !== 'secret').map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`text-xs font-mono px-2 py-1 border transition-all ${rarityFilter === r ? 'border-current' : 'border-[var(--c-dark)] hover:border-current'}`}
                style={{ color: rarityFilter === r ? RARITY_COLORS[r] : 'var(--c-muted)' }}
              >{r.toUpperCase()}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {ACHIEVEMENTS.filter((a) => {
              // Hide unique-rarity badges unless the player owns them
              if ((a.rarity === 'unique' || a.rarity === 'secret') && !(profile.achievements?.includes(a.id))) return false;
              return rarityFilter === 'all' || a.rarity === rarityFilter;
            }).map((achievement) => {
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
                      headers: { 'Content-Type': 'application/json' },
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
                  <div className={`text-2xl text-center mb-1 ${earned ? RARITY_BADGE_CLASS[achievement.rarity] : ''}`} style={{ color: earned ? rarityColor : '#555' }}>
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

        {tab === 'codes' && (
          <CodesTab refreshProfile={refreshProfile} />
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

// ── Codes Tab (inline component) ──

function CodesTab({ refreshProfile }: { refreshProfile: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultDialogue, setResultDialogue] = useState<{ lines: string[]; buttonText?: string } | null>(null);
  const [unlockedBadgeId, setUnlockedBadgeId] = useState<string | null>(null);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setResultDialogue(null);
    setUnlockedBadgeId(null);

    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        setUnlockedBadgeId(data.badgeId);
        setResultDialogue(PROMO_DIALOGUES.code_success);
        refreshProfile();
        setCode('');
      } else if (data.error === 'ALREADY_REDEEMED') {
        setResultDialogue(PROMO_DIALOGUES.code_already);
      } else if (data.error === 'EXHAUSTED' || data.error === 'EXPIRED') {
        setResultDialogue(data.error === 'EXPIRED' ? PROMO_DIALOGUES.code_expired : PROMO_DIALOGUES.code_exhausted);
      } else if (res.status === 429) {
        setResultDialogue({ lines: ["Slow down. Too many attempts.", "Try again in a minute."], buttonText: "OK" });
      } else {
        setResultDialogue(PROMO_DIALOGUES.code_invalid);
      }
    } catch {
      setResultDialogue({ lines: ["Network error. Couldn't verify the code.", "Check your connection and try again."], buttonText: "OK" });
    } finally {
      setSubmitting(false);
    }
  }

  const unlockedBadge = unlockedBadgeId ? ACHIEVEMENTS.find(a => a.id === unlockedBadgeId) : null;

  return (
    <div className="space-y-3">
      {/* Code input */}
      <div className="term-border bg-[var(--c-bg)]">
        <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-2">
          <span className="text-[var(--c-accent)] text-sm font-mono tracking-widest">PROMO_CODE</span>
        </div>
        <form onSubmit={handleRedeem} className="px-4 py-4 space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 30))}
            placeholder="ENTER CODE..."
            className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-3 text-[var(--c-primary)] font-mono text-sm tracking-widest text-center focus:outline-none focus:border-[var(--c-accent)] placeholder:text-[var(--c-dark)] transition-colors"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="w-full py-3 term-border text-[var(--c-accent)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none btn-glow"
          >
            {submitting ? '[ VERIFYING... ]' : '[ REDEEM ]'}
          </button>
        </form>
      </div>

      {/* Unlocked badge showcase */}
      {unlockedBadge && (
        <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3 anim-fade-in-up">
          <div className="text-xs font-mono tracking-widest text-[var(--c-muted)]">BADGE UNLOCKED</div>
          <div
            className={`text-5xl ${RARITY_BADGE_CLASS[unlockedBadge.rarity]}`}
            style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
          >
            {unlockedBadge.icon}
          </div>
          <div
            className="text-lg font-mono font-black tracking-widest"
            style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
          >
            {unlockedBadge.name}
          </div>
          <div className="text-sm font-mono text-[var(--c-secondary)]">
            {unlockedBadge.description}
          </div>
          <div
            className="text-xs font-mono tracking-widest font-bold"
            style={{ color: RARITY_COLORS[unlockedBadge.rarity] }}
          >
            {unlockedBadge.rarity.toUpperCase()}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-center space-y-1">
        <p className="text-[var(--c-muted)] text-xs font-mono">
          Promo codes are case-insensitive and limited quantity.
        </p>
        <p className="text-[var(--c-muted)] text-xs font-mono">
          Unlocked badges appear in the BADGES tab.
        </p>
      </div>

      {/* SIGINT result dialogue */}
      {resultDialogue && (
        <Handler
          lines={resultDialogue.lines}
          buttonText={resultDialogue.buttonText}
          onDismiss={() => setResultDialogue(null)}
        />
      )}
    </div>
  );
}
