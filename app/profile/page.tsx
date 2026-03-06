'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from '@/components/LevelMeter';
import { getRankFromLevel } from '@/lib/rank';
import Link from 'next/link';
import type { PlayerBackground } from '@/lib/types';

const RANKS = [
  { label: 'ZERO_DAY',         levels: '28–30', color: '#ff3333', glowClass: 'glow-red',   minLevel: 28 },
  { label: 'APT_ANALYST',      levels: '25–27', color: '#ff4400', glowClass: '',           minLevel: 25 },
  { label: 'RED_TEAMER',       levels: '22–24', color: '#ffaa00', glowClass: 'glow-amber', minLevel: 22 },
  { label: 'INCIDENT_HANDLER', levels: '19–21', color: '#ffaa00', glowClass: '',           minLevel: 19 },
  { label: 'THREAT_HUNTER',    levels: '16–18', color: '#ffcc00', glowClass: '',           minLevel: 16 },
  { label: 'SOC_ANALYST',      levels: '13–15', color: '#00ff41', glowClass: 'glow',       minLevel: 13 },
  { label: 'HEADER_READER',    levels: '10–12', color: '#00ff41', glowClass: '',           minLevel: 10 },
  { label: 'LINK_CHECKER',     levels: '7–9',   color: '#00aa28', glowClass: '',           minLevel: 7  },
  { label: 'PHISH_BAIT',       levels: '4–6',   color: '#447744', glowClass: '',           minLevel: 4  },
  { label: 'CLICK_HAPPY',      levels: '1–3',   color: '#2a4a2a', glowClass: '',           minLevel: 1  },
];

const BACKGROUND_OPTIONS: { value: PlayerBackground; label: string }[] = [
  { value: 'other',             label: 'OTHER' },
  { value: 'technical',         label: 'TECHNICAL / NON-SECURITY' },
  { value: 'infosec',           label: 'INFOSEC / CYBERSECURITY' },
  { value: 'prefer_not_to_say', label: 'PREFER NOT TO SAY' },
];

export default function ProfilePage() {
  const { profile, loading, signedIn, applyProfile } = usePlayer();
  const [editingBackground, setEditingBackground] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);

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
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <span className="text-[#00aa28] text-xs font-mono">LOADING...</span>
      </main>
    );
  }

  if (!signedIn || !profile) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="term-border bg-[#060c06] px-4 py-6 text-center space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">NOT_AUTHENTICATED</div>
            <div className="text-[#003a0e] text-[10px] font-mono">Sign in to view your profile.</div>
            <Link href="/" className="block text-[#00ff41] text-xs font-mono hover:underline">
              ← BACK TO TERMINAL
            </Link>
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

  const topRows: { label: string; value: string | number }[] = [
    { label: 'CALLSIGN', value: profile.displayName ?? '—' },
  ];

  const bottomRows: { label: string; value: string | number }[] = [
    { label: 'LEVEL',             value: profile.level },
    { label: 'TOTAL XP',          value: `${profile.xp.toLocaleString()} XP` },
    { label: 'SESSIONS',          value: profile.totalSessions },
    { label: 'RESEARCH SESSIONS', value: profile.researchSessionsCompleted },
    { label: 'GRADUATION',        value: profile.researchGraduated ? 'GRADUATED — EXPERT UNLOCKED' : `${profile.researchSessionsCompleted}/3 sessions` },
    { label: 'PERSONAL BEST',     value: `${profile.personalBestScore.toLocaleString()} pts` },
  ];

  return (
    <main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">OPERATOR_PROFILE</span>
            <Link href="/" className="text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28]">← TERMINAL</Link>
          </div>

          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {topRows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <span className="text-[#003a0e] text-[10px] font-mono tracking-wider">{label}</span>
                <span className="text-xs font-mono font-bold text-[#00ff41]">{value}</span>
              </div>
            ))}

            {/* BACKGROUND row — editable */}
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#003a0e] text-[10px] font-mono tracking-wider">BACKGROUND</span>
                {!editingBackground ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#00ff41]">
                      {profile.background ? (backgroundLabel[profile.background] ?? '—') : '—'}
                    </span>
                    <button
                      onClick={() => setEditingBackground(true)}
                      className="text-[#003a0e] text-[9px] font-mono hover:text-[#00aa28] transition-colors"
                    >
                      [EDIT]
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingBackground(false)}
                    className="text-[#003a0e] text-[9px] font-mono hover:text-[#00aa28] transition-colors"
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
                      className={`py-1.5 font-mono text-[9px] tracking-wider transition-all border disabled:opacity-40 ${
                        profile.background === opt.value
                          ? 'text-[#00ff41] border-[rgba(0,255,65,0.8)] bg-[rgba(0,255,65,0.08)]'
                          : 'text-[#003a0e] border-[rgba(0,255,65,0.15)] hover:text-[#00aa28] hover:border-[rgba(0,255,65,0.4)]'
                      }`}
                    >
                      {backgroundSaving ? '...' : opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {bottomRows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <span className="text-[#003a0e] text-[10px] font-mono tracking-wider">{label}</span>
                <span className={`text-xs font-mono font-bold ${
                  label === 'GRADUATION' && profile.researchGraduated
                    ? 'text-[#ffaa00]'
                    : 'text-[#00ff41]'
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="px-3 pb-3 pt-2">
            <LevelMeter xp={profile.xp} level={profile.level} />
          </div>
        </div>

        {/* Rank ladder */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-xs tracking-widest">RANK_PROGRESSION</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {RANKS.map((rank) => {
              const isCurrent = getRankFromLevel(profile.level).label === rank.label;
              return (
                <div key={rank.label} className={`flex items-center justify-between px-3 py-2 ${isCurrent ? 'bg-[rgba(0,255,65,0.04)]' : ''}`}>
                  <div className="flex items-center gap-2">
                    {isCurrent && <span className="text-[#00ff41] text-[9px] font-mono">▶</span>}
                    {!isCurrent && <span className="text-[9px] font-mono opacity-0">▶</span>}
                    <span
                      className={`text-xs font-mono font-bold ${rank.glowClass} ${isCurrent ? 'anim-rank-pulse' : ''}`}
                      style={{ color: rank.color }}
                    >
                      {rank.label}
                    </span>
                  </div>
                  <span className="text-[#003a0e] text-[10px] font-mono">LVL {rank.levels}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin override panel — only visible to admin */}
        {isAdmin && (
          <div className="border border-[rgba(255,170,0,0.3)] bg-[#060c06]">
            <button
              onClick={() => setShowAdmin(o => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono hover:bg-[rgba(255,170,0,0.04)] transition-colors"
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
                      <div className="text-[#ffaa00] text-[9px] font-mono tracking-wider">{label}</div>
                      <input
                        type="number"
                        value={value}
                        onChange={e => set(e.target.value)}
                        className="w-full bg-transparent border border-[rgba(255,170,0,0.25)] px-2 py-1 text-[#ffaa00] font-mono text-xs focus:outline-none focus:border-[rgba(255,170,0,0.6)]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#ffaa00] text-[9px] font-mono tracking-wider">RESEARCH_GRADUATED</span>
                  <button
                    onClick={() => setAdminGraduated(v => !v)}
                    className={`px-3 py-0.5 font-mono text-[10px] border transition-colors ${
                      adminGraduated
                        ? 'text-[#ffaa00] border-[rgba(255,170,0,0.6)] bg-[rgba(255,170,0,0.08)]'
                        : 'text-[#664400] border-[rgba(255,170,0,0.2)] hover:border-[rgba(255,170,0,0.4)]'
                    }`}
                  >
                    {adminGraduated ? 'TRUE' : 'FALSE'}
                  </button>
                </div>

                {adminMsg && (
                  <div className={`text-[10px] font-mono ${adminMsg === 'APPLIED' ? 'text-[#00ff41]' : 'text-[#ff3333]'}`}>
                    {adminMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminApply(false)}
                    disabled={adminSaving}
                    className="flex-1 py-1.5 border border-[rgba(255,170,0,0.4)] text-[#ffaa00] font-mono text-[10px] tracking-widest hover:bg-[rgba(255,170,0,0.06)] disabled:opacity-40 transition-colors"
                  >
                    {adminSaving ? '...' : '[ APPLY ]'}
                  </button>
                  <button
                    onClick={() => handleAdminApply(true)}
                    disabled={adminSaving}
                    className="flex-1 py-1.5 border border-[rgba(255,170,0,0.2)] text-[#664400] font-mono text-[10px] tracking-widest hover:text-[#ffaa00] hover:border-[rgba(255,170,0,0.4)] disabled:opacity-40 transition-colors"
                  >
                    {adminSaving ? '...' : '[ RESET LEVEL ]'}
                  </button>
                </div>
                <div className="text-[#664400] text-[9px] font-mono">RESET LEVEL recalculates level from XP</div>
                <Link
                  href="/admin"
                  className="block w-full py-1.5 border border-[rgba(255,170,0,0.2)] text-[#664400] font-mono text-[10px] tracking-widest hover:text-[#ffaa00] hover:border-[rgba(255,170,0,0.4)] transition-colors text-center"
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
