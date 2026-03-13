'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import Link from 'next/link';

interface Stats {
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

export default function StatsPage() {
  const { profile, loading, signedIn } = usePlayer();
  const [stats, setStats] = useState<Stats | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/player/stats')
      .then(r => {
        if (r.status === 403) { setError('LOCKED'); return null; }
        if (!r.ok) { setError('FAILED'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.empty) { setEmpty(true); return; }
        setStats(data);
      })
      .catch(() => setError('FAILED'));
  }, [signedIn]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <span className="text-[#00aa28] text-sm font-mono">LOADING...</span>
      </main>
    );
  }

  if (!signedIn || !profile) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <div className="w-full max-w-sm term-border bg-[#060c06] px-4 py-6 text-center space-y-3">
          <div className="text-[#00aa28] text-sm font-mono tracking-widest">NOT_AUTHENTICATED</div>
          <Link href="/" className="block text-[#00ff41] text-sm font-mono hover:underline">← BACK TO TERMINAL</Link>
        </div>
      </main>
    );
  }

  if (error === 'LOCKED') {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <div className="w-full max-w-sm term-border bg-[#060c06] px-4 py-6 text-center space-y-3">
          <div className="text-[#ffaa00] text-sm font-mono tracking-widest">STATS_LOCKED</div>
          <div className="text-[#003a0e] text-sm font-mono">Complete 30 research answers to unlock your personal stats.</div>
          <Link href="/" className="block text-[#00ff41] text-sm font-mono hover:underline">← BACK TO TERMINAL</Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <div className="w-full max-w-sm term-border bg-[#060c06] px-4 py-6 text-center space-y-3">
          <div className="text-[#ff3333] text-sm font-mono">LOAD_FAILED</div>
          <Link href="/" className="block text-[#00ff41] text-sm font-mono hover:underline">← BACK TO TERMINAL</Link>
        </div>
      </main>
    );
  }

  if (empty) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <div className="w-full max-w-sm term-border bg-[#060c06] px-4 py-6 text-center space-y-3">
          <div className="text-[#00aa28] text-sm font-mono tracking-widest">NO_DATA</div>
          <div className="text-[#003a0e] text-sm font-mono">Play some rounds in Freeplay, Daily, or Expert to see your stats.</div>
          <Link href="/" className="block text-[#00ff41] text-sm font-mono hover:underline">← BACK TO TERMINAL</Link>
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="min-h-screen bg-[#020902] flex items-center justify-center px-4">
        <span className="text-[#00aa28] text-sm font-mono">LOADING...</span>
      </main>
    );
  }

  const avgTimeSec = stats.avgTimeMs ? (stats.avgTimeMs / 1000).toFixed(1) : null;

  // Activity chart - max value for scaling
  const activityValues = Object.values(stats.activity);
  const maxActivity = Math.max(...activityValues, 1);

  return (
    <main className="min-h-screen bg-[#020902] flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[#00aa28] text-sm tracking-widest">OPERATOR_STATS</span>
            <Link href="/" className="text-[#00aa28] text-sm font-mono hover:text-[#00ff41]">← TERMINAL</Link>
          </div>

          {/* Core stats */}
          <div className="grid grid-cols-3 divide-x divide-[rgba(0,255,65,0.1)]">
            <div className="px-3 py-4 text-center">
              <div className="text-2xl font-black font-mono text-[#00ff41]">{stats.overallAccuracy}%</div>
              <div className="text-sm font-mono text-[#003a0e] mt-1">ACCURACY</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-2xl font-black font-mono text-[#00ff41]">{stats.totalAnswers}</div>
              <div className="text-sm font-mono text-[#003a0e] mt-1">ANALYZED</div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-2xl font-black font-mono text-[#00ff41]">{avgTimeSec ?? '—'}s</div>
              <div className="text-sm font-mono text-[#003a0e] mt-1">AVG TIME</div>
            </div>
          </div>
        </div>

        {/* Detection split */}
        <div className="grid grid-cols-2 gap-3">
          <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)] text-center px-3 py-3">
            <div className="text-[#ff3333] text-2xl font-black font-mono">{stats.phishingCatchRate ?? '—'}%</div>
            <div className="text-sm font-mono text-[#00aa28] mt-1 tracking-wider">THREATS CAUGHT</div>
          </div>
          <div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.3)] text-center px-3 py-3">
            <div className="text-[#00ff41] text-2xl font-black font-mono">{stats.legitAccuracy ?? '—'}%</div>
            <div className="text-sm font-mono text-[#00aa28] mt-1 tracking-wider">LEGIT CLEARED</div>
          </div>
        </div>

        {/* By difficulty */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">ACCURACY_BY_DIFFICULTY</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {DIFFICULTY_ORDER.map(d => {
              const data = stats.byDifficulty[d];
              if (!data || data.total < 3) return null;
              const pct = Math.round((data.correct / data.total) * 100);
              const color = pct >= 80 ? '#00ff41' : pct >= 60 ? '#ffaa00' : '#ff3333';
              return (
                <div key={d} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00aa28] text-sm font-mono tracking-wider">{d.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#003a0e] text-sm font-mono">{data.correct}/{data.total}</span>
                      <span className="text-sm font-mono font-bold" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <AccuracyBar pct={pct} color={color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Confidence calibration */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">CONFIDENCE_CALIBRATION</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {CONFIDENCE_ORDER.map(c => {
              const data = stats.byConfidence[c];
              if (!data || data.total < 3) return null;
              const pct = Math.round((data.correct / data.total) * 100);
              const color = c === 'certain' ? (pct >= 90 ? '#00ff41' : '#ff3333')
                : c === 'likely' ? (pct >= 70 ? '#00ff41' : '#ffaa00')
                : '#00aa28';
              return (
                <div key={c} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00aa28] text-sm font-mono tracking-wider">{c.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#003a0e] text-sm font-mono">{data.correct}/{data.total}</span>
                      <span className="text-sm font-mono font-bold" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <AccuracyBar pct={pct} color={color} />
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 text-sm font-mono text-[#003a0e]">
            CERTAIN should be 90%+. If not, recalibrate.
          </div>
        </div>

        {/* Tool usage */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">TOOL_USAGE</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#00aa28] text-sm font-mono tracking-wider">HEADERS CHECKED</span>
                <span className="text-sm font-mono font-bold text-[#00ff41]">{stats.headersRate}%</span>
              </div>
              <AccuracyBar pct={stats.headersRate} color="#00aa28" />
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#00aa28] text-sm font-mono tracking-wider">URLS INSPECTED</span>
                <span className="text-sm font-mono font-bold text-[#00ff41]">{stats.urlRate}%</span>
              </div>
              <AccuracyBar pct={stats.urlRate} color="#00aa28" />
            </div>
          </div>
        </div>

        {/* By game mode */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">BY_GAME_MODE</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {Object.entries(stats.byMode).map(([mode, data]) => {
              const pct = Math.round((data.correct / data.total) * 100);
              const color = pct >= 80 ? '#00ff41' : pct >= 60 ? '#ffaa00' : '#ff3333';
              return (
                <div key={mode} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#00aa28] text-sm font-mono tracking-wider">{MODE_LABELS[mode] ?? mode.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#003a0e] text-sm font-mono">{data.total} answers</span>
                      <span className="text-sm font-mono font-bold" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <AccuracyBar pct={pct} color={color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity heatmap */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-sm tracking-widest">ACTIVITY_14D</span>
          </div>
          <div className="px-3 py-3">
            <div className="flex gap-1 items-end h-12">
              {Object.entries(stats.activity).map(([date, count]) => {
                const height = count > 0 ? Math.max(15, (count / maxActivity) * 100) : 4;
                const opacity = count > 0 ? 0.3 + (count / maxActivity) * 0.7 : 0.08;
                return (
                  <div
                    key={date}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${height}%`,
                      backgroundColor: '#00ff41',
                      opacity,
                    }}
                    title={`${date}: ${count} answers`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[#003a0e] text-xs font-mono">{Object.keys(stats.activity)[0]?.slice(5)}</span>
              <span className="text-[#003a0e] text-xs font-mono">TODAY</span>
            </div>
          </div>
        </div>

        <Link
          href="/"
          className="block w-full py-4 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
        >
          [ BACK TO TERMINAL ]
        </Link>
      </div>
    </main>
  );
}
