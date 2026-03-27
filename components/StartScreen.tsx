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
import { ACHIEVEMENTS, RARITY_COLORS } from '@/lib/achievements';
import { version } from '@/package.json';
import { QUESTS } from '@/lib/quests';
import { Handler } from './Handler';
import { HANDLER_DIALOGUES, hasSeenMoment, markMomentSeen } from '@/lib/handler-dialogues';
import { dynamicDialogue } from '@/lib/sigint-personality';
import { useSigint } from '@/lib/SigintContext';

interface LeaderboardEntry {
  name: string;
  score: number;
  level?: number;
}

interface Props {
  onStart: (mode: GameMode) => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
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
  { text: '> ─────────────────────────────', bright: true  },
  { text: '> LOADING RESEARCH DATASET.....', bright: false },
  { text: '> DATASET: v1.0',                bright: false },
  { text: '> CONFIDENCE SCORING: ENABLED',  bright: false },
  { text: '> STREAK DETECTION: ONLINE',     bright: false },
  { text: '> ─────────────────────────────', bright: true  },
  { text: '> SYSTEM READY.',                bright: true  },
];

export function StartScreen({ onStart, musicEnabled, onToggleMusic: toggleMusic }: Props) {
  const bootSeen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bootSeen') === '1';
  const [visibleCount, setVisibleCount] = useState(bootSeen ? BOOT_LINES.length : 0);
  // Handler greeting — different dialogue depending on player state
  const [showButton, setShowButton] = useState(bootSeen);
  const [showHandlerGreeting, setShowHandlerGreeting] = useState(false);
  const [handlerLines, setHandlerLines] = useState<string[]>([]);
  const [handlerButton, setHandlerButton] = useState('CONTINUE');
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
  const [activeTab, setActiveTab] = useState<'daily' | 'xp' | 'h2h'>('xp');
  const [h2hStats, setH2HStats] = useState<{ rankLabel: string; rankIcon: string; rankPoints: number; rankColor: string; wins: number; losses: number; winStreak: number } | null>(null);
  const [h2hLeaderboard, setH2HLeaderboard] = useState<{ position: number; displayName: string; rankPoints: number; rankLabel: string; rankColor: string; wins: number; losses: number }[]>([]);
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

  // Fetch H2H stats + leaderboard if graduated
  useEffect(() => {
    if (!profile?.researchGraduated) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/h2h/stats'),
      fetch('/api/h2h/leaderboard'),
    ]).then(async ([statsRes, lbRes]) => {
      if (cancelled) return;
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (!cancelled) setH2HStats(data);
      }
      if (lbRes.ok) {
        const data = await lbRes.json();
        if (!cancelled) setH2HLeaderboard(data.leaderboard ?? []);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.researchGraduated]);

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
      }, 400);
      return () => clearTimeout(fallback);
    }
  }, [bootDone, bootHidden]);

  // SIGINT milestone unlocks — fire when player crosses answer thresholds
  const { triggerSigint } = useSigint();

  const fireMilestones = useCallback(() => {
    if (!signedIn || !profile) return;
    const answers = profile.researchAnswersSubmitted ?? 0;
    const graduated = profile.researchGraduated ?? false;

    // Check milestones in reverse order (highest first) — only one fires per visit
    if (answers >= 30) triggerSigint('freeplay_unlock');
    else if (answers >= 20) triggerSigint('daily_unlock');
    else if (graduated || answers >= 10) triggerSigint('pvp_unlock');
  }, [signedIn, profile, triggerSigint]);

  // Show SIGINT greeting OR milestone on home page.
  // Milestones take priority — if one is pending, skip greeting and show milestone.
  // Greetings are recurring (every login with 2hr cooldown).
  const greetingShownThisSession = useRef(false);
  useEffect(() => {
    if (!showButton || greetingShownThisSession.current) return;
    if (!signedIn || !profile) return;
    greetingShownThisSession.current = true;

    const seen = profile.seenMoments ?? [];
    const answers = profile.researchAnswersSubmitted ?? 0;
    const graduated = profile.researchGraduated ?? false;
    const callsign = profile.displayName ?? 'operative';

    // v2_intro ALWAYS takes priority for v1 veterans who haven't seen SIGINT yet.
    // Milestones get pre-marked on dismiss so they don't fire after.
    if (answers > 0 && !seen.includes('v2_intro') && !hasSeenMoment('v2_intro')) {
      setHandlerLines(dynamicDialogue('v2_intro', callsign)!.lines);
      setHandlerButton(dynamicDialogue('v2_intro', callsign)!.buttonText ?? 'GOT IT');
      setShowHandlerGreeting(true);
      return;
    }

    // Check for pending milestones — they take priority over recurring greetings
    const pendingMilestone =
      (answers >= 30 && !seen.includes('freeplay_unlock')) ? 'freeplay_unlock' :
      (answers >= 20 && !seen.includes('daily_unlock')) ? 'daily_unlock' :
      (answers >= 15 && answers < 20 && !seen.includes('research_halfway')) ? 'research_halfway' :
      ((graduated || answers >= 10) && !seen.includes('pvp_unlock')) ? 'pvp_unlock' :
      null;

    if (pendingMilestone) {
      // Show milestone via SigintContext (renders from layout, not StartScreen)
      triggerSigint(pendingMilestone);
      // Queue bonus milestones behind it (level, sessions)
      if (profile.level >= 20) triggerSigint('level_20');
      else if (profile.level >= 10) triggerSigint('level_10');
      if (profile.totalSessions >= 7) triggerSigint('played_7_days');
      return;
    }

    // No pending milestone — show greeting
    // Skip if already greeted recently (within 2 hours)
    const lastGreeted = Number(sessionStorage.getItem('sigint_greeted') ?? '0');
    if (lastGreeted && Date.now() - lastGreeted < 2 * 60 * 60 * 1000) {
      // Even without greeting, check bonus milestones
      if (profile.level >= 20) triggerSigint('level_20');
      else if (profile.level >= 10) triggerSigint('level_10');
      if (profile.totalSessions >= 7) triggerSigint('played_7_days');
      return;
    }

    let dialogue: { lines: string[]; buttonText?: string } | null = null;

    if (answers === 0) {
      // Brand new player — full intro (repeats until they start playing)
      dialogue = HANDLER_DIALOGUES.boot_greeting;
    } else {
      // Returning player — rotating personalized welcome
      dialogue = dynamicDialogue('welcome_back', callsign);
    }

    if (dialogue) {
      setHandlerLines(dialogue.lines);
      setHandlerButton(dialogue.buttonText ?? 'CONTINUE');
      setShowHandlerGreeting(true);
    }

    // Time-based one-time moments — fire via SigintContext (queue behind greeting)
    const hour = new Date().getHours();
    const day = new Date().getDay(); // 0=Sun, 6=Sat
    if (hour >= 0 && hour < 5) triggerSigint('night_owl');
    if (day === 0 || day === 6) triggerSigint('weekend_warrior');
  }, [showButton, signedIn, profile, triggerSigint]);

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

  // ── Stage computation ──
  const rawAnswers = profile?.researchAnswersSubmitted ?? 0;
  const graduated = signedIn && (profile?.researchGraduated ?? false);
  const answers = graduated ? Math.max(rawAnswers, 10) : rawAnswers;
  const dailyUnlocked = signedIn && answers >= 20;
  const researchCapped = answers >= 30;
  const needsCallsign = signedIn && !profile?.displayName;

  const stage: 1 | 2 | 3 | 4 = researchCapped ? 4 : dailyUnlocked ? 3 : graduated ? 2 : 1;
  const [questExpanded, setQuestExpanded] = useState(false);

  return (
    <div className={`w-full px-4 pb-safe flex flex-col gap-6 ${showButton ? 'max-w-xl' : 'max-w-md'}`}>
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
                onClick={toggleMusic}
                aria-label={musicEnabled ? 'Mute music' : 'Enable music'}
                className={`lg:hidden text-sm font-mono transition-colors p-2 -m-2 ${musicEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}
              >
                {musicEnabled ? '[MUSIC]' : '[MUSIC OFF]'}
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

      {/* SIGINT handler greeting — new players only, above main content */}
      {showHandlerGreeting && handlerLines.length > 0 && (
        <Handler
          lines={handlerLines}
          buttonText={handlerButton}
          onDismiss={() => {
            const answers = profile?.researchAnswersSubmitted ?? 0;
            const graduated = profile?.researchGraduated ?? false;
            // Mark greeted with timestamp (2hr cooldown for recurring greetings)
            try { sessionStorage.setItem('sigint_greeted', String(Date.now())); } catch {}
            // v2_intro: mark seen + pre-mark all milestones the player already earned
            // so v1 veterans don't get milestone dialogues for things they already had
            if (answers > 0 && !hasSeenMoment('v2_intro')) {
              markMomentSeen('v2_intro');
              // Pre-mark only answer-threshold milestones they already passed
              if (graduated || answers >= 10) markMomentSeen('pvp_unlock');
              if (answers >= 15) markMomentSeen('research_halfway');
              if (answers >= 20) markMomentSeen('daily_unlock');
              if (answers >= 30) markMomentSeen('freeplay_unlock');
              markMomentSeen('first_correct');
              markMomentSeen('first_session_complete');
              // Refresh profile so seenMoments is up to date (prevents re-triggering)
              refreshProfile();
            }
            setShowHandlerGreeting(false);
            // After greeting, fire bonus milestones (level, sessions) via SigintContext queue
            setTimeout(() => {
              if (profile && profile.level >= 20) triggerSigint('level_20');
              else if (profile && profile.level >= 10) triggerSigint('level_10');
              if (profile && profile.totalSessions >= 7) triggerSigint('played_7_days');
            }, 300);
          }}
        />
      )}

      {showButton && (
        <div className="anim-fade-in-up space-y-4">
          {/* Music toggle — mobile only, visible when not signed in (signed-in users see it in profile header) */}
          {!signedIn && (
            <div className="flex justify-end lg:hidden">
              <button
                onClick={toggleMusic}
                aria-label={musicEnabled ? 'Mute music' : 'Enable music'}
                className={`text-sm font-mono transition-colors ${musicEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}
              >
                {musicEnabled ? '[MUSIC]' : '[MUSIC OFF]'}
              </button>
            </div>
          )}
          {/* Player Profile Card — only shown for signed-in users with a display name */}
          {!playerLoading && signedIn && profile?.displayName && (
            <div className="anim-fade-in-up">
              <div className="term-border bg-[var(--c-bg)]">
                {/* Player header — two rows for clean layout */}
              <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <Link href="/profile" className="text-[var(--c-primary)] text-base font-mono font-bold tracking-widest hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] transition-colors truncate max-w-[60%]">
                    {profile.displayName}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {profile.featuredBadge && (() => {
                      const badge = ACHIEVEMENTS.find(a => a.id === profile.featuredBadge);
                      if (!badge) return null;
                      const color = RARITY_COLORS[badge.rarity];
                      return <span style={{ color }}>{badge.icon}</span>;
                    })()}
                    <button onClick={toggleMusic} className={`text-sm font-mono ${musicEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'} hover:text-[var(--c-secondary)]`}>
                      MUSIC {musicEnabled ? '[ON]' : '[OFF]'}
                    </button>
                    <button onClick={async () => { await signOut(); }} className="text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)]">SIGN OUT</button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--c-secondary)]">
                    ★ {profile.achievements?.length ?? 0}/{ACHIEVEMENTS.length} BADGES
                  </span>
                  {profile.researchGraduated && (
                    <span className="text-[var(--c-accent)]">RANKED UNLOCKED</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-2">
                <LevelMeter xp={profile.xp} level={profile.level} />
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

          {/* Inline auth flow — sign-in */}
          {!signedIn && !needsCallsign && (
            <>
              <button
                onClick={() => setShowInlineAuth(true)}
                className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_6%,transparent)]"
              >
                [ LOG IN / SIGN UP TO PLAY ]
              </button>
              {showInlineAuth && (
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
            </>
          )}

          {/* Callsign setup flow */}
          {signedIn && profile && !profile.displayName && (
            <div ref={inlineAuthRef} className="anim-slide-down term-border bg-[var(--c-bg)]">
              <div className="px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--c-secondary)] text-sm tracking-widest">SET_CALLSIGN</span>
                  <button onClick={async () => { await signOut(); setShowInlineAuth(false); }} aria-label="Cancel setup" className="text-[var(--c-muted)] text-sm font-mono hover:text-[var(--c-secondary)] p-1">✕</button>
                </div>
                <div className="text-[var(--c-secondary)] text-sm font-mono">Choose a callsign. Shown on the XP leaderboard. 1–20 characters.</div>
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

          {/* ── Stage-based content (only for signed-in players with callsign) ── */}
          {signedIn && profile?.displayName && (() => {
            // Find the current quest
            const currentQuest = QUESTS.find((quest) => {
              const completed = answers >= quest.target;
              const prevQuest = QUESTS[QUESTS.indexOf(quest) - 1];
              return !completed && (quest.target === 10 ? true : answers >= (prevQuest?.target ?? 0));
            });
            const currentQuestProgress = currentQuest ? Math.min(answers, currentQuest.target) : 0;

            // ── PvP button (shared across stages 2-4) ──
            const pvpButton = (
              <button
                onClick={() => handleStart('h2h')}
                className="w-full flex-1 py-4 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-2 border-[rgba(255,0,128,0.5)] text-[#ff0080] hover:bg-[rgba(255,0,128,0.04)] btn-glow"
              >
                [ PvP MODE ]
                <div className="text-[var(--c-secondary)] text-xs mt-1 font-normal tracking-wide">RANKED COMPETITIVE</div>
              </button>
            );

            // ── Daily button (shared across stages 3-4) ──
            const dailyButton = (
              <button
                onClick={() => tryStart('daily')}
                className="w-full flex-1 py-4 term-border-bright text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] transition-all btn-glow"
              >
                [ DAILY ]
                <div className="text-[var(--c-secondary)] text-xs mt-1 font-normal tracking-wide">{dateLabel}</div>
              </button>
            );

            // ── Freeplay button (stage 4 only) ──
            const freeplayButton = (
              <button
                onClick={() => tryStart('freeplay')}
                className="w-full flex-1 py-4 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all text-[var(--c-secondary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] btn-glow"
              >
                [ FREEPLAY ]
              </button>
            );

            // Intel button removed from home — now in the game layout footer

            // ── Version link (all stages) ──
            const versionLink = (
              <div className="flex items-center justify-center font-mono">
                <Link
                  href="/changelog"
                  onClick={() => { try { localStorage.setItem('lastSeenVersion', version); setHasUnreadChangelog(false); } catch {} }}
                  className="relative text-[var(--c-secondary)] hover:text-[var(--c-primary)] transition-colors tracking-wider text-sm border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-2 py-0.5 hover:border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)]"
                >
                  v{version}
                  {hasUnreadChangelog && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
                  )}
                </Link>
              </div>
            );

            // ── Leaderboard (stages 3-4) ──
            const leaderboard = (() => {
              const canSeeDailyLb = signedIn && profile?.researchGraduated;
              const canSeeH2HLb = signedIn && profile?.researchGraduated;
              const showLeaderboard = xpLeaderboard.length > 0 || (canSeeDailyLb && dailyLeaderboard.length > 0) || canSeeH2HLb;
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
                    {canSeeH2HLb && (
                      <>
                        <span className="text-[var(--c-muted)] text-sm">|</span>
                        <button
                          onClick={() => setActiveTab('h2h')}
                          className={`text-sm font-mono tracking-widest ${activeTab === 'h2h' ? 'text-[#ff0080]' : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)]'}`}
                        >
                          PvP
                        </button>
                      </>
                    )}
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
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 lg:py-2.5 text-sm lg:text-base font-mono anim-fade-in-up" style={{ opacity: 0, animationDelay: `${i * 60}ms` }}>
                          <span className="text-[var(--c-muted)] w-4">{i + 1}.</span>
                          {row.display_name ? (
                            <Link href={`/player/${encodeURIComponent(row.display_name)}`} className="text-[var(--c-secondary)] flex-1 truncate hover:text-[var(--c-primary)] transition-colors">{row.display_name}</Link>
                          ) : (
                            <span className="text-[var(--c-muted)] flex-1 truncate">ANON</span>
                          )}
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
                        <div key={i} className="flex items-center gap-3 px-3 py-1.5 lg:py-2.5 anim-fade-in-up" style={{ opacity: 0, animationDelay: `${Math.min(i, 10) * 60}ms` }}>
                          <span className={`text-sm font-mono w-4 shrink-0 ${i === 0 ? 'text-[var(--c-accent)]' : 'text-[var(--c-muted)]'}`}>{i + 1}</span>
                          {entry.name ? (
                            <Link href={`/player/${encodeURIComponent(entry.name)}`} className="text-[var(--c-secondary)] text-sm font-mono flex-1 truncate hover:text-[var(--c-primary)] transition-colors">{entry.name}</Link>
                          ) : (
                            <span className="text-[var(--c-muted)] text-sm font-mono flex-1 truncate">ANON</span>
                          )}
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
                  {canSeeH2HLb && activeTab === 'h2h' && h2hLeaderboard.length > 0 && (
                    <div key={`h2h-${h2hLeaderboard.length}`} className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
                      {h2hLeaderboard.map((row, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 lg:py-2.5 text-sm lg:text-base font-mono anim-fade-in-up" style={{ opacity: 0, animationDelay: `${i * 60}ms` }}>
                          <span className="text-[var(--c-muted)] w-4">{row.position}.</span>
                          <Link href={`/player/${encodeURIComponent(row.displayName)}`} className="text-[var(--c-secondary)] flex-1 truncate hover:text-[var(--c-primary)] transition-colors">{row.displayName}</Link>
                          <span className="text-sm font-mono shrink-0" style={{ color: row.rankColor }}>{row.rankLabel}</span>
                          <span className="text-[var(--c-primary)]">{row.rankPoints} pts</span>
                          <span className="text-[var(--c-muted)] text-xs">{row.wins}W/{row.losses}L</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {canSeeH2HLb && activeTab === 'h2h' && h2hLeaderboard.length === 0 && (
                    <div className="px-3 py-4 text-center text-[var(--c-muted)] text-sm font-mono">No ranked matches yet. Be the first.</div>
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
            })();

            /* ── STAGE 1: New player (0-9 answers) ── */
            if (stage === 1) {
              return (
                <div className="space-y-4">
                  {/* Quest card */}
                  {currentQuest && (
                    <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)]">
                      <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] px-4 py-2">
                        <span className="text-[var(--c-accent)] text-xs font-mono tracking-widest">ACTIVE_QUEST</span>
                      </div>
                      <div className="px-4 py-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{currentQuest.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[var(--c-accent)] text-base font-mono font-bold tracking-widest">{currentQuest.name}</div>
                            <div className="text-[var(--c-secondary)] text-sm font-mono mt-2 leading-relaxed">{currentQuest.detail}</div>
                            <div className="text-[var(--c-accent)] text-xs font-mono mt-2">Reward: +{currentQuest.xpReward} XP · Unlocks: {currentQuest.reward}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 bg-[var(--c-dark)]">
                            <div
                              className="h-full bg-[var(--c-accent)] transition-all"
                              style={{ width: `${(currentQuestProgress / currentQuest.target) * 100}%` }}
                            />
                          </div>
                          <span className="text-[var(--c-accent)] text-sm font-mono font-bold">{currentQuestProgress}/{currentQuest.target}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Big research button — separate from quest */}
                  <button
                    onClick={() => handleStart('research')}
                    className="w-full py-5 term-border font-mono font-bold tracking-widest text-lg active:scale-95 transition-all border-2 border-[color-mix(in_srgb,var(--c-accent)_60%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] btn-glow"
                  >
                    [ RESEARCH MODE ]
                    <div className="text-[var(--c-secondary)] text-sm mt-1 font-normal tracking-wide">Analyze emails. Earn clearance.</div>
                  </button>
                  {versionLink}
                </div>
              );
            }

            /* ── STAGE 2: PvP unlocked (10-19 answers) ── */
            if (stage === 2) {
              return (
                <div className="space-y-4">
                  {/* Quest + research button — expandable for detail */}
                  {currentQuest && (
                    <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)]">
                      <button
                        onClick={() => setQuestExpanded(v => !v)}
                        className="w-full px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--c-accent)_3%,transparent)] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{currentQuest.icon}</span>
                            <span className="text-[var(--c-accent)] text-sm font-mono font-bold tracking-wide">{currentQuest.name}</span>
                            <span className="text-[var(--c-muted)] text-xs font-mono">+{currentQuest.xpReward} XP</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--c-accent)] text-sm font-mono font-bold">{currentQuestProgress}/{currentQuest.target}</span>
                            <span className="text-[var(--c-accent)] text-xs">{questExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <p className="text-[var(--c-muted)] text-xs font-mono mt-1">{currentQuest.description}</p>
                        <div className="h-2 bg-[var(--c-dark)] mt-2">
                          <div
                            className="h-full bg-[var(--c-accent)] transition-all"
                            style={{ width: `${(currentQuestProgress / currentQuest.target) * 100}%` }}
                          />
                        </div>
                      </button>
                      {questExpanded && (
                        <div className="px-4 pb-3 space-y-3 border-t border-[color-mix(in_srgb,var(--c-accent)_15%,transparent)]">
                          <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed pt-3">{currentQuest.detail}</div>
                          <div className="text-[var(--c-accent)] text-xs font-mono">Reward: +{currentQuest.xpReward} XP · Unlocks: {currentQuest.reward}</div>
                        </div>
                      )}
                      <div className="px-4 pb-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStart('research'); }}
                          className="w-full py-4 term-border font-mono font-bold tracking-widest text-base active:scale-95 transition-all border-2 border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] btn-glow anim-pulse-glow"
                        >
                          [ RESEARCH MODE ]
                          <div className="text-[var(--c-secondary)] text-xs mt-1 font-normal tracking-wide">Analyze emails. Earn clearance.</div>
                        </button>
                      </div>
                    </div>
                  )}
                  {pvpButton}
                  {versionLink}
                </div>
              );
            }

            /* ── STAGE 3: Daily unlocked (20-29 answers) ── */
            if (stage === 3) {
              return (
                <div className="space-y-4">
                  {/* Quest compact + research — expandable for detail */}
                  {currentQuest && (
                    <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)]">
                      <button
                        onClick={() => setQuestExpanded(v => !v)}
                        className="w-full px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--c-accent)_3%,transparent)] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--c-accent)] tracking-widest">QUEST:</span>
                            <span>{currentQuest.icon}</span>
                            <span className="text-[var(--c-accent)] text-sm font-mono font-bold">{currentQuest.name}</span>
                            <span className="text-[var(--c-muted)] text-xs font-mono">+{currentQuest.xpReward} XP</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--c-accent)] text-sm font-mono font-bold">{currentQuestProgress}/{currentQuest.target}</span>
                            <span className="text-[var(--c-accent)] text-xs">{questExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[var(--c-dark)] mt-2">
                          <div
                            className="h-full bg-[var(--c-accent)] transition-all"
                            style={{ width: `${(currentQuestProgress / currentQuest.target) * 100}%` }}
                          />
                        </div>
                      </button>
                      {questExpanded && (
                        <div className="px-4 pb-3 space-y-3 border-t border-[color-mix(in_srgb,var(--c-accent)_15%,transparent)]">
                          <div className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed pt-3">{currentQuest.detail}</div>
                          <div className="text-[var(--c-accent)] text-xs font-mono">Reward: +{currentQuest.xpReward} XP · Unlocks: {currentQuest.reward}</div>
                        </div>
                      )}
                      <div className="px-4 pb-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStart('research'); }}
                          className="w-full py-3 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all border-[color-mix(in_srgb,var(--c-accent)_50%,transparent)] text-[var(--c-accent)] hover:bg-[color-mix(in_srgb,var(--c-accent)_8%,transparent)] btn-glow"
                        >
                          [ RESEARCH MODE ]
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {pvpButton}
                    {dailyButton}
                  </div>
                  {leaderboard}
                  {versionLink}
                </div>
              );
            }

            /* ── STAGE 4: Fully unlocked (30+ answers) ── */
            return (
              <div className="space-y-4">
                <p className="text-[var(--c-accent)] text-sm text-center font-mono">
                  RESEARCH COMPLETE — 30/30. Thank you for contributing.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {pvpButton}
                  {dailyButton}
                  {freeplayButton}
                </div>
                {leaderboard}
                {versionLink}
              </div>
            );
          })()}

          {/* Version link for non-signed-in users */}
          {(!signedIn || !profile?.displayName) && (
            <div className="flex items-center justify-center font-mono">
              <Link
                href="/changelog"
                onClick={() => { try { localStorage.setItem('lastSeenVersion', version); setHasUnreadChangelog(false); } catch {} }}
                className="relative text-[var(--c-secondary)] hover:text-[var(--c-primary)] transition-colors tracking-wider text-sm border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-2 py-0.5 hover:border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)]"
              >
                v{version}
                {hasUnreadChangelog && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--c-accent)] animate-pulse" />
                )}
              </Link>
            </div>
          )}
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
