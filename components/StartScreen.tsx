'use client';

import { useEffect, useState, useCallback } from 'react';
import type { GameMode, PlayerBackground } from '@/lib/types';
import { getRankFromLevel } from '@/lib/rank';
import Link from 'next/link';
import { usePlayer } from '@/lib/usePlayer';
import { AuthFlow } from './AuthFlow';
import { LevelMeter } from './LevelMeter';
import { playBootTick } from '@/lib/sounds';

interface LeaderboardEntry {
  name: string;
  score: number;
  level?: number;
}

interface Props {
  onStart: (mode: GameMode) => void;
}

const BACKGROUND_OPTIONS: { value: PlayerBackground; label: string }[] = [
  { value: 'other',            label: 'OTHER' },
  { value: 'technical',        label: 'TECHNICAL / NON-SECURITY' },
  { value: 'infosec',          label: 'INFOSEC / CYBERSECURITY' },
  { value: 'prefer_not_to_say', label: 'PREFER NOT TO SAY' },
];

// bright=true → phosphor green + glow (separators, READY line)
const BOOT_LINES: { text: string; bright: boolean }[] = [
  { text: '> RETRO_PHISH THREAT ANALYZER',  bright: false },
  { text: '> RESEARCH PLATFORM v1.0',       bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> LOADING RESEARCH DATASET.....', bright: false },
  { text: '> DATASET: v1.0',                bright: false },
  { text: '> CONFIDENCE SCORING: ENABLED',  bright: false },
  { text: '> STREAK DETECTION: ONLINE',     bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> SYSTEM READY.',                bright: true  },
];

export function StartScreen({ onStart }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { profile, loading: playerLoading, signedIn, signInWithEmail, signOut, refreshProfile, applyProfile } = usePlayer();
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [callsignLoading, setCallsignLoading] = useState(false);
  const [callsignError, setCallsignError] = useState('');
  const [background, setBackground] = useState<PlayerBackground | null>(null);
  const [xpLeaderboard, setXpLeaderboard] = useState<{ display_name: string | null; xp: number; level: number; research_graduated: boolean }[]>([]);
  const [activeTab, setActiveTab] = useState<'score' | 'daily' | 'xp'>('score');
  const [showGuide, setShowGuide] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    const d = new Date();
    const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    try {
      const [globalRes, dailyRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch(`/api/leaderboard?date=${today}`),
      ]);
      if (globalRes.ok) setLeaderboard(await globalRes.json());
      if (dailyRes.ok) setDailyLeaderboard(await dailyRes.json());
      fetch('/api/leaderboard/xp').then(r => r.ok ? r.json() : []).then(setXpLeaderboard).catch(() => {});
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < BOOT_LINES.length) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 220);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (visibleCount === BOOT_LINES.length) {
      const t = setTimeout(() => setShowButton(true), 300);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  function handleStart(mode: GameMode) {
    playBootTick();
    onStart(mode);
  }

  async function handleSetCallsign(e: React.FormEvent) {
    e.preventDefault();
    const name = callsign.trim();
    if (!name) return;
    setCallsignLoading(true);
    setCallsignError('');
    try {
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, background }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallsignError(data.error ?? 'Failed to set callsign.');
      } else {
        applyProfile(data);
        setCallsign('');
      }
    } catch {
      setCallsignError('Network error.');
    } finally {
      setCallsignLoading(false);
    }
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase();

  return (
    <div className="w-full max-w-sm px-4 flex flex-col gap-6">
      {/* Terminal window */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_TERMINAL</span>
          <span className="text-[#00aa28] text-xs">■ □ □</span>
        </div>
        <div className="px-3 py-4 min-h-48 space-y-1">
          {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
            <div
              key={i}
              className={`anim-fade-in text-xs font-mono leading-relaxed ${
                line.bright ? 'text-[#00ff41] glow' : 'text-[#00aa28]'
              }`}
            >
              {line.text}
            </div>
          ))}
          {!showButton && visibleCount < BOOT_LINES.length && (
            <span className="cursor" />
          )}
        </div>
      </div>

      {showButton && (
        <div className="anim-fade-in-up space-y-4">
          {/* Player Profile Card */}
          {!playerLoading && (
            <div className="anim-fade-in-up">
              {signedIn && profile && !profile.displayName ? (
                <div className="term-border bg-[#060c06]">
                  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[#00aa28] text-xs tracking-widest">SET_CALLSIGN</span>
                    <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28]">SIGN OUT</button>
                  </div>
                  <div className="px-3 py-3 space-y-2">
                    <div className="text-[#003a0e] text-[10px] font-mono">Choose a callsign. Shown on the XP leaderboard. 1–20 characters.</div>
                    <form onSubmit={handleSetCallsign} className="flex gap-2">
                      <input
                        type="text"
                        value={callsign}
                        onChange={(e) => { setCallsign(e.target.value); setCallsignError(''); }}
                        placeholder="ENTER CALLSIGN"
                        maxLength={20}
                        autoFocus
                        className="flex-1 bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-xs px-2 py-1.5 placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
                      />
                      <button
                        type="submit"
                        disabled={!callsign.trim() || callsignLoading}
                        className="px-3 py-1.5 term-border text-[#00ff41] font-mono text-xs tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {callsignLoading ? '...' : 'SET'}
                      </button>
                    </form>
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[#003a0e] text-[10px] font-mono tracking-wider">BACKGROUND</div>
                      <div className="text-[#003a0e] text-[9px] font-mono leading-relaxed">Helps us understand how expertise affects detection accuracy. Not stored with any personal information.</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BACKGROUND_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBackground(background === opt.value ? null : opt.value)}
                            className={`py-1.5 font-mono text-[9px] tracking-wider transition-all border ${
                              background === opt.value
                                ? 'text-[#00ff41] border-[rgba(0,255,65,0.8)] bg-[rgba(0,255,65,0.08)]'
                                : 'text-[#003a0e] border-[rgba(0,255,65,0.15)] hover:text-[#00aa28] hover:border-[rgba(0,255,65,0.4)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {callsignError && <div className="text-[#ff3333] text-[10px] font-mono">{callsignError}</div>}
                  </div>
                </div>
              ) : signedIn && profile ? (
                <div className="term-border bg-[#060c06]">
                  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
                    <Link href="/profile" className="text-[#00aa28] text-xs tracking-widest hover:text-[#00ff41]">{profile.displayName}</Link>
                    <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28]">SIGN OUT</button>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <LevelMeter xp={profile.xp} level={profile.level} />
                    {profile.researchGraduated && (
                      <div className="text-[#ffaa00] text-[10px] font-mono">⬡ RESEARCH GRADUATED — EXPERT MODE UNLOCKED</div>
                    )}
                  </div>
                </div>
              ) : showAuthFlow ? (
                <AuthFlow onSignIn={signInWithEmail} onCancel={() => setShowAuthFlow(false)} />
              ) : (
                <button
                  onClick={() => setShowAuthFlow(true)}
                  className="w-full px-3 py-2.5 term-border bg-[#060c06] text-left text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28] hover:bg-[rgba(0,255,65,0.03)]"
                >
                  [ SIGN IN ] — new or returning · magic link · no password
                </button>
              )}
            </div>
          )}

          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#00aa28] text-xs tracking-widest">HOW_TO_PLAY</span>
            </div>
            <div className="px-3 py-3 space-y-2.5">
              {[
                ['[1]', 'Read the email or SMS carefully'],
                ['[2]', 'Set your confidence: GUESSING / LIKELY / CERTAIN'],
                ['[3]', 'Classify: PHISHING or LEGIT'],
                ['[4]', 'More confidence + correct = more points'],
                ['[5]', '3-streak bonus: +50 pts per milestone'],
                ['[6]', 'Tap [HEADERS] on emails to inspect SPF/DKIM/DMARC and Reply-To'],
                ['[7]', 'Tap highlighted URLs to inspect the real destination'],
              ].map(([tag, desc]) => (
                <div key={tag} className="flex gap-3 text-xs">
                  <span className="text-[#00ff41] shrink-0 glow">{tag}</span>
                  <span className="text-[#00aa28]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 text-xs font-mono">
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
              <div
                key={d}
                className={`flex-1 text-center py-1.5 term-border ${
                  d === 'EASY'
                    ? 'text-[#00ff41] border-[rgba(0,255,65,0.4)]'
                    : d === 'MEDIUM'
                    ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]'
                    : 'text-[#ff3333] border-[rgba(255,51,51,0.4)]'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Daily challenge button - featured */}
          <button
            onClick={() => handleStart('daily')}
            className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
          >
            [ DAILY CHALLENGE — {dateLabel} ]
          </button>

          <button
            onClick={() => handleStart('research')}
            className="w-full py-3 term-border text-[#00aa28] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
          >
            [ PLAY ]
          </button>

          {signedIn && profile?.researchGraduated && (
            <button
              onClick={() => handleStart('expert')}
              className="w-full py-4 term-border border-[rgba(255,170,0,0.4)] text-center text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.05)]"
            >
              [ EXPERT MODE ]
            </button>
          )}

          <p className="text-[#003a0e] text-xs text-center font-mono">
            10 questions per round · email + SMS · randomized
          </p>

          {/* Signal guide */}
          <div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.2)]">
            <button
              onClick={() => setShowGuide((o) => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono hover:bg-[rgba(0,255,65,0.03)] transition-colors"
            >
              <span className="text-[#003a0e] tracking-widest">[?] SIGNAL GUIDE</span>
              <span className="text-[#003a0e]">{showGuide ? '▲' : '▼'}</span>
            </button>
            {showGuide && (
              <div className="border-t border-[rgba(0,255,65,0.15)] px-3 py-3 space-y-3">
                {[
                  {
                    label: 'FROM ADDRESS',
                    body: 'The sender name shown is a display name — it can be set to anything and proves nothing. Tap [↗] next to it to reveal the actual email address. Check that the domain matches the organisation claimed in the email. Look for typosquatting (paypa1.com), wrong TLDs (.net instead of .com), and lookalike subdomains.',
                  },
                  {
                    label: 'AUTH HEADERS',
                    body: 'Click [HEADERS] on any email. FAIL = sender could not authenticate. NONE = no headers configured. PASS = authenticated — but attackers register lookalike domains that also pass. PASS is not proof of legitimacy.',
                  },
                  {
                    label: 'URL INSPECTOR',
                    body: 'Click any underlined link to reveal the full URL before acting on it. Check: does the domain match the sender? Watch for typosquatting (paypa1.com), wrong TLDs (.net instead of .com), and subdomain tricks.',
                  },
                  {
                    label: 'REPLY-TO',
                    body: 'Visible in [HEADERS]. If Reply-To differs from the sender domain — especially a free provider like Gmail or Outlook — your reply goes to the attacker, not the organisation.',
                  },
                  {
                    label: 'SENT TIME',
                    body: 'Check the SENT row. Phishing often arrives at odd hours (2am, unusual timezones) to avoid scrutiny. Legitimate business emails typically arrive in business hours.',
                  },
                  {
                    label: 'CONFIDENCE',
                    body: 'GUESSING = 1x points (no penalty if wrong). LIKELY = 2x (−100 if wrong). CERTAIN = 3x (−200 if wrong). Only commit when the evidence is clear.',
                  },
                ].map(({ label, body }) => (
                  <div key={label} className="space-y-0.5">
                    <div className="text-[#ffaa00] text-[10px] font-mono tracking-widest">{label}</div>
                    <p className="text-[#00aa28] text-[10px] font-mono leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabbed leaderboard — score or XP */}
          {(leaderboard.length > 0 || dailyLeaderboard.length > 0 || xpLeaderboard.length > 0) && (
            <div className="term-border bg-[#060c06]">
              <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('score')}
                  className={`text-xs font-mono tracking-widest ${activeTab === 'score' ? 'text-[#00ff41] glow' : 'text-[#003a0e] hover:text-[#00aa28]'}`}
                >
                  SCORE
                </button>
                <span className="text-[#003a0e] text-xs">|</span>
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`text-xs font-mono tracking-widest ${activeTab === 'daily' ? 'text-[#00ff41] glow' : 'text-[#003a0e] hover:text-[#00aa28]'}`}
                >
                  DAILY
                </button>
                <span className="text-[#003a0e] text-xs">|</span>
                <button
                  onClick={() => setActiveTab('xp')}
                  className={`text-xs font-mono tracking-widest ${activeTab === 'xp' ? 'text-[#00ff41] glow' : 'text-[#003a0e] hover:text-[#00aa28]'}`}
                >
                  XP
                </button>
              </div>
              {activeTab === 'score' && leaderboard.length > 0 && (
                <div key={`score-${leaderboard.length}`} className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {leaderboard.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 anim-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>{i + 1}</span>
                      <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">{entry.name}</span>
                      {(() => { const r = getRankFromLevel(entry.level ?? 1); return (
                        <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>{r.label}</span>
                      ); })()}
                      <span className="text-[#00ff41] text-xs font-mono font-bold glow">{entry.score}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'xp' && xpLeaderboard.length > 0 && (
                <div key={`xp-${xpLeaderboard.length}`} className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {xpLeaderboard.map((row, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono anim-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="text-[#003a0e] w-4">{i + 1}.</span>
                      <span className="text-[#00aa28] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
                      {row.research_graduated && <span className="text-[#ffaa00] text-[10px]">★</span>}
                      {(() => { const r = getRankFromLevel(row.level); return (
                        <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>
                          {r.label}
                        </span>
                      ); })()}
                      <span className="text-[#00ff41]">{row.xp.toLocaleString()} XP</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'daily' && dailyLeaderboard.length > 0 && (
                <div key={`daily-${dailyLeaderboard.length}`} className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {dailyLeaderboard.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 anim-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>{i + 1}</span>
                      <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">{entry.name}</span>
                      {(() => { const r = getRankFromLevel(entry.level ?? 1); return (
                        <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>{r.label}</span>
                      ); })()}
                      <span className="text-[#00ff41] text-xs font-mono font-bold glow">{entry.score}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'score' && leaderboard.length === 0 && (
                <div className="px-3 py-4 text-center text-[#003a0e] text-[10px] font-mono">No scores yet.</div>
              )}
              {activeTab === 'daily' && dailyLeaderboard.length === 0 && (
                <div className="px-3 py-4 text-center text-[#003a0e] text-[10px] font-mono">No scores today yet.</div>
              )}
              {activeTab === 'xp' && xpLeaderboard.length === 0 && (
                <div className="px-3 py-4 text-center text-[#003a0e] text-[10px] font-mono">No players yet.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
