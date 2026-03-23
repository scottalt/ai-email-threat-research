'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from '@/components/LevelMeter';
import { getRankFromLevel } from '@/lib/rank';
import { ACHIEVEMENTS, RARITY_COLORS, CATEGORY_LABELS, type AchievementCategory } from '@/lib/achievements';
import { THEMES, isThemeUnlocked, type ThemeDef } from '@/lib/themes';
import { useTheme } from '@/lib/ThemeContext';
import Link from 'next/link';
import type { PlayerBackground } from '@/lib/types';

const RANKS = [
  { label: 'ZERO_DAY',         levels: '28–30', color: '#ff3333', minLevel: 28 },
  { label: 'APT_ANALYST',      levels: '25–27', color: '#ff4400', minLevel: 25 },
  { label: 'RED_TEAMER',       levels: '22–24', color: '#ffaa00', minLevel: 22 },
  { label: 'INCIDENT_HANDLER', levels: '19–21', color: '#ffaa00', minLevel: 19 },
  { label: 'THREAT_HUNTER',    levels: '16–18', color: '#ffcc00', minLevel: 16 },
  { label: 'SOC_ANALYST',      levels: '13–15', color: '#00ff41', minLevel: 13 },
  { label: 'HEADER_READER',    levels: '10–12', color: '#00ff41', minLevel: 10 },
  { label: 'LINK_CHECKER',     levels: '7–9',   color: '#00aa28', minLevel: 7  },
  { label: 'PHISH_BAIT',       levels: '4–6',   color: '#447744', minLevel: 4  },
  { label: 'CLICK_HAPPY',      levels: '1–3',   color: '#2a4a2a', minLevel: 1  },
];

const BACKGROUND_OPTIONS: { value: PlayerBackground; label: string }[] = [
  { value: 'other',             label: 'OTHER' },
  { value: 'technical',         label: 'TECHNICAL / NON-SECURITY' },
  { value: 'infosec',           label: 'INFOSEC / CYBERSECURITY' },
  { value: 'prefer_not_to_say', label: 'PREFER NOT TO SAY' },
];

export default function ProfilePage() {
  const { profile, loading, signedIn, applyProfile } = usePlayer();
  const { theme: activeTheme, setThemeId } = useTheme();
  const [editingCallsign, setEditingCallsign] = useState(false);
  const [callsignValue, setCallsignValue] = useState('');
  const [callsignSaving, setCallsignSaving] = useState(false);
  const [callsignError, setCallsignError] = useState('');
  const [editingBackground, setEditingBackground] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  // Admin override panel
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminXp, setAdminXp] = useState('');
  const [adminLevel, setAdminLevel] = useState('');
  const [adminGraduated, setAdminGraduated] = useState(false);
  const [adminSessions, setAdminSessions] = useState('');
  const [adminResearchSessions, setAdminResearchSessions] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');

  useEffect(() => {
    fetch('/api/player/admin-check').then(r => { if (r.ok) setIsAdmin(true); });
  }, []);

  useEffect(() => {
    if (!profile) return;
    setAdminXp(String(profile.xp));
    setAdminLevel(String(profile.level));
    setAdminGraduated(profile.researchGraduated);
    setAdminSessions(String(profile.totalSessions));
    setAdminResearchSessions(String(profile.researchSessionsCompleted));
  }, [profile]);

  async function handleAdminApply(reset?: boolean) {
    setAdminSaving(true);
    setAdminMsg('');
    try {
      const body: Record<string, unknown> = {
        xp: parseInt(adminXp, 10) || 0,
        researchGraduated: adminGraduated,
        totalSessions: parseInt(adminSessions, 10) || 0,
        researchSessionsCompleted: parseInt(adminResearchSessions, 10) || 0,
      };
      if (reset) {
        body.reset = true;
      } else {
        body.level = parseInt(adminLevel, 10) || 1;
      }
      const res = await fetch('/api/player/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        applyProfile(await res.json());
        setAdminMsg('APPLIED');
      } else {
        const d = await res.json();
        setAdminMsg(d.error ?? 'FAILED');
      }
    } finally {
      setAdminSaving(false);
    }
  }

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
            <div className="text-[var(--c-secondary)] text-sm font-mono opacity-70">Sign in to view your profile.</div>
          </div>
        </div>
      </main>
    );
  }

  const backgroundLabel: Record<string, string> = {
    other:            'OTHER',
    technical:        'TECHNICAL / NON-SECURITY',
    infosec:          'INFOSEC / CYBERSECURITY',
    prefer_not_to_say: '—',
  };

  async function handleSaveCallsign() {
    const trimmed = callsignValue.trim().slice(0, 20);
    if (!trimmed) { setCallsignError('CALLSIGN REQUIRED'); return; }
    setCallsignSaving(true);
    setCallsignError('');
    try {
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (res.ok) {
        applyProfile(await res.json());
        setEditingCallsign(false);
      } else {
        const d = await res.json();
        setCallsignError(d.error ?? 'SAVE FAILED');
      }
    } finally {
      setCallsignSaving(false);
    }
  }

  async function handleSetBackground(value: PlayerBackground) {
    setBackgroundSaving(true);
    try {
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ background: value }),
      });
      if (res.ok) {
        applyProfile(await res.json());
        setEditingBackground(false);
      }
    } finally {
      setBackgroundSaving(false);
    }
  }

  const topRows: { label: string; value: string | number }[] = [];

  const bottomRows: { label: string; value: string | number }[] = [
    { label: 'LEVEL',             value: profile.level },
    { label: 'TOTAL XP',          value: `${profile.xp.toLocaleString()} XP` },
    { label: 'CURRENT STREAK',    value: profile.currentStreak > 0 ? `${profile.currentStreak} days` : '—' },
    { label: 'LONGEST STREAK',    value: profile.longestStreak > 0 ? `${profile.longestStreak} days` : '—' },
    { label: 'SESSIONS',          value: profile.totalSessions },
    { label: 'RESEARCH SESSIONS', value: profile.researchSessionsCompleted },
    { label: 'GRADUATION',        value: profile.researchGraduated ? 'GRADUATED — EXPERT UNLOCKED' : `${profile.researchSessionsCompleted}/3 sessions` },
    { label: 'PERSONAL BEST',     value: `${profile.personalBestScore.toLocaleString()} pts` },
  ];

  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-sm lg:max-w-4xl space-y-4 lg:space-y-6">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">OPERATOR_PROFILE</span>
          </div>

          <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
            {/* CALLSIGN row — editable */}
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">CALLSIGN</span>
                {!editingCallsign ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-[var(--c-primary)]">{profile.displayName ?? '—'}</span>
                    <button
                      type="button"
                      onClick={() => { setCallsignValue(profile.displayName ?? ''); setCallsignError(''); setEditingCallsign(true); }}
                      className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                    >
                      [EDIT]
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingCallsign(false)}
                    className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                  >
                    [CANCEL]
                  </button>
                )}
              </div>
              {editingCallsign && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={callsignValue}
                    onChange={(e) => setCallsignValue(e.target.value.slice(0, 20))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCallsign(); }}
                    maxLength={20}
                    autoFocus
                    className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-2 py-1 text-[var(--c-primary)] font-mono text-sm focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_70%,transparent)] placeholder:text-[var(--c-dark)]"
                    placeholder="UP TO 20 CHARACTERS"
                  />
                  {callsignError && (
                    <div className="text-[#ff3333] text-sm font-mono">{callsignError}</div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveCallsign}
                    disabled={callsignSaving}
                    className="w-full py-1.5 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] disabled:opacity-40 transition-colors"
                  >
                    {callsignSaving ? '...' : '[ SAVE ]'}
                  </button>
                </div>
              )}
            </div>

            {/* BACKGROUND row — editable */}
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">BACKGROUND</span>
                {!editingBackground ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-[var(--c-primary)]">
                      {profile.background ? (backgroundLabel[profile.background] ?? '—') : '—'}
                    </span>
                    <button
                      onClick={() => setEditingBackground(true)}
                      className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                    >
                      [EDIT]
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingBackground(false)}
                    className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                  >
                    [CANCEL]
                  </button>
                )}
              </div>
              {editingBackground && (
                <div className="grid grid-cols-2 gap-1.5">
                  {BACKGROUND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={backgroundSaving}
                      onClick={() => handleSetBackground(opt.value)}
                      className={`py-1.5 font-mono text-sm tracking-wider transition-all border disabled:opacity-40 ${
                        profile.background === opt.value
                          ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_80%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]'
                          : 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] hover:text-[var(--c-primary)] hover:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]'
                      }`}
                    >
                      {backgroundSaving ? '...' : opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stat rows — grid on desktop, stacked on mobile */}
            <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] lg:divide-y-0 lg:grid lg:grid-cols-4 lg:gap-px lg:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
              {bottomRows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between lg:flex-col lg:items-center lg:text-center px-3 py-2 lg:py-3 bg-[var(--c-bg)]">
                  <span className="text-[var(--c-secondary)] text-sm lg:text-xs font-mono tracking-wider">{label}</span>
                  <span className={`text-sm font-mono font-bold ${
                    label === 'GRADUATION' && profile.researchGraduated
                      ? 'text-[var(--c-accent)]'
                      : 'text-[var(--c-primary)]'
                  }`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 pb-3 pt-2">
            <LevelMeter xp={profile.xp} level={profile.level} />
          </div>
        </div>

        {/* Terminal Themes — prominent placement */}
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">TERMINAL_THEMES</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {THEMES.map((t) => {
              const unlocked = isThemeUnlocked(t, profile.level, profile.researchGraduated);
              const isActive = activeTheme.id === t.id;
              return (
                <button
                  key={t.id}
                  disabled={!unlocked}
                  onClick={() => { if (unlocked) setThemeId(t.id); }}
                  className={`text-left transition-all ${unlocked ? 'hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'}`}
                >
                  {/* Mini terminal preview */}
                  <div
                    className="rounded-sm overflow-hidden border"
                    style={{
                      borderColor: unlocked
                        ? isActive
                          ? t.colors.primary
                          : `color-mix(in srgb, ${t.colors.primary} 40%, transparent)`
                        : '#222',
                      backgroundColor: t.colors.bg,
                      boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${t.colors.primary} 25%, transparent)` : 'none',
                    }}
                  >
                    {/* Preview header bar */}
                    <div
                      className="px-2 py-1 flex items-center justify-between"
                      style={{ borderBottom: `1px solid color-mix(in srgb, ${t.colors.primary} 30%, transparent)` }}
                    >
                      <span className="text-[10px] font-mono tracking-widest font-bold" style={{ color: t.colors.secondary }}>
                        {t.name}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: t.colors.muted }}>
                        {isActive ? '[ ON ]' : unlocked ? '' : ''}
                      </span>
                    </div>
                    {/* Preview body */}
                    <div className="px-2 py-2 space-y-1">
                      <div className="text-[11px] font-mono" style={{ color: t.colors.primary }}>
                        {'>'} SYSTEM READY
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: t.colors.secondary }}>
                        {'>'} SCANNING...
                      </div>
                      <div className="flex gap-1 mt-1">
                        {[t.colors.primary, t.colors.secondary, t.colors.muted, t.colors.dark].map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Label below preview */}
                  <div className="mt-1.5 px-0.5">
                    <div className="text-xs font-mono font-bold" style={{ color: unlocked ? t.colors.primary : '#555' }}>
                      {t.name}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: unlocked ? t.colors.secondary : '#444' }}>
                      {t.subtitle}
                    </div>
                    {!unlocked && (
                      <div className="text-[10px] font-mono text-[#555] mt-0.5">
                        &#128274; {!profile.researchGraduated ? 'GRADUATE RESEARCH' : t.unlockLabel}
                      </div>
                    )}
                    {isActive && (
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: t.colors.primary }}>
                        ACTIVE
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible sections: rank ladder + achievements */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
          {/* Rank ladder — collapsible on mobile */}
          <div className="term-border bg-[var(--c-bg)]">
            <button
              onClick={() => setShowRanks(o => !o)}
              className="lg:hidden w-full border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-colors"
            >
              <span className="text-[var(--c-secondary)] text-sm tracking-widest">RANK_PROGRESSION</span>
              <span className="text-[var(--c-secondary)] text-sm">{showRanks ? '▲' : '▼'}</span>
            </button>
            <div className="hidden lg:block border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">RANK_PROGRESSION</span>
            </div>
            <div className={`${showRanks ? '' : 'hidden'} lg:block divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]`}>
              {RANKS.map((rank) => {
                const isCurrent = getRankFromLevel(profile.level).label === rank.label;
                return (
                  <div key={rank.label} className={`flex items-center justify-between px-3 py-2 lg:py-2.5 ${isCurrent ? 'bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]' : ''}`}>
                    <div className="flex items-center gap-2">
                      {isCurrent && <span className="text-[var(--c-primary)] text-sm lg:text-base font-mono">▶</span>}
                      {!isCurrent && <span className="text-sm lg:text-base font-mono opacity-0">▶</span>}
                      <span
                        className={`text-sm lg:text-base font-mono font-bold ${isCurrent ? 'anim-rank-pulse' : ''}`}
                        style={{ color: rank.color }}
                      >
                        {rank.label}
                      </span>
                    </div>
                    <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono opacity-60">LVL {rank.levels}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Achievements — collapsible on mobile */}
          <div className="term-border bg-[var(--c-bg)]">
            <button
              onClick={() => setShowAchievements(o => !o)}
              className="lg:hidden w-full border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-colors"
            >
              <span className="text-[var(--c-secondary)] text-sm tracking-widest">ACHIEVEMENTS</span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--c-secondary)] text-sm font-mono">{profile.achievements?.length ?? 0}/{ACHIEVEMENTS.length}</span>
                <span className="text-[var(--c-secondary)] text-sm">{showAchievements ? '▲' : '▼'}</span>
              </div>
            </button>
            <div className="hidden lg:flex border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 items-center justify-between">
              <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">ACHIEVEMENTS</span>
              <span className="text-[var(--c-secondary)] text-sm font-mono">{profile.achievements?.length ?? 0}/{ACHIEVEMENTS.length}</span>
            </div>
            <div className={`${showAchievements ? '' : 'hidden'} lg:block divide-y divide-[color-mix(in_srgb,var(--c-primary)_6%,transparent)]`}>
              {(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map((cat) => {
                const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
                return (
                  <div key={cat}>
                    <div className="px-3 py-1.5 bg-[color-mix(in_srgb,var(--c-primary)_2%,transparent)]">
                      <span className="text-[var(--c-muted)] text-sm font-mono tracking-widest">{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)]">
                      {catAchievements.map((a) => {
                        const unlocked = profile.achievements?.includes(a.id) ?? false;
                        const color = unlocked ? RARITY_COLORS[a.rarity] : 'var(--c-muted)';
                        return (
                          <div
                            key={a.id}
                            className={`px-3 py-2.5 bg-[var(--c-bg)] ${unlocked ? '' : 'opacity-40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-mono" style={{ color }}>{a.icon}</span>
                              <span className="text-sm font-mono font-bold tracking-wider" style={{ color }}>
                                {a.name}
                              </span>
                            </div>
                            <div className="text-sm font-mono mt-0.5" style={{ color: unlocked ? 'var(--c-secondary)' : 'var(--c-muted)' }}>
                              {unlocked ? a.description : '[LOCKED]'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Data deletion request */}
        {signedIn && profile && (
          <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,#ff3333_15%,transparent)]">
            <div className="border-b border-[color-mix(in_srgb,#ff3333_15%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-muted)] text-sm tracking-widest">DATA_MANAGEMENT</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <p className="text-[var(--c-muted)] text-xs font-mono leading-relaxed">
                Request deletion of your account and data. Research answers may be retained in anonymized form.
              </p>
              <a
                href={`mailto:scott@scottaltiparmak.com?subject=${encodeURIComponent(`[Data Deletion Request] ${profile.displayName}`)}&body=${encodeURIComponent(`I would like to request deletion of my Threat Terminal account.\n\nCallsign: ${profile.displayName}\nPlayer ID: ${profile.id}\n\nPlease delete:\n- [ ] My account and profile only (keep anonymized research answers)\n- [ ] Everything (account + all answers including research)\n`)}`}
                className="block w-full py-2 border border-[color-mix(in_srgb,#ff3333_30%,transparent)] text-[#ff3333] font-mono text-sm tracking-widest hover:bg-[rgba(255,51,51,0.05)] transition-colors text-center"
              >
                [ REQUEST DATA DELETION ]
              </a>
            </div>
          </div>
        )}

        {/* Admin override panel — only visible to admin */}
        {isAdmin && (
          <div className="border border-[rgba(255,170,0,0.3)] bg-[var(--c-bg)]">
            <button
              onClick={() => setShowAdmin(o => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[rgba(255,170,0,0.04)] transition-colors"
            >
              <span className="text-[#ffaa00] tracking-widest">[⚙] DEV_OVERRIDE</span>
              <span className="text-[#ffaa00]">{showAdmin ? '▲' : '▼'}</span>
            </button>
            {showAdmin && (
              <div className="border-t border-[rgba(255,170,0,0.2)] px-3 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'XP', value: adminXp, set: setAdminXp },
                    { label: 'LEVEL (1-30)', value: adminLevel, set: setAdminLevel },
                    { label: 'SESSIONS', value: adminSessions, set: setAdminSessions },
                    { label: 'RESEARCH SESSIONS', value: adminResearchSessions, set: setAdminResearchSessions },
                  ].map(({ label, value, set }) => (
                    <div key={label} className="space-y-1">
                      <div className="text-[#ffaa00] text-sm font-mono tracking-wider">{label}</div>
                      <input
                        type="number"
                        value={value}
                        onChange={e => set(e.target.value)}
                        className="w-full bg-transparent border border-[rgba(255,170,0,0.25)] px-2 py-1 text-[#ffaa00] font-mono text-sm focus:outline-none focus:border-[rgba(255,170,0,0.6)]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#ffaa00] text-sm font-mono tracking-wider">RESEARCH_GRADUATED</span>
                  <button
                    onClick={() => setAdminGraduated(v => !v)}
                    className={`px-3 py-0.5 font-mono text-sm border transition-colors ${
                      adminGraduated
                        ? 'text-[#ffaa00] border-[rgba(255,170,0,0.6)] bg-[rgba(255,170,0,0.08)]'
                        : 'text-[#664400] border-[rgba(255,170,0,0.2)] hover:border-[rgba(255,170,0,0.4)]'
                    }`}
                  >
                    {adminGraduated ? 'TRUE' : 'FALSE'}
                  </button>
                </div>

                {adminMsg && (
                  <div className={`text-sm font-mono ${adminMsg === 'APPLIED' ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}`}>
                    {adminMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminApply(false)}
                    disabled={adminSaving}
                    className="flex-1 py-1.5 border border-[rgba(255,170,0,0.4)] text-[#ffaa00] font-mono text-sm tracking-widest hover:bg-[rgba(255,170,0,0.06)] disabled:opacity-40 transition-colors"
                  >
                    {adminSaving ? '...' : '[ APPLY ]'}
                  </button>
                  <button
                    onClick={() => handleAdminApply(true)}
                    disabled={adminSaving}
                    className="flex-1 py-1.5 border border-[rgba(255,170,0,0.2)] text-[#664400] font-mono text-sm tracking-widest hover:text-[#ffaa00] hover:border-[rgba(255,170,0,0.4)] disabled:opacity-40 transition-colors"
                  >
                    {adminSaving ? '...' : '[ RESET LEVEL ]'}
                  </button>
                </div>
                <div className="text-[#664400] text-sm font-mono">RESET LEVEL recalculates level from XP</div>
                <Link
                  href="/admin"
                  className="block w-full py-1.5 border border-[rgba(255,170,0,0.2)] text-[#664400] font-mono text-sm tracking-widest hover:text-[#ffaa00] hover:border-[rgba(255,170,0,0.4)] transition-colors text-center"
                >
                  [ ADMIN PORTAL ]
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
