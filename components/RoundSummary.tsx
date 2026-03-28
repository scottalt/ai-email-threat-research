'use client';

import { useState, useEffect, useRef } from 'react';
import type { RoundResult, GameMode } from '@/lib/types';
import { getRankFromLevel } from '@/lib/rank';
import { updateWeaknessHistory, getWeakPoints } from '@/lib/weakness-tracker';
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from './LevelMeter';
import { AuthFlow } from './AuthFlow';
import { AchievementToast } from './AchievementToast';
import { getXpForRound } from '@/lib/xp';
import { playLevelUp } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  score: number;
  total: number;
  totalScore: number;
  results: RoundResult[];
  mode: GameMode;
  sessionId: string;
  onPlayAgain: () => void;
}

function getTier(score: number, total: number): { label: string; sub: string; color: string } {
  const pct = score / total;
  if (pct === 1) return { label: 'PERFECT_SCORE', color: 'text-[var(--c-primary)]', sub: 'Zero breaches. Clean sweep.' };
  if (pct >= 0.8) return { label: 'SHARP_ANALYST', color: 'text-[var(--c-primary)]', sub: 'Strong instincts. A couple slipped through.' };
  if (pct >= 0.6) return { label: 'NEEDS_CALIBRATION', color: 'text-[#ffaa00]', sub: 'Decent, but a few got past you.' };
  if (pct >= 0.4) return { label: 'HOOKED', color: 'text-[#ff3333]', sub: 'You took the bait more than once.' };
  return { label: 'COMPROMISED', color: 'text-[#ff3333]', sub: 'The phishers owned you this round.' };
}

const CONFIDENCE_LABEL: Record<string, string> = { guessing: 'G', likely: 'L', certain: 'C' };

const SHARE_URL = 'https://research.scottaltiparmak.com/?ref=share';

function buildShareText(opts: {
  label: string;
  score: number;
  total: number;
  totalScore: number;
  mode: GameMode;
}): { text: string; url: string } {
  let headline = `🎣 ${opts.label} · ${opts.score}/${opts.total} · ${opts.totalScore.toLocaleString()} pts`;

  if (opts.mode === 'daily') {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    headline += ` · ${dateStr} Daily`;
  } else if (opts.mode === 'expert') {
    headline += ' · Expert';
  }

  const text = `${headline}\nCan you spot the phish? Most people can't.`;
  return { text, url: SHARE_URL };
}

export function RoundSummary({ score, total, totalScore, results, mode, sessionId, onPlayAgain }: Props) {
  const { soundEnabled } = useSoundEnabled();
  const tier = getTier(score, total);
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    if (totalScore === 0) { setDisplayScore(0); return; }
    const duration = 900;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * totalScore));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [totalScore]);
  const [weakPoints, setWeakPoints] = useState<{ technique: string; missRate: number; missed: number; attempts: number }[]>([]);
  const { profile, signedIn, refreshProfile, signInWithEmail, verifyOtp } = usePlayer();
  const rank = profile ? getRankFromLevel(profile.level) : null;
  const [xpResult, setXpResult] = useState<{
    xpEarned: number; level: number; levelUp: boolean; graduated: boolean; newAchievements?: string[];
    streakDay?: number; streakBonusXp?: number;
  } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [copied, setCopied] = useState(false);
  const xpFired = useRef(false);
  useEffect(() => {
    if (mode !== 'research') return;
    const techniqueResults = results.map((r) => ({
      technique: r.card.technique ?? null,
      correct: r.correct,
    }));
    const updated = updateWeaknessHistory(techniqueResults);
    setWeakPoints(getWeakPoints(updated));
  }, [mode, results]);

  const correctCount = results.filter(r => r.correct).length;
  const xpEarned = getXpForRound(correctCount, total, mode);

  async function handleShare() {
    const label = rank ? rank.label : tier.label;
    const { text, url } = buildShareText({ label, score, total, totalScore, mode });

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Threat Terminal', text, url });
      } catch {
        // User dismissed share sheet or error — silently ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API failed — silently ignore
      }
    }
  }

  useEffect(() => {
    if (!signedIn || xpFired.current) return;
    xpFired.current = true;
    fetch('/api/player/xp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xpEarned, score: totalScore, gameMode: mode, sessionCompleted: true, sessionId }),
    })
      .then(async (r) => {
        if (r.status === 429) {
          const body = await r.json().catch(() => null);
          // Cooldown is now read from profile.cooldown (server-side)
          setRateLimited(true);
          return null;
        }
        if (!r.ok) { console.error('[player/xp] non-ok response:', r.status); return null; }
        return r.json();
      })
      .then(data => {
        if (data) {
          setXpResult(data);
          refreshProfile();
          // Cooldown is now read from profile.cooldown (server-side)
        }
      })
      .catch((err) => { console.error('[player/xp] award failed:', err); });
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play level-up sound when XP result arrives with a level up
  useEffect(() => {
    if (xpResult?.levelUp && soundEnabled) {
      playLevelUp();
    }
  }, [xpResult?.levelUp]); // eslint-disable-line react-hooks/exhaustive-deps

  const phishingCaught = results.filter((r) => r.card.isPhishing && r.correct).length;
  const legitCorrect = results.filter((r) => !r.card.isPhishing && r.correct).length;
  const phishingTotal = results.filter((r) => r.card.isPhishing).length;
  const legitTotal = results.filter((r) => !r.card.isPhishing).length;
  const maxPossible = results.length * 300;
  const efficiency = Math.round((totalScore / maxPossible) * 100);

  return (
    <div className="anim-fade-in-up w-full max-w-sm lg:max-w-lg px-4 pb-safe flex flex-col gap-4">
      {/* XP award — only shown when signed in and API has responded */}
      {signedIn && xpResult && (
        <div className="term-border bg-[var(--c-bg)] px-3 py-3 space-y-2">
          <div className="flex justify-between text-sm font-mono">
            <span className="text-[var(--c-secondary)]">XP EARNED</span>
            <span className="text-[var(--c-primary)] font-bold anim-xp-pop">+{xpResult.xpEarned} XP</span>
          </div>
          {xpResult.levelUp && (
            <>
              <div className="anim-level-up text-[var(--c-accent)] text-sm font-mono text-center">LEVEL UP → {xpResult.level}</div>
              <div className="level-flash-overlay" />
            </>
          )}
          {xpResult.graduated && (
            <div className="term-border border-[color-mix(in_srgb,var(--c-accent)_40%,transparent)] px-2 py-2 text-center">
              <div className="text-[var(--c-accent)] text-sm font-mono font-bold">HEAD-TO-HEAD UNLOCKED</div>
              <div className="text-[var(--c-dark)] text-sm font-mono mt-0.5">1v1 ranked matches unlocked! Submit 20 research answers to unlock all game modes.</div>
            </div>
          )}
          {profile && <LevelMeter xp={profile.xp} level={profile.level} xpEarned={xpResult.xpEarned} />}
          {/* Daily streak */}
          {(xpResult.streakDay ?? 0) > 0 && (
            <div className="flex justify-between gap-2 text-sm font-mono">
              <span className="text-[var(--c-secondary)] shrink-0">
                {(xpResult.streakBonusXp ?? 0) > 0 ? 'STREAK BONUS' : 'STREAK'}
              </span>
              <span className="text-[var(--c-primary)] text-right">
                {(xpResult.streakBonusXp ?? 0) > 0
                  ? `+${xpResult.streakBonusXp} XP · Day ${xpResult.streakDay}`
                  : `Day ${xpResult.streakDay} (bonus already earned today)`}
              </span>
            </div>
          )}
        </div>
      )}
      {/* Achievement unlocks */}
      {xpResult?.newAchievements && xpResult.newAchievements.length > 0 && (
        <AchievementToast achievementIds={xpResult.newAchievements} />
      )}
      {/* Rate limit notice */}
      {signedIn && rateLimited && (
        <div className="term-border border-[rgba(255,170,0,0.4)] bg-[var(--c-bg)] px-3 py-3 space-y-1">
          <div className="text-[#ffaa00] text-sm font-mono font-bold tracking-widest">COOLDOWN_ACTIVE</div>
          <div className="text-[var(--c-muted)] text-sm font-mono">
            XP earning is paused. You can still play — XP resumes after cooldown.
          </div>
        </div>
      )}
      {/* Score header */}
      <div className="term-border bg-[var(--c-bg)] anim-fade-in-up" style={{ opacity: 0, animationDelay: '0ms' }}>
        <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[var(--c-secondary)] text-sm tracking-widest">
            {mode === 'daily' ? 'DAILY_COMPLETE' : 'SESSION_COMPLETE'}
          </span>
          <span className="text-[var(--c-dark)] text-sm font-mono">ANALYST_TERMINAL</span>
        </div>
        <div className="px-3 py-5 text-center space-y-2">
          <div className="text-sm font-mono text-[var(--c-secondary)] tracking-widest">ACCURACY RATING</div>
          <div className="text-6xl font-black font-mono text-[var(--c-primary)]">
            {score}<span className="text-2xl text-[var(--c-dark)]">/{total}</span>
          </div>
          <div className={`text-sm font-black font-mono tracking-widest ${tier.color}`}>
            {tier.label}
          </div>
          <div className="text-sm font-mono text-[var(--c-secondary)]">{tier.sub}</div>
          {rank && (
            <div
              className="text-sm font-mono font-bold tracking-widest mt-1"
              style={{ color: rank.color }}
            >
              [ {rank.label} ]
            </div>
          )}
        </div>
        <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-3 py-2 flex items-center justify-between">
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[var(--c-primary)]">{displayScore}</div>
            <div className="text-sm font-mono text-[var(--c-dark)]">TOTAL PTS</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[var(--c-accent)]">{efficiency}%</div>
            <div className="text-sm font-mono text-[var(--c-dark)]">EFFICIENCY</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[var(--c-primary)]">{maxPossible}</div>
            <div className="text-sm font-mono text-[var(--c-dark)]">MAX POSSIBLE</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3 anim-fade-in-up" style={{ opacity: 0, animationDelay: '150ms' }}>
        <div className="term-border bg-[var(--c-bg)] border-[rgba(255,51,51,0.3)] text-center px-3 py-3">
          <div className="text-[#ff3333] text-2xl font-black font-mono">{phishingCaught}/{phishingTotal}</div>
          <div className="text-sm font-mono text-[var(--c-secondary)] mt-1 tracking-wider">PHISHING CAUGHT</div>
        </div>
        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] text-center px-3 py-3">
          <div className="text-[var(--c-primary)] text-2xl font-black font-mono">{legitCorrect}/{legitTotal}</div>
          <div className="text-sm font-mono text-[var(--c-secondary)] mt-1 tracking-wider">LEGIT CLEARED</div>
        </div>
      </div>

      {/* Round log */}
      <div className="term-border bg-[var(--c-bg)] anim-fade-in-up" style={{ opacity: 0, animationDelay: '300ms' }}>
        <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
          <span className="text-[var(--c-secondary)] text-sm tracking-widest">ROUND_LOG</span>
        </div>
        <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">
          {results.map((r) => (
            <div key={r.card.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`text-sm font-mono font-bold w-4 ${r.correct ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}`}>
                {r.correct ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--c-secondary)] text-sm font-mono truncate">
                  {r.card.subject ?? r.card.from}
                </div>
                <div className="text-[var(--c-dark)] text-sm font-mono">
                  {r.card.isPhishing ? 'PHISH' : 'LEGIT'} · {r.card.difficulty?.toUpperCase() ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-mono px-1 border ${
                  r.confidence === 'certain' ? 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)]'
                  : r.confidence === 'likely' ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]'
                  : 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]'
                }`}>
                  {CONFIDENCE_LABEL[r.confidence]}
                </span>
                <span className={`text-sm font-mono font-bold ${
                  r.pointsEarned > 0 ? 'text-[var(--c-primary)]'
                  : r.pointsEarned < 0 ? 'text-[#ff3333]'
                  : 'text-[var(--c-dark)]'
                }`}>
                  {r.pointsEarned > 0 ? `+${r.pointsEarned}` : r.pointsEarned}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weakness tracking — research mode only */}
      {mode === 'research' && weakPoints.length > 0 && (
        <div className="term-border bg-[var(--c-bg)] anim-fade-in-up" style={{ opacity: 0, animationDelay: '450ms' }}>
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">COGNITIVE_BLIND_SPOTS</span>
          </div>
          <div className="divide-y divide-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]">
            {weakPoints.map(({ technique, missRate, missed, attempts }) => (
              <div key={technique} className="flex items-center px-3 py-2 gap-3">
                <span className="text-[#ff3333] text-sm font-mono flex-1">{technique}</span>
                <span className="text-[var(--c-dark)] text-sm font-mono">{missed}/{attempts}</span>
                <span className="text-[#ff3333] text-sm font-mono font-bold">{missRate}% miss</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-sm font-mono text-[var(--c-dark)]">
            Based on your session history. Stored locally.
          </div>
        </div>
      )}

      {/* Share results */}
      <button
        onClick={handleShare}
        className="w-full py-2 text-[var(--c-secondary)] font-mono text-sm tracking-widest hover:text-[var(--c-primary)] active:scale-95 transition-all"
      >
        {copied ? '[ COPIED ✓ ]' : '[ SHARE RESULTS ]'}
      </button>

      {/* Sign-in prompt for guests */}
      {!signedIn && (
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">XP_TRACKING</span>
          </div>
          <div className="px-3 py-3 space-y-3">
            <div className="text-[var(--c-dark)] text-sm font-mono">
              SIGN IN TO TRACK XP AND RANK UP
            </div>
            <AuthFlow onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => {}} />
          </div>
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-4 term-border text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
      >
        [ BACK TO TERMINAL ]
      </button>

    </div>
  );
}
