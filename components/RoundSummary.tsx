'use client';

import { useState, useEffect, useRef } from 'react';
import type { RoundResult, GameMode } from '@/lib/types';
import { getRankFromLevel } from '@/lib/rank';
import { updateWeaknessHistory, getWeakPoints } from '@/lib/weakness-tracker';
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from './LevelMeter';
import { AuthFlow } from './AuthFlow';
import { getXpForRound } from '@/lib/xp';

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
  if (pct === 1) return { label: 'PERFECT_SCORE', color: 'text-[#00ff41]', sub: 'Zero breaches. Clean sweep.' };
  if (pct >= 0.8) return { label: 'SHARP_ANALYST', color: 'text-[#00ff41]', sub: 'Strong instincts. A couple slipped through.' };
  if (pct >= 0.6) return { label: 'NEEDS_CALIBRATION', color: 'text-[#ffaa00]', sub: 'Decent, but a few got past you.' };
  if (pct >= 0.4) return { label: 'HOOKED', color: 'text-[#ff3333]', sub: 'You took the bait more than once.' };
  return { label: 'COMPROMISED', color: 'text-[#ff3333]', sub: 'The phishers owned you this round.' };
}

const CONFIDENCE_LABEL: Record<string, string> = { guessing: 'G', likely: 'L', certain: 'C' };

export function RoundSummary({ score, total, totalScore, results, mode, sessionId, onPlayAgain }: Props) {
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
    xpEarned: number; level: number; levelUp: boolean; graduated: boolean;
  } | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
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

  useEffect(() => {
    if (!signedIn || xpFired.current) return;
    xpFired.current = true;
    fetch('/api/player/xp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xpEarned, score: totalScore, gameMode: mode, sessionCompleted: true, sessionId }),
    })
      .then(r => {
        if (r.status === 429) { setRateLimited(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (data) { setXpResult(data); refreshProfile(); }
      })
      .catch(() => {});
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const phishingCaught = results.filter((r) => r.card.isPhishing && r.correct).length;
  const legitCorrect = results.filter((r) => !r.card.isPhishing && r.correct).length;
  const phishingTotal = results.filter((r) => r.card.isPhishing).length;
  const legitTotal = results.filter((r) => !r.card.isPhishing).length;
  const maxPossible = results.length * 300;
  const efficiency = Math.round((totalScore / maxPossible) * 100);

  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 pb-safe flex flex-col gap-4">
      {/* XP award — only shown when signed in and API has responded */}
      {signedIn && xpResult && (
        <div className="term-border bg-[#060c06] px-3 py-3 space-y-2">
          <div className="flex justify-between text-sm font-mono">
            <span className="text-[#00aa28]">XP EARNED</span>
            <span className="text-[#00ff41] font-bold glow">+{xpResult.xpEarned} XP</span>
          </div>
          {xpResult.levelUp && (
            <div className="text-[#ffaa00] text-sm font-mono glow text-center">LEVEL UP → {xpResult.level}</div>
          )}
          {xpResult.graduated && (
            <div className="term-border border-[rgba(255,170,0,0.4)] px-2 py-2 text-center">
              <div className="text-[#ffaa00] text-sm font-mono font-bold">RESEARCH GRADUATED</div>
              <div className="text-[#003a0e] text-sm font-mono mt-0.5">Expert Mode unlocked. You&apos;ve submitted all 30 research answers.</div>
            </div>
          )}
          {profile && <LevelMeter xp={profile.xp} level={profile.level} />}
        </div>
      )}
      {/* Rate limit notice */}
      {signedIn && rateLimited && (
        <div className="term-border border-[rgba(255,170,0,0.4)] bg-[#060c06] px-3 py-3 space-y-1">
          <div className="text-[#ffaa00] text-sm font-mono font-bold tracking-widest">COOLDOWN_ACTIVE</div>
          <div className="text-[#003a0e] text-sm font-mono">
            You&apos;ve been grinding hard, agent. XP earning is paused — take a break and come back later to keep ranking up.
          </div>
        </div>
      )}
      {/* Score header */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#00aa28] text-sm tracking-widest">
            {mode === 'daily' ? 'DAILY_COMPLETE' : 'SESSION_COMPLETE'}
          </span>
          <span className="text-[#003a0e] text-sm font-mono">ANALYST_TERMINAL</span>
        </div>
        <div className="px-3 py-5 text-center space-y-2">
          <div className="text-sm font-mono text-[#00aa28] tracking-widest">ACCURACY RATING</div>
          <div className="text-6xl font-black font-mono text-[#00ff41] glow">
            {score}<span className="text-2xl text-[#003a0e]">/{total}</span>
          </div>
          <div className={`text-sm font-black font-mono tracking-widest ${tier.color}`}>
            {tier.label}
          </div>
          <div className="text-sm font-mono text-[#00aa28]">{tier.sub}</div>
          {rank && (
            <div
              className={`text-sm font-mono font-bold tracking-widest mt-1 ${rank.glowClass}`}
              style={{ color: rank.color }}
            >
              [ {rank.label} ]
            </div>
          )}
        </div>
        <div className="border-t border-[rgba(0,255,65,0.25)] px-3 py-2 flex items-center justify-between">
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#00ff41] glow">{displayScore}</div>
            <div className="text-sm font-mono text-[#003a0e]">TOTAL PTS</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#ffaa00]">{efficiency}%</div>
            <div className="text-sm font-mono text-[#003a0e]">EFFICIENCY</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#00ff41]">{maxPossible}</div>
            <div className="text-sm font-mono text-[#003a0e]">MAX POSSIBLE</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)] text-center px-3 py-3">
          <div className="text-[#ff3333] text-2xl font-black font-mono">{phishingCaught}/{phishingTotal}</div>
          <div className="text-sm font-mono text-[#00aa28] mt-1 tracking-wider">PHISHING CAUGHT</div>
        </div>
        <div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.3)] text-center px-3 py-3">
          <div className="text-[#00ff41] text-2xl font-black font-mono glow">{legitCorrect}/{legitTotal}</div>
          <div className="text-sm font-mono text-[#00aa28] mt-1 tracking-wider">LEGIT CLEARED</div>
        </div>
      </div>

      {/* Round log */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
          <span className="text-[#00aa28] text-sm tracking-widest">ROUND_LOG</span>
        </div>
        <div className="divide-y divide-[rgba(0,255,65,0.1)]">
          {results.map((r) => (
            <div key={r.card.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`text-sm font-mono font-bold w-4 ${r.correct ? 'text-[#00ff41]' : 'text-[#ff3333]'}`}>
                {r.correct ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[#00aa28] text-sm font-mono truncate">
                  {r.card.subject ?? r.card.from}
                </div>
                <div className="text-[#003a0e] text-sm font-mono">
                  {r.card.isPhishing ? 'PHISH' : 'LEGIT'} · {r.card.difficulty?.toUpperCase() ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-mono px-1 border ${
                  r.confidence === 'certain' ? 'text-[#00ff41] border-[rgba(0,255,65,0.4)]'
                  : r.confidence === 'likely' ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]'
                  : 'text-[#00aa28] border-[rgba(0,255,65,0.2)]'
                }`}>
                  {CONFIDENCE_LABEL[r.confidence]}
                </span>
                <span className={`text-sm font-mono font-bold ${
                  r.pointsEarned > 0 ? 'text-[#00ff41]'
                  : r.pointsEarned < 0 ? 'text-[#ff3333]'
                  : 'text-[#003a0e]'
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
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">COGNITIVE_BLIND_SPOTS</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {weakPoints.map(({ technique, missRate, missed, attempts }) => (
              <div key={technique} className="flex items-center px-3 py-2 gap-3">
                <span className="text-[#ff3333] text-sm font-mono flex-1">{technique}</span>
                <span className="text-[#003a0e] text-sm font-mono">{missed}/{attempts}</span>
                <span className="text-[#ff3333] text-sm font-mono font-bold">{missRate}% miss</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-sm font-mono text-[#003a0e]">
            Based on your session history. Stored locally.
          </div>
        </div>
      )}

      {/* Sign-in prompt for guests */}
      {!signedIn && (
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">XP_TRACKING</span>
          </div>
          <div className="px-3 py-3 space-y-3">
            <div className="text-[#003a0e] text-sm font-mono">
              SIGN IN TO TRACK XP AND RANK UP
            </div>
            <AuthFlow onSignIn={signInWithEmail} onVerifyCode={verifyOtp} onCancel={() => {}} />
          </div>
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:scale-95 transition-all glow"
      >
        [ BACK TO TERMINAL ]
      </button>

    </div>
  );
}
