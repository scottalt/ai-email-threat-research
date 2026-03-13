'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const BACKGROUND_OPTIONS: { value: PlayerBackground; label: string }[] = [
  { value: 'other',            label: 'OTHER' },
  { value: 'technical',        label: 'TECHNICAL / NON-SECURITY' },
  { value: 'infosec',          label: 'INFOSEC / CYBERSECURITY' },
  { value: 'prefer_not_to_say', label: 'PREFER NOT TO SAY' },
];

// bright=true → phosphor green + glow (separators, READY line)
const BOOT_LINES: { text: string; bright: boolean }[] = [
  { text: '> THREAT_TERMINAL ANALYZER',  bright: false },
  { text: '> RESEARCH PLATFORM v1.0',       bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> LOADING RESEARCH DATASET.....', bright: false },
  { text: '> DATASET: v1.0',                bright: false },
  { text: '> CONFIDENCE SCORING: ENABLED',  bright: false },
  { text: '> STREAK DETECTION: ONLINE',     bright: false },
  { text: '> \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', bright: true  },
  { text: '> SYSTEM READY.',                bright: true  },
];

export function StartScreen({ onStart, soundEnabled, onToggleSound: toggleSound }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [bootHidden, setBootHidden] = useState(false);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { profile, loading: playerLoading, signedIn, signInWithEmail, verifyOtp, signOut, refreshProfile, applyProfile } = usePlayer();
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [callsignLoading, setCallsignLoading] = useState(false);
  const [callsignError, setCallsignError] = useState('');
  const [background, setBackground] = useState<PlayerBackground | null>(null);
  const [xpLeaderboard, setXpLeaderboard] = useState<{ display_name: string | null; xp: number; level: number; research_graduated: boolean }[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'xp'>('xp');
  const [showGuide, setShowGuide] = useState(false);
  const [lbExpanded, setLbExpanded] = useState(false);
  const [lbExpandLoading, setLbExpandLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    const d = new Date();
    const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    try {
      const [dailyRes, xpRes] = await Promise.all([
        fetch(`/api/leaderboard?date=${today}`),
        fetch('/api/leaderboard/xp'),
      ]);
      if (dailyRes.ok) setDailyLeaderboard(await dailyRes.json());
      if (xpRes.ok) setXpLeaderboard(await xpRes.json());
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
      const t = setTimeout(() => setBootDone(true), 300);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  // After boot fades out, show main content
  useEffect(() => {
    if (bootDone && !bootHidden) {
      const fallback = setTimeout(() => {
        setBootHidden(true);
        setShowButton(true);
      }, 400); // slightly longer than the 300ms transition
      return () => clearTimeout(fallback);
    }
  }, [bootDone, bootHidden]);

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

  async function handleExpandLeaderboard() {
    if (lbExpanded || lbExpandLoading) return;
    setLbExpandLoading(true);
    try {
      const d = new Date();
      const today = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const [dailyRes, xpRes] = await Promise.all([
        fetch(`/api/leaderboard?date=${today}&expand=1`),
        fetch('/api/leaderboard/xp?expand=1'),
      ]);
      if (dailyRes.ok) setDailyLeaderboard(await dailyRes.json());
      if (xpRes.ok) setXpLeaderboard(await xpRes.json());
      setLbExpanded(true);
    } catch {
      // silently fail
    } finally {
      setLbExpandLoading(false);
    }
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase();

  return (
    <div className={`w-full px-4 pb-safe flex flex-col gap-6 lg:gap-8 ${showButton ? 'max-w-sm lg:max-w-4xl' : 'max-w-md'}`}>
      {/* Terminal boot animation — fades out after loading */}
      {!bootHidden && (
        <div
          className={`term-border bg-[#060c06] transition-opacity duration-300 ${bootDone ? 'opacity-0' : 'opacity-100'}`}
          onTransitionEnd={() => { if (bootDone) { setBootHidden(true); setShowButton(true); } }}
        >
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#33bb55] text-sm tracking-widest">ANALYST_TERMINAL</span>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                className={`text-sm font-mono transition-colors p-2 -m-2 ${soundEnabled ? 'text-[#00ff41]' : 'text-[#1a5c2a]'}`}
              >
                {soundEnabled ? '[SFX]' : '[SFX OFF]'}
              </button>
              <span className="text-[#33bb55] text-sm">■ □ □</span>
            </div>
          </div>
          <div className="px-3 py-4 min-h-48 space-y-1 overflow-hidden">
            {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
              <div
                key={i}
                className={`anim-fade-in text-sm font-mono leading-relaxed ${
                  line.bright ? 'text-[#00ff41]' : 'text-[#33bb55]'
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
      )}

      {showButton && (
        <div className="anim-fade-in-up space-y-4 lg:space-y-6">
          {/* Player Profile Card */}
          {!playerLoading && (
            <div className="anim-fade-in-up">
              {signedIn && profile && !profile.displayName ? (
                <div className="term-border bg-[#060c06]">
                  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[#33bb55] text-sm tracking-widest">SET_CALLSIGN</span>
                    <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">SIGN OUT</button>
                  </div>
                  <div className="px-3 py-3 space-y-2">
                    <div className="text-[#1a5c2a] text-sm font-mono">Choose a callsign. Shown on the XP leaderboard. 1–20 characters.</div>
                    <form onSubmit={handleSetCallsign} className="flex gap-2">
                      <input
                        type="text"
                        value={callsign}
                        onChange={(e) => { setCallsign(e.target.value); setCallsignError(''); }}
                        placeholder="ENTER CALLSIGN"
                        maxLength={20}
                        autoFocus
                        className="flex-1 bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-sm px-2 py-1.5 placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
                      />
                      <button
                        type="submit"
                        disabled={!callsign.trim() || !background || callsignLoading}
                        className="px-3 py-1.5 term-border text-[#00ff41] font-mono text-sm tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {callsignLoading ? '...' : 'SET'}
                      </button>
                    </form>
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[#33bb55] text-sm font-mono tracking-wider">BACKGROUND <span className="text-[#ffaa00]">*REQUIRED</span></div>
                      <div className="text-[#33bb55] text-sm font-mono leading-relaxed opacity-70">Required for research. Helps us understand how expertise affects detection accuracy. Not stored with any personal information.</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BACKGROUND_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBackground(background === opt.value ? null : opt.value)}
                            className={`py-1.5 font-mono text-sm tracking-wider transition-all border ${
                              background === opt.value
                                ? 'text-[#00ff41] border-[rgba(0,255,65,0.8)] bg-[rgba(0,255,65,0.08)]'
                                : 'text-[#33bb55] border-[rgba(0,255,65,0.35)] hover:text-[#00ff41] hover:border-[rgba(0,255,65,0.5)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {callsignError && <div className="text-[#ff3333] text-sm font-mono">{callsignError}</div>}
                  </div>
                </div>
              ) : signedIn && profile ? (
                <div className="term-border bg-[#060c06]">
                  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link href="/profile" className="text-[#00ff41] text-sm tracking-widest font-bold hover:text-[#00ff41] border border-[rgba(0,255,65,0.3)] px-2 py-0.5 hover:bg-[rgba(0,255,65,0.06)] transition-colors">[ {profile.displayName} ]</Link>
                      {profile.researchGraduated && (
                        <span className="text-[#ffaa00] text-sm font-mono hidden lg:inline">⬡ GRADUATED</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(profile.achievements?.length ?? 0) > 0 && (
                        <Link href="/profile#achievements" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41] hidden lg:inline">
                          ★ {profile.achievements?.length ?? 0}/20
                        </Link>
                      )}
                      <button onClick={async () => { await signOut(); setShowAuthFlow(false); }} className="text-[#1a5c2a] text-sm font-mono hover:text-[#33bb55]">SIGN OUT</button>
                    </div>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <LevelMeter xp={profile.xp} level={profile.level} />
                    {/* Mobile-only: show graduation + achievements below XP bar */}
                    <div className="flex items-center justify-between lg:hidden">
                      {profile.researchGraduated && (
                        <div className="text-[#ffaa00] text-sm font-mono">⬡ RESEARCH GRADUATED</div>
                      )}
                      {(profile.achievements?.length ?? 0) > 0 && (
                        <Link href="/profile#achievements" className="text-[#33bb55] text-sm font-mono hover:text-[#00ff41]">
                          ★ {profile.achievements?.length ?? 0}/20
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : showAuthFlow ? (
                <AuthFlow onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => setShowAuthFlow(false)} />
              ) : (
                <button
                  onClick={() => setShowAuthFlow(true)}
                  className="w-full px-3 py-3 term-border bg-[#060c06] border-[rgba(255,170,0,0.5)] text-left font-mono hover:bg-[rgba(255,170,0,0.06)] transition-colors"
                >
                  <div className="text-[#ffaa00] text-sm tracking-widest font-bold">[ SIGN IN TO SAVE YOUR SCORE ]</div>
                  <div className="text-[#cc8800] text-sm mt-1">Magic link · no password · track XP + rank</div>
                </button>
              )}
            </div>
          )}

          {/* Two-column layout wrapper: sidebar + main on desktop */}
          <div className="flex flex-col lg:flex-row lg:gap-0">
            {/* Sidebar: reference content */}
            <div className="contents lg:block lg:w-80 lg:shrink-0 lg:border-r lg:border-[rgba(0,255,65,0.15)] lg:pr-6 lg:space-y-4">
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#33bb55] text-sm lg:text-base tracking-widest">HOW_TO_PLAY</span>
                </div>
                <div className="px-3 py-3 space-y-2.5">
                  {[
                    ['[1]', 'Read the email carefully'],
                    ['[2]', 'Set your confidence: GUESSING / LIKELY / CERTAIN'],
                    ['[3]', 'Classify: PHISHING or LEGIT'],
                    ['[4]', 'Correct + confident = more points. Wrong + confident = point penalty. GUESSING never penalises.'],
                    ['[5]', 'GUESSING 1×, LIKELY 2× (−100 if wrong), CERTAIN 3× (−200 if wrong)'],
                    ['[6]', '3-streak bonus: +50 pts per milestone'],
                    ['[7]', 'Tap [HEADERS] on emails to inspect SPF/DKIM/DMARC and Reply-To'],
                    ['[8]', 'Tap highlighted URLs to inspect the real destination'],
                  ].map(([tag, desc]) => (
                    <div key={tag} className="flex gap-3 text-sm lg:text-base">
                      <span className="text-[#00ff41] shrink-0">{tag}</span>
                      <span className="text-[#33bb55] lg:leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signal guide */}
              <div className="term-border bg-[#060c06] border-[rgba(255,170,0,0.3)]">
            <button
              onClick={() => setShowGuide((o) => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[rgba(255,170,0,0.05)] transition-colors"
            >
              <span className="text-[#ffaa00] tracking-widest">[?] SIGNAL GUIDE</span>
              <span className="text-[#ffaa00]">{showGuide ? '▲' : '▼'}</span>
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
                    <div className="text-[#ffaa00] text-sm font-mono tracking-widest">{label}</div>
                    <p className="text-[#33bb55] text-sm lg:text-base font-mono leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
            </div>
            {/* Main column: actions + leaderboard */}
            <div className="contents lg:block lg:flex-1 lg:pl-6 lg:space-y-4">

          {(() => {
            const graduated = signedIn && (profile?.researchGraduated ?? false);
            const researchCapped = signedIn && !graduated && (profile?.researchAnswersSubmitted ?? 0) >= 30;
            const isResearch = signedIn && !graduated && !researchCapped;
            return (
              <>
                <button
                  onClick={() => {
                    if (!signedIn) { setShowAuthFlow(true); return; }
                    if (researchCapped) { handleStart('freeplay'); return; }
                    handleStart(graduated ? 'freeplay' : 'research');
                  }}
                  className={`w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all ${
                    isResearch
                      ? 'border-[rgba(255,170,0,0.5)] text-[#ffaa00] hover:bg-[rgba(255,170,0,0.06)]'
                      : 'text-[#33bb55] hover:bg-[rgba(0,255,65,0.05)]'
                  }`}
                >
                  {isResearch ? '[ RESEARCH MODE ]' : '[ PLAY ]'}
                </button>
                {!signedIn && (
                  <p className="text-[#1a5c2a] text-sm text-center font-mono">sign in to contribute to the research study</p>
                )}
                {researchCapped && (
                  <p className="text-[#ffaa00] text-sm text-center font-mono">
                    RESEARCH COMPLETE — 30/30 answers submitted. Thank you!
                  </p>
                )}
                {isResearch && profile && (
                  <p className="text-[#cc8800] text-sm text-center font-mono">
                    {profile.researchAnswersSubmitted} of 30 answers submitted
                  </p>
                )}
              </>
            );
          })()}

          {/* Daily challenge button — locked until research graduation */}
          {signedIn && profile?.researchGraduated ? (
            <button
              onClick={() => handleStart('daily')}
              className="w-full py-4 lg:py-5 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all"
            >
              [ DAILY CHALLENGE — {dateLabel} ]
            </button>
          ) : (
            <div className="w-full py-4 term-border border-[rgba(0,255,65,0.15)] text-center font-mono text-sm tracking-widest text-[#1a5c2a] cursor-not-allowed select-none">
              [ DAILY CHALLENGE — LOCKED ]
              <div className="text-[#1a5c2a] text-xs mt-1 tracking-wide">Complete research to unlock</div>
            </div>
          )}

          {/* Post-graduation features: Expert + Stats + Intel */}
          {signedIn && profile?.researchGraduated ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={() => handleStart('expert')}
                className="col-span-2 lg:col-span-1 py-3 term-border border-[rgba(255,170,0,0.4)] text-center text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.05)] transition-all"
              >
                [ EXPERT ]
              </button>
              <Link
                href="/stats"
                className="block w-full py-3 term-border text-center text-[#33bb55] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                [ STATS ]
              </Link>
              <Link
                href="/intel/player"
                className="block w-full py-3 term-border text-center text-[#33bb55] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                [ INTEL ]
              </Link>
            </div>
          ) : (
            <Link
              href="/intel/player"
              className="block w-full py-3 term-border border-[rgba(0,255,65,0.15)] text-center font-mono text-sm tracking-widest text-[#1a5c2a] select-none hover:bg-[rgba(0,255,65,0.02)] transition-all"
            >
              [ STATS + INTEL — LOCKED ]
              <span className="block text-xs mt-1 tracking-wide">Complete research to unlock</span>
            </Link>
          )}

          <p className="text-[#1a5c2a] text-sm text-center font-mono">
            10 questions per round · email · randomized
          </p>

          {/* Tabbed leaderboard — XP always visible; Daily tab only for graduated players */}
          {(() => {
            const canSeeDailyLb = signedIn && profile?.researchGraduated;
            const showLeaderboard = xpLeaderboard.length > 0 || (canSeeDailyLb && dailyLeaderboard.length > 0);
            if (!showLeaderboard) return null;
            return (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('xp')}
                    className={`text-sm font-mono tracking-widest ${activeTab === 'xp' ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'}`}
                  >
                    XP
                  </button>
                  {canSeeDailyLb && (
                    <>
                      <span className="text-[#1a5c2a] text-sm">|</span>
                      <button
                        onClick={() => setActiveTab('daily')}
                        className={`text-sm font-mono tracking-widest ${activeTab === 'daily' ? 'text-[#00ff41]' : 'text-[#1a5c2a] hover:text-[#33bb55]'}`}
                      >
                        DAILY
                      </button>
                    </>
                  )}
                </div>
                {activeTab === 'xp' && xpLeaderboard.length > 0 && (
                  <div key={`xp-${xpLeaderboard.length}`} className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {xpLeaderboard.map((row, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 lg:py-2.5 text-sm lg:text-base font-mono anim-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                        <span className="text-[#1a5c2a] w-4">{i + 1}.</span>
                        <span className="text-[#33bb55] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
                        {row.research_graduated && <span className="text-[#ffaa00] text-sm">★</span>}
                        {(() => { const r = getRankFromLevel(row.level); return (
                          <span className={`text-sm font-mono shrink-0`} style={{ color: r.color }}>
                            {r.label}
                          </span>
                        ); })()}
                        <span className="text-[#00ff41]">{row.xp.toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                )}
                {canSeeDailyLb && activeTab === 'daily' && dailyLeaderboard.length > 0 && (
                  <div key={`daily-${dailyLeaderboard.length}`} className="divide-y divide-[rgba(0,255,65,0.08)]">
                    {dailyLeaderboard.map((entry, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 lg:py-2.5 anim-fade-in-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                        <span className={`text-sm font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#1a5c2a]'}`}>{i + 1}</span>
                        <span className="text-[#33bb55] text-sm font-mono flex-1 truncate">{entry.name}</span>
                        {(() => { const r = getRankFromLevel(entry.level ?? 1); return (
                          <span className={`text-sm font-mono shrink-0`} style={{ color: r.color }}>{r.label}</span>
                        ); })()}
                        <span className="text-[#00ff41] text-sm font-mono font-bold">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                {canSeeDailyLb && activeTab === 'daily' && dailyLeaderboard.length === 0 && (
                  <div className="px-3 py-4 text-center text-[#1a5c2a] text-sm font-mono">No scores today yet.</div>
                )}
                {activeTab === 'xp' && xpLeaderboard.length === 0 && (
                  <div className="px-3 py-4 text-center text-[#1a5c2a] text-sm font-mono">No players yet.</div>
                )}
                {!lbExpanded && (xpLeaderboard.length >= 10 || dailyLeaderboard.length >= 10) && (
                  <button
                    onClick={handleExpandLeaderboard}
                    disabled={lbExpandLoading}
                    className="w-full py-2 border-t border-[rgba(0,255,65,0.15)] text-[#1a5c2a] hover:text-[#33bb55] text-sm font-mono tracking-widest transition-colors disabled:opacity-50"
                  >
                    {lbExpandLoading ? '...' : '[ SHOW MORE ]'}
                  </button>
                )}
              </div>
            );
          })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
