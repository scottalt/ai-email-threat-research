'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  needsReview: number;
  liveCards: number;
  targetCards: number;
  pendingBreakdown: {
    phishing: Record<string, Record<string, number>>;
    legit: Record<string, number>;
    legitTotal: number;
  };
}

interface ResearchStats {
  totalAnswers: number;
  answersToday: number;
  distinctSessions: number;
  overallAccuracy: number;
  playerCount: number;
  graduatedCount: number;
  byTechnique: { technique: string; total: number; correct: number; accuracy: number | null }[];
}

interface FlagStats {
  totalFlags: number;
  flaggedCards: number;
  cards: { card_id: string; count: number; reasons: Record<string, number> }[];
}

const POLL_INTERVAL = 10000; // 10 seconds

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null);
  const [flagStats, setFlagStats] = useState<FlagStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchStats() {
    try {
      const [statsRes, researchRes, flagsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/research-stats'),
        fetch('/api/admin/flags'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (researchRes.ok) setResearchStats(await researchRes.json());
      if (flagsRes.ok) setFlagStats(await flagsRes.json());
      setLastUpdated(new Date());
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const progress = stats ? Math.round((stats.liveCards / stats.targetCards) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">ADMIN_DASHBOARD</span>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-[#002a0a] text-[10px] font-mono">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Link href="/" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← BACK</Link>
            </div>
          </div>
          <div className="px-3 py-4 space-y-4">
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'PENDING', value: stats.pending, color: 'text-[#ffaa00]' },
                    { label: 'LIVE CARDS', value: stats.liveCards, color: 'text-[#00ff41]' },
                    { label: 'REJECTED', value: stats.rejected, color: 'text-[#ff3333]' },
                    { label: 'NEEDS REVIEW', value: stats.needsReview, color: 'text-[#ffaa00]' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="term-border px-3 py-2 text-center">
                      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
                      <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#00aa28]">DATASET v1 PROGRESS</span>
                    <span className="text-[#00ff41]">{stats.liveCards} / {stats.targetCards}</span>
                  </div>
                  <div className="w-full h-2 bg-[#003a0e]">
                    <div
                      className="h-full bg-[#00ff41] transition-all"
                      style={{ width: `${progress}%`, boxShadow: '0 0 6px rgba(0,255,65,0.8)' }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[#003a0e] text-right">{progress}% COMPLETE</div>
                </div>

                {stats.pendingBreakdown && (
                  <div className="space-y-2">
                    <div className="text-[#003a0e] text-xs font-mono tracking-widest">PENDING QUEUE — PHISHING</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr>
                            <th className="text-left text-[#003a0e] pb-1 pr-3">TECHNIQUE</th>
                            {['easy', 'medium', 'hard'].map(d => (
                              <th key={d} className="text-[#003a0e] pb-1 px-2 text-center w-12">{d.toUpperCase()}</th>
                            ))}
                            <th className="text-[#003a0e] pb-1 px-2 text-center w-12">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['urgency', 'authority-impersonation', 'credential-harvest', 'hyper-personalization', 'pretexting', 'fluent-prose'].map(technique => {
                            const row = stats.pendingBreakdown.phishing[technique] ?? {};
                            const total = (row.easy ?? 0) + (row.medium ?? 0) + (row.hard ?? 0);
                            return (
                              <tr key={technique} className="border-t border-[rgba(0,255,65,0.08)]">
                                <td className="text-[#00aa28] pr-3 py-1 truncate max-w-[120px]">{technique}</td>
                                {['easy', 'medium', 'hard'].map(d => {
                                  const count = row[d] ?? 0;
                                  const color = count === 0 ? 'text-[#003a0e]' : count >= 20 ? 'text-[#00ff41]' : 'text-[#ffaa00]';
                                  return <td key={d} className={`${color} text-center px-2 py-1 font-black`}>{count}</td>;
                                })}
                                <td className={`text-center px-2 py-1 font-black ${total === 0 ? 'text-[#003a0e]' : 'text-[#00aa28]'}`}>{total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {stats.pendingBreakdown && (
                  <div className="space-y-2">
                    <div className="text-[#003a0e] text-xs font-mono tracking-widest">PENDING QUEUE — LEGIT</div>
                    <div className="term-border px-3 py-2 flex items-center justify-between">
                      <span className="text-[#003a0e] text-xs font-mono">TOTAL PENDING</span>
                      <span className={`text-xl font-black font-mono ${stats.pendingBreakdown.legitTotal === 0 ? 'text-[#003a0e]' : 'text-[#ffaa00]'}`}>
                        {stats.pendingBreakdown.legitTotal}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-[#00aa28] text-xs font-mono text-center py-4">
                LOADING...
              </div>
            )}
          </div>
        </div>

        {/* Research data */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">RESEARCH_DATA</span>
          </div>
          {researchStats ? (
            <div className="px-3 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'TOTAL ANSWERS', value: researchStats.totalAnswers, color: 'text-[#00ff41]' },
                  { label: 'TODAY', value: researchStats.answersToday, color: 'text-[#00ff41]' },
                  { label: 'SESSIONS', value: researchStats.distinctSessions, color: 'text-[#00aa28]' },
                  { label: 'ACCURACY', value: `${researchStats.overallAccuracy}%`, color: researchStats.overallAccuracy >= 70 ? 'text-[#00ff41]' : 'text-[#ffaa00]' },
                  { label: 'PLAYERS', value: researchStats.playerCount, color: 'text-[#00aa28]' },
                  { label: 'GRADUATED', value: researchStats.graduatedCount, color: 'text-[#ffaa00]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="term-border px-2 py-2 text-center">
                    <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
                    <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="text-[#003a0e] text-[10px] font-mono tracking-widest pb-1">TECHNIQUE ACCURACY</div>
                {researchStats.byTechnique.map(({ technique, total, accuracy }) => (
                  <div key={technique} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[#00aa28] flex-1 truncate">{technique}</span>
                    <span className="text-[#003a0e] text-[10px]">n={total}</span>
                    <span className={`w-10 text-right font-bold ${
                      accuracy === null ? 'text-[#003a0e]'
                      : accuracy >= 80 ? 'text-[#00ff41]'
                      : accuracy >= 50 ? 'text-[#ffaa00]'
                      : 'text-[#ff3333]'
                    }`}>
                      {accuracy === null ? '—' : `${accuracy}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-3 text-[#003a0e] text-xs font-mono">LOADING...</div>
          )}
        </div>

        {/* Player-reported flags */}
        {flagStats && flagStats.totalFlags > 0 && (
          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-2 flex items-center justify-between">
              <span className="text-[#ff3333] text-xs tracking-widest">PLAYER_FLAGS</span>
              <Link href="/admin/flags" className="text-[#003a0e] text-xs font-mono hover:text-[#ff3333] transition-colors">
                VIEW ALL →
              </Link>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="term-border border-[rgba(255,51,51,0.2)] px-2 py-2 text-center">
                  <div className="text-xl font-black font-mono text-[#ff3333]">{flagStats.totalFlags}</div>
                  <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">TOTAL FLAGS</div>
                </div>
                <div className="term-border border-[rgba(255,51,51,0.2)] px-2 py-2 text-center">
                  <div className="text-xl font-black font-mono text-[#ffaa00]">{flagStats.flaggedCards}</div>
                  <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">CARDS FLAGGED</div>
                </div>
              </div>
              {flagStats.cards.slice(0, 3).map((c) => (
                <div key={c.card_id} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#ff3333] font-black w-6 text-right">{c.count}x</span>
                  <span className="text-[#00aa28] truncate flex-1">{c.card_id}</span>
                  <span className="text-[#003a0e] text-[10px]">
                    {Object.entries(c.reasons).map(([r, n]) => `${r}(${n})`).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Link
            href="/admin/review"
            className="block w-full py-3 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm text-center hover:bg-[rgba(0,255,65,0.08)] transition-all"
          >
            [ REVIEW QUEUE ]
          </Link>
          <Link
            href="/admin/approved"
            className="block w-full py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
          >
            [ APPROVED CARDS ]
          </Link>
          <div className="space-y-1">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest px-1">EXPORT CARDS</div>
            <div className="flex gap-2">
              <Link
                href="/api/admin/export?format=json"
                className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                [ JSON ]
              </Link>
              <Link
                href="/api/admin/export?format=csv"
                className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                [ CSV ]
              </Link>
              <Link
                href="/api/admin/export?format=jsonl"
                className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
              >
                [ JSONL ]
              </Link>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest px-1">EXPORT ANSWERS</div>
            <div className="flex gap-2">
              <Link
                href="/api/admin/export-answers?format=json"
                className="flex-1 py-3 term-border text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] transition-all"
              >
                [ JSON ]
              </Link>
              <Link
                href="/api/admin/export-answers?format=csv"
                className="flex-1 py-3 term-border text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] transition-all"
              >
                [ CSV ]
              </Link>
              <Link
                href="/api/admin/export-answers?format=jsonl"
                className="flex-1 py-3 term-border text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] transition-all"
              >
                [ JSONL ]
              </Link>
            </div>
          </div>
          <Link
            href="/admin/content"
            className="block w-full py-3 term-border border-[rgba(0,170,255,0.4)] text-[#00aaff] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,170,255,0.05)] transition-all"
          >
            [ CONTENT REGISTRY — SEASONS, THEMES, ACHIEVEMENTS... ]
          </Link>
          <Link
            href="/admin/xp-audit"
            className="block w-full py-3 term-border border-[rgba(255,51,51,0.4)] text-[#ff3333] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,51,51,0.05)] transition-all"
          >
            [ XP AUDIT — SPAM DETECTION ]
          </Link>
          <Link
            href="/admin/preview"
            className="block w-full py-3 term-border text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] transition-all"
          >
            [ PREVIEW MODE — NO DATA WRITTEN ]
          </Link>
          <Link
            href="/admin/research-health"
            className="block w-full py-3 term-border border-[rgba(0,170,255,0.4)] text-[#00aaff] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,170,255,0.05)] transition-all"
          >
            [ RESEARCH HEALTH CHECK — AUTH + PIPELINE DIAGNOSTIC ]
          </Link>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('research_intro_seen');
              localStorage.setItem('research_flow_test', '1');
              router.push('/');
            }}
            className="w-full py-3 term-border border-[rgba(255,170,0,0.4)] text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] active:scale-95 transition-all"
          >
            [ TEST RESEARCH FLOW — DISCLAIMER + TUTORIAL, NO DATA WRITTEN ]
          </button>
        </div>
      </div>
    </div>
  );
}
