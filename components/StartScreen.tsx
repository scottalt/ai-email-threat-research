'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { GameMode, PlayerBackground } from '@/lib/types';
import { getRankFromLevel } from '@/lib/rank';
import Link from 'next/link';
import { usePlayer } from '@/lib/usePlayer';
import { useNavVisibility } from '@/lib/NavVisibilityContext';
import { AuthFlow } from './AuthFlow';
import { LevelMeter } from './LevelMeter';
import { playBootTick } from '@/lib/sounds';
import { version } from '@/package.json';

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
  const bootSeen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bootSeen') === '1';
  const [visibleCount, setVisibleCount] = useState(bootSeen ? BOOT_LINES.length : 0);
  const [showButton, setShowButton] = useState(bootSeen);
  const [bootDone, setBootDone] = useState(bootSeen);
  const [bootHidden, setBootHidden] = useState(bootSeen);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { profile, loading: playerLoading, signedIn, signInWithEmail, verifyOtp, signOut, refreshProfile, applyProfile } = usePlayer();
  const { setNavHidden } = useNavVisibility();
  const [showInlineAuth, setShowInlineAuth] = useState(false);
  const inlineAuthRef = useRef<HTMLDivElement>(null);
  const [callsign, setCallsign] = useState('');
  const [callsignLoading, setCallsignLoading] = useState(false);
  const [callsignError, setCallsignError] = useState('');
  const [background, setBackground] = useState<PlayerBackground | null>(null);
  const [xpLeaderboard, setXpLeaderboard] = useState<{ display_name: string | null; xp: number; level: number; research_graduated: boolean }[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'xp'>('xp');
  // Collapse HOW_TO_PLAY for returning players who've completed at least 1 session
  const isExperiencedPlayer = !!profile && (profile.totalSessions ?? 0) >= 1;
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [howToPlayManuallyToggled, setHowToPlayManuallyToggled] = useState(false);
  // Auto-collapse when profile loads and player is experienced (unless they manually toggled)
  const effectiveShowHowToPlay = howToPlayManuallyToggled ? showHowToPlay : !isExperiencedPlayer;
  const [showGuide, setShowGuide] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [lbExpanded, setLbExpanded] = useState(false);
  const [lbExpandLoading, setLbExpandLoading] = useState(false);

  // "What's new" unread dot
  const [hasUnreadChangelog, setHasUnreadChangelog] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem('lastSeenVersion');
      setHasUnreadChangelog(seen !== version);
    } catch {}
  }, []);

  // XP cooldown state
  const [cooldownLabel, setCooldownLabel] = useState<string | null>(null);
  const [atCap, setAtCap] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState<string | null>(null);
  const [cooldownCapType, setCooldownCapType] = useState<'HOURLY' | 'DAILY'>('HOURLY');
  const [cooldownModalMode, setCooldownModalMode] = useState<GameMode | null>(null);

  useEffect(() => {
    function check() {
      try {
        const raw = localStorage.getItem('xp_cooldown');
        if (!raw) { setCooldownLabel(null); setAtCap(false); setCooldownTimer(null); return; }
        const cd = JSON.parse(raw) as { hourlyRemaining: number; dailyRemaining: number; hourlyResetsAt: string; dailyResetsAt: string };
        const now = Date.now();
        const hourlyReset = new Date(cd.hourlyResetsAt).getTime();
        const dailyReset = new Date(cd.dailyResetsAt).getTime();

        // If both resets are in the past, cooldown is stale
        if (hourlyReset <= now && dailyReset <= now) {
          localStorage.removeItem('xp_cooldown');
          setCooldownLabel(null); setAtCap(false); setCooldownTimer(null);
          refreshProfile();
          return;
        }

        // At cap — show countdown
        if (cd.hourlyRemaining === 0 || cd.dailyRemaining === 0) {
          const isDaily = cd.dailyRemaining === 0;
          const resetMs = isDaily ? dailyReset : hourlyReset;
          const diff = Math.max(0, resetMs - now);
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          if (diff <= 0) {
            localStorage.removeItem('xp_cooldown');
            setCooldownLabel(null); setAtCap(false); setCooldownTimer(null);
            refreshProfile(); // fetch fresh cooldown state from server
          } else {
            const timer = `${mins}m ${secs.toString().padStart(2, '0')}s`;
            setCooldownTimer(timer);
            setCooldownCapType(isDaily ? 'DAILY' : 'HOURLY');
            setCooldownLabel(`XP COOLDOWN · ${timer}`);
            setAtCap(true);
          }
          return;
        }

        setAtCap(false);
        setCooldownTimer(null);

        // Low remaining — show warning
        if (cd.hourlyRemaining <= 3) {
          setCooldownLabel(`${cd.hourlyRemaining} XP SESSION${cd.hourlyRemaining === 1 ? '' : 'S'} LEFT THIS HOUR`);
          return;
        }
        if (cd.dailyRemaining <= 5) {
          setCooldownLabel(`${cd.dailyRemaining} XP SESSIONS LEFT TODAY`);
          return;
        }

        setCooldownLabel(null);
      } catch {
        setCooldownLabel(null); setAtCap(false); setCooldownTimer(null);
      }
    }
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  /** Intercept game start — show cooldown modal if at cap for non-research modes */
  function tryStart(mode: GameMode) {
    if (atCap && mode !== 'research') {
      setCooldownModalMode(mode);
      return;
    }
    handleStart(mode);
  }

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
      const t = setTimeout(() => {
        setBootDone(true);
        try { sessionStorage.setItem('bootSeen', '1'); } catch {}
      }, 300);
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

  // Hide nav bar during boot and until player profile is fully set up
  useLayoutEffect(() => {
    const profileReady = signedIn && !!profile?.displayName;
    setNavHidden(!bootHidden || !profileReady);
    return () => setNavHidden(false);
  }, [bootHidden, signedIn, profile?.displayName, setNavHidden]);

  // Scroll inline onboarding block into view when it mounts
  useEffect(() => {
    if (inlineAuthRef.current) {
      inlineAuthRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showInlineAuth, signedIn]);

  function handleStart(mode: GameMode) {
    playBootTick();
    onStart(mode);
  }

  const callsignInputRef = useRef<HTMLInputElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  function triggerShake(el: HTMLElement) {
    el.classList.remove('anim-shake');
    // Force reflow so re-adding the class restarts the animation
    void el.offsetWidth;
    el.classList.add('anim-shake');
  }

  async function handleSetCallsign(e: React.FormEvent) {
    e.preventDefault();
    const name = callsign.trim();
    if (!name) {
      setCallsignError('Enter a callsign');
      if (callsignInputRef.current) triggerShake(callsignInputRef.current);
      return;
    }
    if (!background) {
      setCallsignError('Select a background');
      if (backgroundRef.current) triggerShake(backgroundRef.current);
      return;
    }
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

  async function handleCollapseLeaderboard() {
    setLbExpanded(false);
    // Re-fetch the default (top 10/20) lists
    fetchLeaderboard();
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase();

  return (
    <div className={`w-full px-4 pb-safe flex flex-col gap-6 lg:gap-8 ${showButton ? 'max-w-sm lg:max-w-4xl' : 'max-w-md'}`}>
      {/* Terminal boot animation — fades out after loading */}
      {!bootHidden && (
        <div
          className={`term-border bg-[var(--c-bg)] transition-opacity duration-300 ${bootDone ? 'opacity-0' : 'opacity-100'}`}
          onTransitionEnd={() => { if (bootDone) { setBootHidden(true); setShowButton(true); } }}
        >
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">ANALYST_TERMINAL</span>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                className={`lg:hidden text-sm font-mono transition-colors p-2 -m-2 ${soundEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}
              >
                {soundEnabled ? '[SFX]' : '[SFX OFF]'}
              </button>
              <span className="text-[var(--c-secondary)] text-sm">■ □ □</span>
            </div>
          </div>
          <div className="px-3 py-4 min-h-48 space-y-1 overflow-hidden">
            {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
              <div
                key={i}
                className={`anim-fade-in text-sm font-mono leading-relaxed ${
                  line.bright ? 'text-[var(--c-primary)]' : 'text-[var(--c-secondary)]'
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
          {/* SFX toggle — mobile only, visible when not signed in (signed-in users see it in profile header) */}
          {!signedIn && (
            <div className="flex justify-end lg:hidden">
              <button
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                className={`text-sm font-mono transition-colors ${soundEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}
              >
                {soundEnabled ? '[SFX]' : '[SFX OFF]'}
              </button>
            </div>
          )}
          {/* Player Profile Card — only shown for signed-in users with a display name */}
          {!playerLoading && signedIn && profile?.displayName && (
            <div className="anim-fade-in-up">
              <div className="term-border bg-[var(--c-bg)]">
                <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href="/profile" className="text-[var(--c-primary)] text-sm tracking-widest font-bold hover:text-[var(--c-primary)] border border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] px-2 py-0.5 hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] transition-colors">[ {profile.displayName} ]</Link>
                    {profile.researchGraduated && (
                      <span className="text-[var(--c-accent)] text-sm font-mono hidden lg:inline">⬡ RANKED UNLOCKED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {(profile.achievements?.length ?? 0) > 0 && (
                      <Link href="/profile#achievements" className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)] hidden lg:inline">
                        ★ BADGES {profile.achievements?.length ?? 0}/20
                      </Link>
                    )}
                    <button onClick={toggleSound} aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'} className={`lg:hidden text-sm font-mono transition-colors ${soundEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}>{soundEnabled ? '[SFX]' : '[SFX OFF]'}</button>
                    <button onClick={async () => { await signOut(); }} className="text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)]">SIGN OUT</button>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-2">
                  <LevelMeter xp={profile.xp} level={profile.level} />
                  {/* Mobile-only: show graduation + achievements below XP bar */}
                  <div className="flex items-center justify-between lg:hidden">
                    {profile.researchGraduated && (
                      <div className="text-[var(--c-accent)] text-sm font-mono">⬡ RANKED UNLOCKED</div>
                    )}
                    {(profile.achievements?.length ?? 0) > 0 && (
                      <Link href="/profile#achievements" className="text-[var(--c-secondary)] text-sm font-mono hover:text-[var(--c-primary)]">
                        ★ BADGES {profile.achievements?.length ?? 0}/20
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* XP cooldown indicator */}
          {signedIn && cooldownLabel && (
            <div
              className="border border-[rgba(255,170,0,0.5)] bg-[#0a0800] px-3 py-3"
              style={{ boxShadow: '0 0 12px rgba(255, 170, 0, 0.1), inset 0 0 12px rgba(255, 170, 0, 0.03)' }}
            >
              {atCap ? (
                <div className="flex items-center gap-3">
                  <span className="text-[#ffaa00] text-lg animate-pulse">&#128274;</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#ffaa00] text-sm font-mono font-bold tracking-widest">XP_LOCKED — {cooldownCapType} CAP REACHED</div>
                    <div className="text-[#ffaa00] text-lg font-mono font-black mt-0.5">RESETS IN {cooldownTimer}</div>
                  </div>
                  <span className="text-[#664400] text-xs font-mono shrink-0 hidden lg:block">RESEARCH<br />UNAFFECTED</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[#ffaa00] text-sm">&#9888;</span>
                  <span className="text-[#ffaa00] text-sm font-mono font-bold tracking-wider">{cooldownLabel}</span>
                </div>
              )}
              {atCap && <div className="text-[#664400] text-xs font-mono mt-1.5 lg:hidden">Research mode unaffected</div>}
            </div>
          )}

          {/* Two-column layout wrapper: sidebar + main on desktop */}
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-0">
            {/* Sidebar: reference content */}
            <div className="contents lg:block lg:w-80 lg:shrink-0 lg:border-r lg:border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] lg:pr-6 lg:space-y-4">
              <div className="term-border bg-[var(--c-bg)]">
                <button
                  onClick={() => { setHowToPlayManuallyToggled(true); setShowHowToPlay((o) => !o); }}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--c-primary)_4%,transparent)] transition-colors"
                >
                  <span className="text-[var(--c-secondary)] text-sm lg:text-base tracking-widest">HOW_TO_PLAY</span>
                  <span className="text-[var(--c-secondary)]">{effectiveShowHowToPlay ? '▲' : '▼'}</span>
                </button>
                {effectiveShowHowToPlay && (
                <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-3 space-y-2.5">
                  {[
                    ['[1]', 'Read each email carefully'],
                    ['[2]', 'Set your confidence: GUESSING / LIKELY / CERTAIN'],
                    ['[3]', 'Classify: PHISHING or LEGIT'],
                    ['[4]', 'Correct + confident = more points. Wrong + confident = point penalty. GUESSING never penalises.'],
                    ['[5]', 'GUESSING 1×, LIKELY 2× (−100 if wrong), CERTAIN 3× (−200 if wrong)'],
                    ['[6]', '3-streak bonus: +50 pts per milestone'],
                    ['[7]', 'Tap highlighted URLs to inspect the real destination'],
                  ].map(([tag, desc]) => (
                    <div key={tag} className="flex gap-3 text-sm lg:text-base">
                      <span className="text-[var(--c-primary)] shrink-0">{tag}</span>
                      <span className="text-[var(--c-secondary)] lg:leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
                )}
              </div>

              {/* Signal guide */}
              <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)]">
            <button
              onClick={() => setShowGuide((o) => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] transition-colors"
            >
              <span className="text-[var(--c-accent)] tracking-widest">[?] SIGNAL GUIDE</span>
              <span className="text-[var(--c-accent)]">{showGuide ? '▲' : '▼'}</span>
            </button>
            {showGuide && (
              <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-3 space-y-3">
                {[
                  {
                    label: 'FROM ADDRESS',
                    body: 'The sender name shown is a display name — it can be set to anything and proves nothing. Tap [↗] next to it to reveal the actual email address. Check that the domain matches the organisation claimed in the email. Look for typosquatting (paypa1.com), wrong TLDs (.net instead of .com), and lookalike subdomains.',
                  },
                  {
                    label: 'URL INSPECTOR',
                    body: 'Click any underlined link to reveal the full URL before acting on it. Check: does the domain match the sender? Watch for typosquatting (paypa1.com), wrong TLDs (.net instead of .com), and subdomain tricks.',
                  },
                  {
                    label: 'CONFIDENCE',
                    body: 'GUESSING = 1x points (no penalty if wrong). LIKELY = 2x (−100 if wrong). CERTAIN = 3x (−200 if wrong). Only commit when the evidence is clear.',
                  },
                ].map(({ label, body }) => (
                  <div key={label} className="space-y-0.5">
                    <div className="text-[var(--c-accent)] text-sm font-mono tracking-widest">{label}</div>
                    <p className="text-[var(--c-secondary)] text-sm lg:text-base font-mono leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

              {/* About this research */}
              <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)]">
                <button
                  onClick={() => setShowAbout((o) => !o)}
                  className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-colors"
                >
                  <span className="text-[var(--c-primary)] tracking-widest">[i] ABOUT_THIS_RESEARCH</span>
                  <span className="text-[var(--c-primary)]">{showAbout ? '▲' : '▼'}</span>
                </button>
                {showAbout && (
                  <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-3 space-y-3">
                    <p className="text-[var(--c-secondary)] text-sm lg:text-base font-mono leading-relaxed">
                      Threat Terminal is a research platform studying how humans detect AI-generated phishing emails. Every classification you make contributes to an empirical study on which phishing techniques are hardest to spot when AI eliminates traditional red flags like poor grammar.
                    </p>
                    <a
                      href="https://scottaltiparmak.com/research"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[var(--c-primary)] text-sm font-mono tracking-widest hover:underline"
                    >
                      {'>'} READ_FULL_RESEARCH →
                    </a>
                  </div>
                )}
              </div>
            </div>
            {/* Main column: actions + leaderboard */}
            <div className="contents lg:block lg:flex-1 lg:pl-6 lg:space-y-4">

          {/* Action buttons group */}
          <div className="space-y-4">
          {(() => {
            const answers = profile?.researchAnswersSubmitted ?? 0;
            const graduated = signedIn && (profile?.researchGraduated ?? false); // 10+ = H2H unlocked
            const dailyUnlocked = signedIn && answers >= 20; // 20+ = daily + stats + intel
            const freeplayUnlocked = signedIn && answers >= 30; // 30 = freeplay (research complete)
            const researchCapped = answers >= 30;
            const isResearch = signedIn && !graduated && !researchCapped;
            const needsCallsign = signedIn && !profile?.displayName;
            return (
              <>
                {!needsCallsign && !signedIn && (
                  <button
                    onClick={() => setShowInlineAuth(true)}
                    className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_6%,transparent)]"
                  >
                    [ LOG IN / SIGN UP TO PLAY ]
                  </button>
                )}
                {/* Pre-graduation: prominent research button */}
                {!needsCallsign && signedIn && isResearch && (
                  <button
                    onClick={() => handleStart('research')}
                    className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_6%,transparent)]"
                  >
                    [ RESEARCH MODE ]
                  </button>
                )}
                {/* Freeplay — unlocked at 30 (research complete) */}
                {!needsCallsign && signedIn && freeplayUnlocked && (
                  <button
                    onClick={() => tryStart('freeplay')}
                    className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all text-[var(--c-secondary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]"
                  >
                    [ FREEPLAY ]
                  </button>
                )}
                {/* Graduated (10-19): research is primary, next unlock = daily at 20 */}
                {!needsCallsign && signedIn && graduated && !dailyUnlocked && (
                  <button
                    onClick={() => handleStart('research')}
                    className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_6%,transparent)]"
                  >
                    [ RESEARCH MODE — {answers}/20 to unlock Daily Challenge ]
                  </button>
                )}
                {/* Daily unlocked (20-29): research continues, next unlock = freeplay at 30 */}
                {!needsCallsign && signedIn && dailyUnlocked && !freeplayUnlocked && (
                  <button
                    onClick={() => handleStart('research')}
                    className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_6%,transparent)]"
                  >
                    [ RESEARCH MODE — {answers}/30 to unlock Freeplay ]
                  </button>
                )}
                {/* Inline onboarding: sign-in (State 1) or callsign setup (State 2) */}
                {!signedIn && showInlineAuth && (
                  <div ref={inlineAuthRef} className="anim-slide-down term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)]">
                    <div className="px-3 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[var(--c-accent)] text-sm font-mono font-bold tracking-widest">SIGN IN TO START</div>
                        <button onClick={() => setShowInlineAuth(false)} aria-label="Close sign-in" className="text-[var(--c-accent)] text-sm font-mono hover:text-[var(--c-accent-dim)] p-1">✕</button>
                      </div>
                      <div className="text-[var(--c-secondary)] text-sm font-mono">New or returning — enter your email to begin or continue</div>
                      <div className="space-y-1 text-sm font-mono">
                        <div className="text-[var(--c-secondary)]"><span className="text-[var(--c-accent)]">▸</span> Track your XP + climb the leaderboard</div>
                        <div className="text-[var(--c-secondary)]"><span className="text-[var(--c-accent)]">▸</span> Contribute to phishing research</div>
                        <div className="text-[var(--c-secondary)]"><span className="text-[var(--c-accent)]">▸</span> Unlock Daily Challenge + Expert Mode</div>
                      </div>
                      <div className="text-[var(--c-accent-dim)] text-xs font-mono">Magic code · no password · 10 seconds</div>
                      <AuthFlow headless onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => setShowInlineAuth(false)} />
                    </div>
                  </div>
                )}
                {signedIn && profile && !profile.displayName && (
                  <div ref={inlineAuthRef} className="anim-slide-down term-border bg-[var(--c-bg)]">
                    <div className="px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--c-secondary)] text-sm tracking-widest">SET_CALLSIGN</span>
                        <button onClick={async () => { await signOut(); setShowInlineAuth(false); }} aria-label="Cancel setup" className="text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)] p-1">✕</button>
                      </div>
                      <div className="text-[var(--c-muted)] text-sm font-mono">Choose a callsign. Shown on the XP leaderboard. 1–20 characters.</div>
                      <form onSubmit={handleSetCallsign} className="space-y-2">
                        <input
                          ref={callsignInputRef}
                          type="text"
                          value={callsign}
                          onChange={(e) => { setCallsign(e.target.value); setCallsignError(''); }}
                          placeholder="ENTER CALLSIGN"
                          maxLength={20}
                          autoFocus
                          className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] text-[var(--c-primary)] font-mono text-sm px-2 py-1.5 placeholder:text-[var(--c-dark)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_70%,transparent)]"
                        />
                        <div ref={backgroundRef} className="space-y-1.5 pt-1">
                          <div className="text-[var(--c-secondary)] text-sm font-mono tracking-wider">BACKGROUND <span className="text-[var(--c-accent)]">*REQUIRED</span></div>
                          <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed opacity-70">Required for research. Helps us understand how expertise affects detection accuracy. Not stored with any personal information.</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {BACKGROUND_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setBackground(background === opt.value ? null : opt.value)}
                                className={`py-1.5 font-mono text-sm tracking-wider transition-all border ${
                                  background === opt.value
                                    ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_80%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]'
                                    : 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] hover:text-[var(--c-primary)] hover:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {callsignError && <div className="text-[#ff3333] text-sm font-mono">{callsignError}</div>}
                        <button
                          type="submit"
                          disabled={callsignLoading}
                          className="w-full py-2.5 term-border text-[var(--c-primary)] font-mono font-bold text-sm tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          {callsignLoading ? '...' : '[ SET ]'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                {researchCapped && (
                  <p className="text-[var(--c-accent)] text-sm text-center font-mono">
                    RESEARCH COMPLETE — 30/30 answers submitted. Thank you!
                  </p>
                )}
                {isResearch && profile && (
                  <p className="text-[var(--c-accent-dim)] text-sm text-center font-mono">
                    {answers} of 10 answers to unlock Head-to-Head
                  </p>
                )}
              </>
            );
          })()}

          {/* H2H button — unlocked at 10 research answers (graduation) */}
          {signedIn && profile?.researchGraduated ? (
            <button
              onClick={() => handleStart('h2h')}
              className="w-full py-4 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-2 border-[rgba(255,0,128,0.5)] text-[#ff0080] hover:bg-[rgba(255,0,128,0.04)]"
            >
              [ HEAD 2 HEAD ]
              <div className="text-[#003a0e] text-xs mt-1 font-normal tracking-wide">SEASON 0 — ranked competitive</div>
            </button>
          ) : signedIn ? (
            <div className="w-full py-4 term-border border-[rgba(255,0,128,0.15)] text-center font-mono text-sm tracking-widest text-[var(--c-muted)] cursor-not-allowed select-none">
              [ HEAD 2 HEAD — LOCKED ]
              <div className="text-[var(--c-muted)] text-xs mt-1 tracking-wide">Submit 10 research answers to unlock</div>
            </div>
          ) : null}

          {/* Daily challenge button — locked until 20 research answers */}
          {signedIn && (profile?.researchAnswersSubmitted ?? 0) >= 20 ? (
            <button
              onClick={() => tryStart('daily')}
              className="w-full py-4 lg:py-5 term-border-bright text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] transition-all"
            >
              [ DAILY CHALLENGE — {dateLabel} ]
            </button>
          ) : (
            <div className="w-full py-4 term-border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-center font-mono text-sm tracking-widest text-[var(--c-muted)] cursor-not-allowed select-none">
              [ DAILY CHALLENGE — LOCKED ]
              <div className="text-[var(--c-muted)] text-xs mt-1 tracking-wide">Submit 20 research answers to unlock</div>
            </div>
          )}

          {/* Freeplay locked state (unlocks at 30) */}
          {signedIn && (profile?.researchAnswersSubmitted ?? 0) < 30 && profile?.researchGraduated && (
            <div className="w-full py-3 term-border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-center font-mono text-sm tracking-widest text-[var(--c-muted)] cursor-not-allowed select-none">
              [ FREEPLAY — LOCKED ]
              <div className="text-[var(--c-muted)] text-xs mt-1 tracking-wide">Submit 30 research answers to unlock</div>
            </div>
          )}

          {/* Stats + Intel (20+ answers) */}
          {signedIn && (profile?.researchAnswersSubmitted ?? 0) >= 20 ? (
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/stats"
                className="block w-full py-3 term-border text-center text-[var(--c-secondary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-all"
              >
                [ STATS ]
              </Link>
              <Link
                href="/intel/player"
                className="block w-full py-3 term-border text-center text-[var(--c-secondary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-all"
              >
                [ INTEL ]
              </Link>
            </div>
          ) : (
            <Link
              href="/intel/player"
              className="block w-full py-3 term-border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-center font-mono text-sm tracking-widest text-[var(--c-muted)] select-none hover:bg-[color-mix(in_srgb,var(--c-primary)_2%,transparent)] transition-all"
            >
              [ STATS + INTEL — LOCKED ]
              <span className="block text-xs mt-1 tracking-wide">Submit 20 research answers to unlock</span>
            </Link>
          )}

          <div className="flex items-center justify-center gap-3 font-mono">
            <span className="text-[var(--c-muted)] text-sm lg:text-base">10 questions per round</span>
            <span className="text-[var(--c-muted)]">·</span>
            <Link
              href="/changelog"
              onClick={() => { try { localStorage.setItem('lastSeenVersion', version); setHasUnreadChangelog(false); } catch {} }}
              className="relative text-[var(--c-secondary)] hover:text-[var(--c-primary)] transition-colors tracking-wider text-sm lg:text-base border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-2 py-0.5 hover:border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)]"
            >
              v{version}
              {hasUnreadChangelog && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
              )}
            </Link>
          </div>
          </div>

          {/* Tabbed leaderboard — XP always visible; Daily tab only for fully unlocked players */}
          {(() => {
            const canSeeDailyLb = signedIn && (profile?.researchAnswersSubmitted ?? 0) >= 20;
            const showLeaderboard = xpLeaderboard.length > 0 || (canSeeDailyLb && dailyLeaderboard.length > 0);
            if (!showLeaderboard) return null;
            return (
              <div className="term-border bg-[var(--c-bg)]">
                <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('xp')}
                    className={`text-sm font-mono tracking-widest ${activeTab === 'xp' ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)]'}`}
                  >
                    XP
                  </button>
                  {canSeeDailyLb && (
                    <>
                      <span className="text-[var(--c-muted)] text-sm">|</span>
                      <button
                        onClick={() => setActiveTab('daily')}
                        className={`text-sm font-mono tracking-widest ${activeTab === 'daily' ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)]'}`}
                      >
                        DAILY
                      </button>
                    </>
                  )}
                </div>
                {activeTab === 'xp' && xpLeaderboard.length > 0 && (
                  <div key={`xp-${xpLeaderboard.length}`} className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                    {xpLeaderboard.map((row, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 lg:py-2.5 text-sm lg:text-base font-mono anim-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                        <span className="text-[var(--c-muted)] w-4">{i + 1}.</span>
                        <span className="text-[var(--c-secondary)] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
                        {row.research_graduated && <span className="text-[var(--c-accent)] text-sm">★</span>}
                        {(() => { const r = getRankFromLevel(row.level); return (
                          <span className={`text-sm font-mono shrink-0`} style={{ color: r.color }}>
                            {r.label}
                          </span>
                        ); })()}
                        <span className="text-[var(--c-primary)]">{row.xp.toLocaleString()} XP</span>
                      </div>
                    ))}
                  </div>
                )}
                {canSeeDailyLb && activeTab === 'daily' && dailyLeaderboard.length > 0 && (
                  <div key={`daily-${dailyLeaderboard.length}`} className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                    {dailyLeaderboard.map((entry, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 lg:py-2.5 anim-fade-in-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                        <span className={`text-sm font-mono w-4 shrink-0 ${i === 0 ? 'text-[var(--c-accent)]' : 'text-[var(--c-muted)]'}`}>{i + 1}</span>
                        <span className="text-[var(--c-secondary)] text-sm font-mono flex-1 truncate">{entry.name}</span>
                        {(() => { const r = getRankFromLevel(entry.level ?? 1); return (
                          <span className={`text-sm font-mono shrink-0`} style={{ color: r.color }}>{r.label}</span>
                        ); })()}
                        <span className="text-[var(--c-primary)] text-sm font-mono font-bold">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                {canSeeDailyLb && activeTab === 'daily' && dailyLeaderboard.length === 0 && (
                  <div className="px-3 py-4 text-center text-[var(--c-muted)] text-sm font-mono">No scores today yet.</div>
                )}
                {activeTab === 'xp' && xpLeaderboard.length === 0 && (
                  <div className="px-3 py-4 text-center text-[var(--c-muted)] text-sm font-mono">No players yet.</div>
                )}
                {!lbExpanded && (xpLeaderboard.length >= 10 || dailyLeaderboard.length >= 10) && (
                  <button
                    onClick={handleExpandLeaderboard}
                    disabled={lbExpandLoading}
                    className="w-full py-2 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-sm font-mono tracking-widest transition-colors disabled:opacity-50"
                  >
                    {lbExpandLoading ? '...' : '[ SHOW MORE ]'}
                  </button>
                )}
                {lbExpanded && (
                  <button
                    onClick={handleCollapseLeaderboard}
                    className="w-full py-2 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-sm font-mono tracking-widest transition-colors"
                  >
                    [ SHOW LESS ]
                  </button>
                )}
              </div>
            );
          })()}
            </div>
          </div>
        </div>
      )}

      {/* XP Cooldown Modal */}
      {cooldownModalMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4" onClick={() => setCooldownModalMode(null)}>
          <div className="term-border bg-[var(--c-bg)] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-[rgba(255,170,0,0.4)] px-3 py-2">
              <span className="text-[#ffaa00] text-sm font-mono font-bold tracking-widest">COOLDOWN_ACTIVE</span>
            </div>
            <div className="px-3 py-4 space-y-3">
              <div className="text-center">
                <div className="text-[#ffaa00] text-2xl font-mono font-bold">{cooldownTimer ?? '—'}</div>
                <div className="text-[var(--c-muted)] text-sm font-mono mt-1">until XP earning resumes</div>
              </div>
              <div className="text-[var(--c-secondary)] text-sm font-mono text-center leading-relaxed">
                You can still play — this session won&apos;t earn XP.
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => { const mode = cooldownModalMode; setCooldownModalMode(null); handleStart(mode); }}
                  className="w-full py-3 term-border text-[var(--c-secondary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] transition-all"
                >
                  [ PLAY ANYWAY — NO XP ]
                </button>
                {signedIn && !(profile?.researchGraduated ?? false) && (profile?.researchAnswersSubmitted ?? 0) < 30 && (
                  <button
                    onClick={() => { setCooldownModalMode(null); handleStart('research'); }}
                    className="w-full py-3 term-border border-[rgba(255,170,0,0.5)] text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.06)] transition-all"
                  >
                    [ PLAY RESEARCH — EARNS XP ]
                  </button>
                )}
                <button
                  onClick={() => setCooldownModalMode(null)}
                  className="w-full py-2 text-[var(--c-muted)] font-mono text-sm tracking-widest hover:text-[var(--c-secondary)] transition-colors"
                >
                  [ CANCEL ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
