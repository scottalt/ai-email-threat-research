'use client';

import { useState, useEffect } from 'react';
import type { RoundResult, GameMode } from '@/lib/types';
import { getRank } from '@/lib/rank';
import { updateWeaknessHistory, getWeakPoints } from '@/lib/weakness-tracker';

interface Props {
  score: number;
  total: number;
  totalScore: number;
  results: RoundResult[];
  mode: GameMode;
  date: string;
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

export function RoundSummary({ score, total, totalScore, results, mode, date, onPlayAgain }: Props) {
  const tier = getTier(score, total);
  const rank = getRank(totalScore);
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [weakPoints, setWeakPoints] = useState<{ technique: string; missRate: number; missed: number; attempts: number }[]>([]);

  useEffect(() => {
    if (mode !== 'research') return;
    const techniqueResults = results.map((r) => ({
      technique: (r.card as unknown as Record<string, unknown>).technique as string | null ?? null,
      correct: r.correct,
    }));
    const updated = updateWeaknessHistory(techniqueResults);
    setWeakPoints(getWeakPoints(updated));
  }, [mode, results]);

  useEffect(() => {
    if (mode !== 'daily') return;
    fetch(`/api/leaderboard?date=${date}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setDailyLeaderboard)
      .catch(() => {});
  }, [mode, date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitState === 'loading') return;
    setSubmitState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          score: totalScore,
          ...(mode === 'daily' ? { date } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Submission failed.');
        setSubmitState('error');
      } else {
        setSubmitState('done');
        if (mode === 'daily') {
          fetch(`/api/leaderboard?date=${date}`)
            .then((r) => (r.ok ? r.json() : []))
            .then(setDailyLeaderboard)
            .catch(() => {});
        }
      }
    } catch {
      setErrorMsg('Network error.');
      setSubmitState('error');
    }
  }
  const phishingCaught = results.filter((r) => r.card.isPhishing && r.correct).length;
  const legitCorrect = results.filter((r) => !r.card.isPhishing && r.correct).length;
  const phishingTotal = results.filter((r) => r.card.isPhishing).length;
  const legitTotal = results.filter((r) => !r.card.isPhishing).length;
  const maxPossible = results.length * 300;
  const efficiency = Math.round((totalScore / maxPossible) * 100);

  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4">
      {/* Score header */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">
            {mode === 'daily' ? 'DAILY_COMPLETE' : 'SESSION_COMPLETE'}
          </span>
          <span className="text-[#003a0e] text-xs font-mono">ANALYST_TERMINAL</span>
        </div>
        <div className="px-3 py-5 text-center space-y-2">
          <div className="text-xs font-mono text-[#00aa28] tracking-widest">ACCURACY RATING</div>
          <div className="text-6xl font-black font-mono text-[#00ff41] glow">
            {score}<span className="text-2xl text-[#003a0e]">/{total}</span>
          </div>
          <div className={`text-sm font-black font-mono tracking-widest ${tier.color}`}>
            {tier.label}
          </div>
          <div className="text-xs font-mono text-[#00aa28]">{tier.sub}</div>
          <div
            className={`text-xs font-mono font-bold tracking-widest mt-1 ${rank.glowClass}`}
            style={{ color: rank.color }}
          >
            [ {rank.label} ]
          </div>
        </div>
        <div className="border-t border-[rgba(0,255,65,0.25)] px-3 py-2 flex items-center justify-between">
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#00ff41] glow">{totalScore}</div>
            <div className="text-[10px] font-mono text-[#003a0e]">TOTAL PTS</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#ffaa00]">{efficiency}%</div>
            <div className="text-[10px] font-mono text-[#003a0e]">EFFICIENCY</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black font-mono text-[#00ff41]">{maxPossible}</div>
            <div className="text-[10px] font-mono text-[#003a0e]">MAX POSSIBLE</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)] text-center px-3 py-3">
          <div className="text-[#ff3333] text-2xl font-black font-mono">{phishingCaught}/{phishingTotal}</div>
          <div className="text-[10px] font-mono text-[#00aa28] mt-1 tracking-wider">PHISHING CAUGHT</div>
        </div>
        <div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.3)] text-center px-3 py-3">
          <div className="text-[#00ff41] text-2xl font-black font-mono glow">{legitCorrect}/{legitTotal}</div>
          <div className="text-[10px] font-mono text-[#00aa28] mt-1 tracking-wider">LEGIT CLEARED</div>
        </div>
      </div>

      {/* Round log */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
          <span className="text-[#00aa28] text-xs tracking-widest">ROUND_LOG</span>
        </div>
        <div className="divide-y divide-[rgba(0,255,65,0.1)]">
          {results.map((r) => (
            <div key={r.card.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`text-xs font-mono font-bold w-4 ${r.correct ? 'text-[#00ff41]' : 'text-[#ff3333]'}`}>
                {r.correct ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[#00aa28] text-xs font-mono truncate">
                  {r.card.subject ?? r.card.from}
                </div>
                <div className="text-[#003a0e] text-[10px] font-mono">
                  {r.card.isPhishing ? 'PHISH' : 'LEGIT'} · {r.card.difficulty.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono px-1 border ${
                  r.confidence === 'certain' ? 'text-[#00ff41] border-[rgba(0,255,65,0.4)]'
                  : r.confidence === 'likely' ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]'
                  : 'text-[#00aa28] border-[rgba(0,255,65,0.2)]'
                }`}>
                  {CONFIDENCE_LABEL[r.confidence]}
                </span>
                <span className={`text-xs font-mono font-bold ${r.correct ? 'text-[#00ff41]' : 'text-[#003a0e]'}`}>
                  +{r.pointsEarned}
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
            <span className="text-[#00aa28] text-xs tracking-widest">COGNITIVE_BLIND_SPOTS</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {weakPoints.map(({ technique, missRate, missed, attempts }) => (
              <div key={technique} className="flex items-center px-3 py-2 gap-3">
                <span className="text-[#ff3333] text-xs font-mono flex-1">{technique}</span>
                <span className="text-[#003a0e] text-[10px] font-mono">{missed}/{attempts}</span>
                <span className="text-[#ff3333] text-xs font-mono font-bold">{missRate}% miss</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-[10px] font-mono text-[#003a0e]">
            Based on your session history. Stored locally.
          </div>
        </div>
      )}

      {/* Leaderboard submission */}
      <div className="term-border bg-[#060c06]">
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
          <span className="text-[#00aa28] text-xs tracking-widest">SUBMIT_TO_LEADERBOARD</span>
        </div>
        <div className="px-3 py-3">
          {submitState === 'done' ? (
            <div className="text-[#00ff41] text-xs font-mono text-center glow py-1">
              SCORE LOGGED. GL HF.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSubmitState('idle'); setErrorMsg(''); }}
                placeholder="ENTER CALLSIGN"
                maxLength={20}
                className="flex-1 bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-xs px-2 py-1.5 placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
              />
              <button
                type="submit"
                disabled={!name.trim() || submitState === 'loading'}
                className="px-3 py-1.5 term-border text-[#00ff41] font-mono text-xs tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {submitState === 'loading' ? '...' : 'LOG'}
              </button>
            </form>
          )}
          {submitState === 'error' && (
            <div className="text-[#ff3333] text-[10px] font-mono mt-1.5">{errorMsg}</div>
          )}
        </div>
      </div>

      {mode === 'daily' && dailyLeaderboard.length > 0 && (
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">DAILY_LEADERBOARD</span>
            <span className="text-[#003a0e] text-xs font-mono">{date}</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {dailyLeaderboard.slice(0, 10).map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className={`text-[10px] font-mono w-4 shrink-0 ${i === 0 ? 'text-[#ffaa00]' : 'text-[#003a0e]'}`}>
                  {i + 1}
                </span>
                <span className="text-[#00aa28] text-xs font-mono flex-1 truncate">{entry.name}</span>
                {(() => { const r = getRank(entry.score); return (
                  <span className={`text-[9px] font-mono shrink-0 ${r.glowClass}`} style={{ color: r.color }}>
                    {r.label}
                  </span>
                ); })()}
                <span className="text-[#00ff41] text-xs font-mono font-bold glow">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onPlayAgain}
        className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:scale-95 transition-all glow"
      >
        {mode === 'daily' ? '[ BACK TO TERMINAL ]' : '[ RUN AGAIN ]'}
      </button>

    </div>
  );
}
