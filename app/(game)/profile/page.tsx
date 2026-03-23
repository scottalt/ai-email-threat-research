'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from '@/components/LevelMeter';
import { getRankFromLevel } from '@/lib/rank';
import { ACHIEVEMENTS, RARITY_COLORS, CATEGORY_LABELS, type AchievementCategory } from '@/lib/achievements';
import { getRankFromPoints, H2H_DAILY_RATED_CAP } from '@/lib/h2h';
import Link from 'next/link';
import type { PlayerBackground } from '@/lib/types';

interface SoloStats {
  totalAnswers: number;
  totalCorrect: number;
  overallAccuracy: number;
  phishingCatchRate: number | null;
  legitAccuracy: number | null;
  byDifficulty: Record<string, { total: number; correct: number }>;
  byConfidence: Record<string, { total: number; correct: number }>;
  avgTimeMs: number | null;
  headersRate: number;
  urlRate: number;
  byMode: Record<string, { total: number; correct: number }>;
  activity: Record<string, number>;
}

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'extreme'];
const CONFIDENCE_ORDER = ['guessing', 'likely', 'certain'];
const MODE_LABELS: Record<string, string> = { freeplay: 'FREEPLAY', daily: 'DAILY', expert: 'EXPERT' };

function AccuracyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-[#0a140a] mt-1">
      <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

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
  const { profile, loading, signedIn, applyProfile, refreshProfile } = usePlayer();
  const [editingCallsign, setEditingCallsign] = useState(false);
  const [callsignValue, setCallsignValue] = useState('');
  const [callsignSaving, setCallsignSaving] = useState(false);
  const [callsignError, setCallsignError] = useState('');
  const [editingBackground, setEditingBackground] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [profileTab, setProfileTab] = useState<'info' | 'solo' | 'h2h' | 'friends'>('info');
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [shelfSaving, setShelfSaving] = useState(false);
  const [h2hStats, setH2HStats] = useState<{
    rankLabel: string; rankIcon: string; rankPoints: number; rankColor: string;
    wins: number; losses: number; winStreak: number; bestWinStreak: number;
    peakRankPoints: number; ratedMatchesToday: number;
  } | null>(null);
  const [soloStats, setSoloStats] = useState<SoloStats | null>(null);
  const [soloStatsEmpty, setSoloStatsEmpty] = useState(false);
  const [soloStatsError, setSoloStatsError] = useState('');

  // Friends
  const [friendsData, setFriendsData] = useState<{
    friends: { playerId: string; displayName: string; level: number; rankPoints: number; rankLabel: string }[];
    incoming: { requestId: string; from: { playerId: string; displayName: string } }[];
    outgoing: { requestId: string; to: { playerId: string; displayName: string } }[];
  } | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [addFriendCallsign, setAddFriendCallsign] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [addFriendMsg, setAddFriendMsg] = useState('');

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

  // Lazy-load friends data when tab selected
  useEffect(() => {
    if (profileTab !== 'friends' || friendsData || friendsLoading) return;
    setFriendsLoading(true);
    fetch('/api/friends')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFriendsData(data); })
      .catch(() => {})
      .finally(() => setFriendsLoading(false));
  }, [profileTab, friendsData, friendsLoading]);

  async function handleAddFriend() {
    const callsign = addFriendCallsign.trim();
    if (!callsign) return;
    setAddFriendStatus('sending');
    setAddFriendMsg('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCallsign: callsign }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddFriendStatus('sent');
        setAddFriendMsg('REQUEST SENT');
        setAddFriendCallsign('');
        setFriendsData(null); // refetch
      } else {
        setAddFriendStatus('error');
        setAddFriendMsg(data.error ?? 'FAILED');
      }
    } catch {
      setAddFriendStatus('error');
      setAddFriendMsg('NETWORK ERROR');
    }
  }

  async function handleFriendAction(requestId: string, action: 'accept' | 'reject') {
    try {
      const res = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) setFriendsData(null); // refetch
    } catch { /* ignore */ }
  }

  async function handleRemoveFriend(friendId: string) {
    try {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) setFriendsData(null); // refetch
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!signedIn) return;
    // Fetch solo stats
    fetch('/api/player/stats')
      .then(r => {
        if (r.status === 403) { setSoloStatsError('LOCKED'); return null; }
        if (!r.ok) { setSoloStatsError('FAILED'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.empty) { setSoloStatsEmpty(true); return; }
        setSoloStats(data);
      })
      .catch(() => setSoloStatsError('FAILED'));

    // Fetch h2h stats
    fetch('/api/h2h/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setH2HStats(data); })
      .catch(() => {});
  }, [signedIn]);

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

  async function handleSaveBio() {
    setBioSaving(true);
    try {
      const res = await fetch('/api/player/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioValue }),
      });
      if (res.ok) {
        await refreshProfile();
        setEditingBio(false);
      }
    } finally {
      setBioSaving(false);
    }
  }

  async function handleSetPrivacy(level: 'public' | 'friends' | 'private') {
    setPrivacySaving(true);
    try {
      const res = await fetch('/api/player/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacyLevel: level }),
      });
      if (res.ok) {
        await refreshProfile();
      }
    } finally {
      setPrivacySaving(false);
    }
  }

  async function handleToggleShelfBadge(badgeId: string) {
    setShelfSaving(true);
    try {
      const res = await fetch('/api/player/featured-badge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId, action: 'shelf' }),
      });
      if (res.ok) {
        await refreshProfile();
      }
    } finally {
      setShelfSaving(false);
    }
  }

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

  const avgTimeSec = soloStats?.avgTimeMs ? (soloStats.avgTimeMs / 1000).toFixed(1) : null;
  const activityValues = soloStats ? Object.values(soloStats.activity) : [];
  const maxActivity = Math.max(...activityValues, 1);

  return (
    <main className="min-h-screen bg-[var(--c-bg-alt)] flex items-start justify-center px-4 py-8 lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-sm lg:max-w-4xl space-y-4 lg:space-y-6">
        {/* Player header — always visible */}
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

        {/* Tab bar */}
        <div className="term-border bg-[var(--c-bg)] flex">
          <button
            onClick={() => setProfileTab('info')}
            className={`flex-1 py-2 text-sm font-mono tracking-widest transition-colors ${
              profileTab === 'info'
                ? 'text-[var(--c-primary)] bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] border-b-2 border-[var(--c-primary)]'
                : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)] border-b-2 border-transparent'
            }`}
          >
            INFO
          </button>
          <button
            onClick={() => setProfileTab('solo')}
            className={`flex-1 py-2 text-sm font-mono tracking-widest transition-colors ${
              profileTab === 'solo'
                ? 'text-[var(--c-primary)] bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] border-b-2 border-[var(--c-primary)]'
                : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)] border-b-2 border-transparent'
            }`}
          >
            SOLO STATS
          </button>
          <button
            onClick={() => setProfileTab('h2h')}
            className={`flex-1 py-2 text-sm font-mono tracking-widest transition-colors ${
              profileTab === 'h2h'
                ? 'text-[#ff0080] bg-[rgba(255,0,128,0.06)] border-b-2 border-[#ff0080]'
                : 'text-[var(--c-secondary)] hover:text-[#ff0080] border-b-2 border-transparent'
            }`}
          >
            PvP STATS
          </button>
          <button
            onClick={() => setProfileTab('friends')}
            className={`flex-1 py-2 text-sm font-mono tracking-widest transition-colors ${
              profileTab === 'friends'
                ? 'text-[var(--c-primary)] bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] border-b-2 border-[var(--c-primary)]'
                : 'text-[var(--c-secondary)] hover:text-[var(--c-primary)] border-b-2 border-transparent'
            }`}
          >
            FRIENDS
          </button>
        </div>

        {/* ═══════════════ INFO TAB ═══════════════ */}
        {profileTab === 'info' && (
          <>
            <div className="text-center space-y-2">
              <Link href="/inventory" className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-widest">
                [ MANAGE THEMES + BADGES IN INVENTORY ]
              </Link>
              <br />
              <Link href="/intel/player" className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-widest">
                [ VIEW INTEL BRIEFING ]
              </Link>
              {profile.displayName && (
                <>
                  <br />
                  <Link href={`/player/${encodeURIComponent(profile.displayName)}`} className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors tracking-widest">
                    [ VIEW PUBLIC PROFILE ]
                  </Link>
                </>
              )}
            </div>

            {/* Bio editor */}
            <div className="term-border bg-[var(--c-bg)]">
              <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
                <span className="text-[var(--c-secondary)] text-sm tracking-widest">BIO</span>
                {!editingBio ? (
                  <button
                    type="button"
                    onClick={() => { setBioValue(profile.bio ?? ''); setEditingBio(true); }}
                    className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                  >
                    [EDIT]
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingBio(false)}
                    className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] transition-colors"
                  >
                    [CANCEL]
                  </button>
                )}
              </div>
              <div className="px-3 py-2">
                {editingBio ? (
                  <div className="space-y-2">
                    <textarea
                      value={bioValue}
                      onChange={(e) => setBioValue(e.target.value.slice(0, 200))}
                      maxLength={200}
                      rows={3}
                      className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-2 py-1.5 text-[var(--c-primary)] font-mono text-sm focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_70%,transparent)] placeholder:text-[var(--c-dark)] resize-none"
                      placeholder="Write something about yourself..."
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--c-muted)] text-xs font-mono">{bioValue.length}/200</span>
                      <button
                        type="button"
                        onClick={handleSaveBio}
                        disabled={bioSaving}
                        className="px-4 py-1 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] disabled:opacity-40 transition-colors"
                      >
                        {bioSaving ? '...' : '[ SAVE ]'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[var(--c-secondary)] text-sm font-mono">
                    {profile.bio || <span className="text-[var(--c-muted)]">No bio set.</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Privacy toggle */}
            <div className="term-border bg-[var(--c-bg)]">
              <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                <span className="text-[var(--c-secondary)] text-sm tracking-widest">PROFILE_PRIVACY</span>
              </div>
              <div className="px-3 py-2 flex gap-2">
                {(['public', 'friends', 'private'] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    disabled={privacySaving}
                    onClick={() => handleSetPrivacy(level)}
                    className={`flex-1 py-1.5 font-mono text-sm tracking-wider transition-all border disabled:opacity-40 ${
                      profile.privacyLevel === level
                        ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_80%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]'
                        : 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] hover:text-[var(--c-primary)] hover:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]'
                    }`}
                  >
                    {level === 'friends' ? 'FRIENDS' : level.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-2">
                <span className="text-[var(--c-muted)] text-xs font-mono">
                  {profile.privacyLevel === 'public' && 'Anyone can see your profile.'}
                  {profile.privacyLevel === 'friends' && 'Only friends can see your profile. (coming soon)'}
                  {profile.privacyLevel === 'private' && 'Your profile is hidden from others.'}
                </span>
              </div>
            </div>

            {/* Featured badge shelf */}
            <div className="term-border bg-[var(--c-bg)]">
              <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
                <span className="text-[var(--c-secondary)] text-sm tracking-widest">BADGE_SHELF</span>
                <span className="text-[var(--c-muted)] text-xs font-mono">{profile.featuredBadges?.length ?? 0}/5</span>
              </div>
              {(profile.featuredBadges?.length ?? 0) > 0 ? (
                <div className="px-3 py-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    {profile.featuredBadges.map((id, idx) => {
                      const badge = ACHIEVEMENTS.find(a => a.id === id);
                      if (!badge) return null;
                      const color = RARITY_COLORS[badge.rarity];
                      const isPvpBadge = idx === 0;
                      return (
                        <button
                          key={badge.id}
                          type="button"
                          disabled={shelfSaving}
                          onClick={() => handleToggleShelfBadge(badge.id)}
                          className="relative flex flex-col items-center gap-1 px-3 py-2 border min-w-[70px] hover:scale-[1.02] disabled:opacity-40 transition-all cursor-pointer"
                          style={{ borderColor: isPvpBadge ? color : `${color}40` }}
                          title={`Remove ${badge.name} from shelf`}
                        >
                          {isPvpBadge && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1 bg-[var(--c-bg)]" style={{ color }}>PvP</span>
                          )}
                          <span className="text-xl font-mono" style={{ color }}>{badge.icon}</span>
                          <span className="text-xs font-mono font-bold tracking-wider" style={{ color }}>{badge.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[var(--c-muted)] text-xs font-mono text-center mt-2">Tap to remove from shelf</div>
                </div>
              ) : (
                <div className="px-3 py-3 text-center">
                  <span className="text-[var(--c-muted)] text-sm font-mono">No badges on shelf. Tap earned badges below to add.</span>
                </div>
              )}
              {/* Add to shelf — show earned badges not on shelf */}
              {(() => {
                const shelfSet = new Set(profile.featuredBadges ?? []);
                const addable = ACHIEVEMENTS.filter(a => (profile.achievements?.includes(a.id) ?? false) && !shelfSet.has(a.id));
                if (addable.length === 0 || (profile.featuredBadges?.length ?? 0) >= 5) return null;
                return (
                  <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-2">
                    <div className="text-[var(--c-muted)] text-xs font-mono mb-2">TAP TO ADD:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {addable.map(a => {
                        const color = RARITY_COLORS[a.rarity];
                        return (
                          <button
                            key={a.id}
                            type="button"
                            disabled={shelfSaving}
                            onClick={() => handleToggleShelfBadge(a.id)}
                            className="flex items-center gap-1.5 px-2 py-1 border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] hover:border-current disabled:opacity-40 transition-all text-sm font-mono"
                            style={{ color }}
                            title={`Add ${a.name} to shelf`}
                          >
                            <span>{a.icon}</span>
                            <span className="text-xs tracking-wider">{a.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Collapsible sections: rank ladder + achievements */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
              {/* Rank ladder — collapsible on mobile */}
              <div className="term-border bg-[var(--c-bg)]">
                <button
                  onClick={() => setShowRanks(o => !o)}
                  className="lg:hidden w-full border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-colors"
                >
                  <span className="text-[var(--c-secondary)] text-sm tracking-widest">XP_RANK</span>
                  <span className="text-[var(--c-secondary)] text-sm">{showRanks ? '▲' : '▼'}</span>
                </button>
                <div className="hidden lg:block border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                  <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">XP_RANK</span>
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

              {/* H2H rank — only for graduated players */}
              {profile.researchGraduated && h2hStats && (
                <div className="term-border bg-[var(--c-bg)]">
                  <div className="border-b border-[rgba(255,0,128,0.25)] px-3 py-1.5">
                    <span className="text-[#ff0080] text-sm lg:text-base tracking-widest">PvP_RANK</span>
                  </div>
                  <div className="px-3 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg" style={{ color: h2hStats.rankColor }}>{h2hStats.rankIcon}</span>
                      <span className="text-sm lg:text-base font-mono font-bold" style={{ color: h2hStats.rankColor }}>{h2hStats.rankLabel}</span>
                    </div>
                    <div className="text-sm font-mono text-[var(--c-secondary)]">
                      {h2hStats.rankPoints} pts · {h2hStats.wins}W {h2hStats.losses}L
                    </div>
                  </div>
                </div>
              )}

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
          </>
        )}

        {/* ═══════════════ SOLO STATS TAB ═══════════════ */}
        {profileTab === 'solo' && (
          <>
            {soloStatsError === 'LOCKED' ? (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3">
                <div className="text-[var(--c-accent)] text-sm font-mono tracking-widest">STATS_LOCKED</div>
                <div className="text-[var(--c-muted)] text-sm font-mono">Complete 30 research answers to unlock your personal stats.</div>
              </div>
            ) : soloStatsError ? (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center">
                <div className="text-[#ff3333] text-sm font-mono">LOAD_FAILED</div>
              </div>
            ) : soloStatsEmpty ? (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-3">
                <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">NO_DATA</div>
                <div className="text-[var(--c-muted)] text-sm font-mono">Play some rounds in Freeplay, Daily, or Expert to see your stats.</div>
              </div>
            ) : !soloStats ? (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center">
                <span className="text-[var(--c-secondary)] text-sm font-mono">LOADING...</span>
              </div>
            ) : (
              <>
                {/* Core stats */}
                <div className="term-border bg-[var(--c-bg)]">
                  <div className="grid grid-cols-3 divide-x divide-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
                    <div className="px-3 py-4 text-center">
                      <div className="text-2xl font-black font-mono text-[var(--c-primary)]">{soloStats.overallAccuracy}%</div>
                      <div className="text-sm font-mono text-[var(--c-muted)] mt-1">ACCURACY</div>
                    </div>
                    <div className="px-3 py-4 text-center">
                      <div className="text-2xl font-black font-mono text-[var(--c-primary)]">{soloStats.totalAnswers}</div>
                      <div className="text-sm font-mono text-[var(--c-muted)] mt-1">ANALYZED</div>
                    </div>
                    <div className="px-3 py-4 text-center">
                      <div className="text-2xl font-black font-mono text-[var(--c-primary)]">{avgTimeSec ?? '—'}s</div>
                      <div className="text-sm font-mono text-[var(--c-muted)] mt-1">AVG TIME</div>
                    </div>
                  </div>
                </div>

                {/* Detection split */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="term-border bg-[var(--c-bg)] border-[rgba(255,51,51,0.3)] text-center px-3 py-3">
                    <div className="text-[#ff3333] text-2xl font-black font-mono">{soloStats.phishingCatchRate ?? '—'}%</div>
                    <div className="text-sm font-mono text-[var(--c-secondary)] mt-1 tracking-wider">THREATS CAUGHT</div>
                  </div>
                  <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] text-center px-3 py-3">
                    <div className="text-[var(--c-primary)] text-2xl font-black font-mono">{soloStats.legitAccuracy ?? '—'}%</div>
                    <div className="text-sm font-mono text-[var(--c-secondary)] mt-1 tracking-wider">LEGIT CLEARED</div>
                  </div>
                </div>

                {/* Two-column layout on desktop */}
                <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
                  {/* Left column */}
                  <div className="space-y-4">
                    {/* By game mode */}
                    <div className="term-border bg-[var(--c-bg)]">
                      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                        <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">BY_GAME_MODE</span>
                      </div>
                      <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                        {Object.entries(soloStats.byMode).map(([mode, data]) => {
                          const pct = Math.round((data.correct / data.total) * 100);
                          const color = pct >= 80 ? 'var(--c-primary)' : pct >= 60 ? '#ffaa00' : '#ff3333';
                          return (
                            <div key={mode} className="px-3 py-2.5 lg:py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono tracking-wider">{MODE_LABELS[mode] ?? mode.toUpperCase()}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--c-muted)] text-sm lg:text-base font-mono">{data.total} answers</span>
                                  <span className="text-sm lg:text-base font-mono font-bold" style={{ color }}>{pct}%</span>
                                </div>
                              </div>
                              <AccuracyBar pct={pct} color={color} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tool usage */}
                    <div className="term-border bg-[var(--c-bg)]">
                      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                        <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">TOOL_USAGE</span>
                      </div>
                      <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                        <div className="px-3 py-2.5 lg:py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono tracking-wider">HEADERS CHECKED</span>
                            <span className="text-sm lg:text-base font-mono font-bold text-[var(--c-primary)]">{soloStats.headersRate}%</span>
                          </div>
                          <AccuracyBar pct={soloStats.headersRate} color="var(--c-secondary)" />
                        </div>
                        <div className="px-3 py-2.5 lg:py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono tracking-wider">URLS INSPECTED</span>
                            <span className="text-sm lg:text-base font-mono font-bold text-[var(--c-primary)]">{soloStats.urlRate}%</span>
                          </div>
                          <AccuracyBar pct={soloStats.urlRate} color="var(--c-secondary)" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    {/* By difficulty */}
                    <div className="term-border bg-[var(--c-bg)]">
                      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                        <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">ACCURACY_BY_DIFFICULTY</span>
                      </div>
                      <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                        {DIFFICULTY_ORDER.map(d => {
                          const data = soloStats.byDifficulty[d];
                          if (!data || data.total < 3) return null;
                          const pct = Math.round((data.correct / data.total) * 100);
                          const color = pct >= 80 ? 'var(--c-primary)' : pct >= 60 ? '#ffaa00' : '#ff3333';
                          return (
                            <div key={d} className="px-3 py-2.5 lg:py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono tracking-wider">{d.toUpperCase()}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--c-muted)] text-sm lg:text-base font-mono">{data.correct}/{data.total}</span>
                                  <span className="text-sm lg:text-base font-mono font-bold" style={{ color }}>{pct}%</span>
                                </div>
                              </div>
                              <AccuracyBar pct={pct} color={color} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Confidence calibration */}
                    <div className="term-border bg-[var(--c-bg)]">
                      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                        <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">CONFIDENCE_CALIBRATION</span>
                      </div>
                      <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                        {CONFIDENCE_ORDER.map(c => {
                          const data = soloStats.byConfidence[c];
                          if (!data || data.total < 3) return null;
                          const pct = Math.round((data.correct / data.total) * 100);
                          const color = c === 'certain' ? (pct >= 90 ? 'var(--c-primary)' : '#ff3333')
                            : c === 'likely' ? (pct >= 70 ? 'var(--c-primary)' : '#ffaa00')
                            : 'var(--c-secondary)';
                          return (
                            <div key={c} className="px-3 py-2.5 lg:py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--c-secondary)] text-sm lg:text-base font-mono tracking-wider">{c.toUpperCase()}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--c-muted)] text-sm lg:text-base font-mono">{data.correct}/{data.total}</span>
                                  <span className="text-sm lg:text-base font-mono font-bold" style={{ color }}>{pct}%</span>
                                </div>
                              </div>
                              <AccuracyBar pct={pct} color={color} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-3 py-2 text-sm lg:text-base font-mono text-[var(--c-muted)]">
                        CERTAIN should be 90%+. If not, recalibrate.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity heatmap */}
                <div className="term-border bg-[var(--c-bg)]">
                  <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                    <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">ACTIVITY_14D</span>
                  </div>
                  <div className="px-3 py-3">
                    <div className="flex gap-1 items-end h-12 lg:h-16">
                      {Object.entries(soloStats.activity).map(([date, count]) => {
                        const height = count > 0 ? Math.max(15, (count / maxActivity) * 100) : 4;
                        const opacity = count > 0 ? 0.3 + (count / maxActivity) * 0.7 : 0.08;
                        return (
                          <div
                            key={date}
                            className="flex-1 rounded-sm"
                            style={{
                              height: `${height}%`,
                              backgroundColor: 'var(--c-primary)',
                              opacity,
                            }}
                            title={`${date}: ${count} answers`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[var(--c-muted)] text-xs font-mono">{Object.keys(soloStats.activity)[0]?.slice(5)}</span>
                      <span className="text-[var(--c-muted)] text-xs font-mono">TODAY</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════════ H2H STATS TAB ═══════════════ */}
        {profileTab === 'h2h' && (
          <>
            {!h2hStats || (h2hStats.wins === 0 && h2hStats.losses === 0) ? (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center space-y-2">
                <div className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">NO_PvP_DATA</div>
                <div className="text-[var(--c-muted)] text-sm font-mono">No PvP matches played yet.</div>
              </div>
            ) : (
              <>
                {/* Rank card */}
                <div className="term-border bg-[var(--c-bg)]" style={{ borderColor: `${h2hStats.rankColor}50` }}>
                  <div className="border-b px-3 py-1.5" style={{ borderColor: `${h2hStats.rankColor}50` }}>
                    <span className="text-sm lg:text-base tracking-widest" style={{ color: h2hStats.rankColor }}>CURRENT_RANK</span>
                  </div>
                  <div className="px-4 py-5 text-center space-y-1">
                    <div className="text-3xl font-mono" style={{ color: h2hStats.rankColor }}>{h2hStats.rankIcon}</div>
                    <div className="text-xl font-black font-mono tracking-widest" style={{ color: h2hStats.rankColor }}>{h2hStats.rankLabel}</div>
                    <div className="text-sm font-mono text-[var(--c-muted)]">{h2hStats.rankPoints} RP</div>
                  </div>
                </div>

                {/* Record */}
                {(() => {
                  const totalMatches = h2hStats.wins + h2hStats.losses;
                  const winrate = totalMatches > 0 ? Math.round((h2hStats.wins / totalMatches) * 100) : 0;
                  return (
                    <div className="term-border bg-[var(--c-bg)]">
                      <div className="border-b border-[rgba(255,0,128,0.3)] px-3 py-1.5">
                        <span className="text-[#ff0080] text-sm lg:text-base tracking-widest">MATCH_RECORD</span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-[rgba(255,0,128,0.1)]">
                        <div className="px-3 py-4 text-center">
                          <div className="text-2xl font-black font-mono text-[var(--c-primary)]">{h2hStats.wins}</div>
                          <div className="text-sm font-mono text-[var(--c-muted)] mt-1">WINS</div>
                        </div>
                        <div className="px-3 py-4 text-center">
                          <div className="text-2xl font-black font-mono text-[#ff3333]">{h2hStats.losses}</div>
                          <div className="text-sm font-mono text-[var(--c-muted)] mt-1">LOSSES</div>
                        </div>
                        <div className="px-3 py-4 text-center">
                          <div className="text-2xl font-black font-mono text-[#ff0080]">{winrate}%</div>
                          <div className="text-sm font-mono text-[var(--c-muted)] mt-1">WINRATE</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Streaks & Peak */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="term-border bg-[var(--c-bg)] border-[rgba(255,0,128,0.3)]">
                    <div className="border-b border-[rgba(255,0,128,0.3)] px-3 py-1.5">
                      <span className="text-[#ff0080] text-sm tracking-widest">STREAKS</span>
                    </div>
                    <div className="divide-y divide-[rgba(255,0,128,0.08)]">
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">CURRENT</span>
                        <span className="text-sm font-mono font-bold text-[#ff0080]">{h2hStats.winStreak}</span>
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">BEST</span>
                        <span className="text-sm font-mono font-bold text-[#ff0080]">{h2hStats.bestWinStreak}</span>
                      </div>
                    </div>
                  </div>

                  <div className="term-border bg-[var(--c-bg)] border-[rgba(255,0,128,0.3)]">
                    <div className="border-b border-[rgba(255,0,128,0.3)] px-3 py-1.5">
                      <span className="text-[#ff0080] text-sm tracking-widest">MILESTONES</span>
                    </div>
                    <div className="divide-y divide-[rgba(255,0,128,0.08)]">
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">HIGHEST POINTS</span>
                        <span className="text-sm font-mono font-bold" style={{ color: getRankFromPoints(h2hStats.peakRankPoints).color }}>{h2hStats.peakRankPoints} pts</span>
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">HIGHEST RANK</span>
                        <span className="text-sm font-mono font-bold" style={{ color: getRankFromPoints(h2hStats.peakRankPoints).color }}>{getRankFromPoints(h2hStats.peakRankPoints).icon} {getRankFromPoints(h2hStats.peakRankPoints).label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matches today */}
                <div className="term-border bg-[var(--c-bg)] border-[rgba(255,0,128,0.3)]">
                  <div className="px-3 py-3 flex items-center justify-between">
                    <span className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">RATED_TODAY</span>
                    <span className="text-sm font-mono font-bold text-[#ff0080]">{h2hStats.ratedMatchesToday} / {H2H_DAILY_RATED_CAP}</span>
                  </div>
                  <div className="px-3 pb-3">
                    <div className="w-full h-1.5 bg-[#0a140a]">
                      <div className="h-full transition-all duration-500 bg-[#ff0080]" style={{ width: `${Math.min(100, (h2hStats.ratedMatchesToday / H2H_DAILY_RATED_CAP) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════════ FRIENDS TAB ═══════════════ */}
        {profileTab === 'friends' && (
          <>
            {/* Add friend */}
            <div className="term-border bg-[var(--c-bg)]">
              <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                <span className="text-[var(--c-secondary)] text-sm tracking-widest">ADD_FRIEND</span>
              </div>
              <div className="px-3 py-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addFriendCallsign}
                    onChange={e => setAddFriendCallsign(e.target.value.slice(0, 20))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddFriend(); }}
                    placeholder="ENTER CALLSIGN"
                    className="flex-1 bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-2 py-1.5 text-[var(--c-primary)] font-mono text-sm focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_70%,transparent)] placeholder:text-[var(--c-dark)]"
                  />
                  <button
                    onClick={handleAddFriend}
                    disabled={addFriendStatus === 'sending' || !addFriendCallsign.trim()}
                    className="px-4 py-1.5 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] disabled:opacity-40 transition-colors active:scale-95 transition-all"
                  >
                    {addFriendStatus === 'sending' ? '...' : 'ADD'}
                  </button>
                </div>
                {addFriendMsg && (
                  <div className={`text-sm font-mono ${addFriendStatus === 'sent' ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}`}>
                    {addFriendMsg}
                  </div>
                )}
              </div>
            </div>

            {friendsLoading && (
              <div className="term-border bg-[var(--c-bg)] px-4 py-6 text-center">
                <span className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">LOADING...</span>
              </div>
            )}

            {friendsData && (
              <>
                {/* Incoming requests */}
                {friendsData.incoming.length > 0 && (
                  <div className="term-border bg-[var(--c-bg)]">
                    <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                      <span className="text-[var(--c-secondary)] text-sm tracking-widest">INCOMING_REQUESTS ({friendsData.incoming.length})</span>
                    </div>
                    <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                      {friendsData.incoming.map(req => (
                        <div key={req.requestId} className="px-3 py-2 flex items-center justify-between">
                          <span className="text-[var(--c-primary)] text-sm font-mono font-bold">{req.from.displayName}</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleFriendAction(req.requestId, 'accept')}
                              className="px-3 py-1 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono text-xs tracking-wider hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] active:scale-95 transition-all"
                            >
                              ACCEPT
                            </button>
                            <button
                              onClick={() => handleFriendAction(req.requestId, 'reject')}
                              className="px-3 py-1 border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] text-[var(--c-muted)] font-mono text-xs tracking-wider hover:text-[#ff3333] hover:border-[#ff333350] active:scale-95 transition-all"
                            >
                              REJECT
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Friends list */}
                <div className="term-border bg-[var(--c-bg)]">
                  <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                    <span className="text-[var(--c-secondary)] text-sm tracking-widest">FRIENDS ({friendsData.friends.length})</span>
                  </div>
                  {friendsData.friends.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <div className="text-[var(--c-muted)] text-sm font-mono">No friends yet. Add one by callsign above.</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                      {friendsData.friends.map(f => {
                        const rank = getRankFromPoints(f.rankPoints);
                        return (
                          <div key={f.playerId} className="px-3 py-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[var(--c-primary)] text-sm font-mono font-bold truncate">{f.displayName}</span>
                              <span className="text-[var(--c-muted)] text-xs font-mono shrink-0">LVL {f.level}</span>
                              <span className="text-xs font-mono font-bold shrink-0" style={{ color: rank.color }}>{rank.icon} {f.rankLabel}</span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <Link
                                href={`/player/${encodeURIComponent(f.displayName)}`}
                                className="px-2 py-1 border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] text-[var(--c-secondary)] font-mono text-xs tracking-wider hover:text-[var(--c-primary)] hover:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] active:scale-95 transition-all"
                              >
                                VIEW
                              </Link>
                              <button
                                onClick={() => handleRemoveFriend(f.playerId)}
                                className="px-2 py-1 border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] text-[var(--c-muted)] font-mono text-xs tracking-wider hover:text-[#ff3333] hover:border-[#ff333350] active:scale-95 transition-all"
                              >
                                REMOVE
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Outgoing requests */}
                {friendsData.outgoing.length > 0 && (
                  <div className="term-border bg-[var(--c-bg)]">
                    <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
                      <span className="text-[var(--c-secondary)] text-sm tracking-widest">OUTGOING_REQUESTS ({friendsData.outgoing.length})</span>
                    </div>
                    <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                      {friendsData.outgoing.map(req => (
                        <div key={req.requestId} className="px-3 py-2 flex items-center justify-between">
                          <span className="text-[var(--c-secondary)] text-sm font-mono">{req.to.displayName}</span>
                          <button
                            onClick={() => handleRemoveFriend(req.to.playerId)}
                            className="px-3 py-1 border border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] text-[var(--c-muted)] font-mono text-xs tracking-wider hover:text-[#ff3333] hover:border-[#ff333350] active:scale-95 transition-all"
                          >
                            CANCEL
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Privacy note */}
                <div className="text-center">
                  <span className="text-[var(--c-muted)] text-xs font-mono opacity-60">Research mode data is anonymous and never shared with friends.</span>
                </div>
              </>
            )}
          </>
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
