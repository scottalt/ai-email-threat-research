'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HealthData {
  checkedAt: string;
  signals: string[];
  counts: {
    totalResearchAnswersEver: number;
    researchAnswersLast24h: number;
    researchAnswersLast7d: number;
    answersByModeLast24h: Record<string, number>;
  };
  recentAuthUsers: { authId: string; email: string; lastSignIn: string; createdAt: string }[];
  playerActivity: { playerId: string; displayName: string | null; createdAt: string; modes: Record<string, number>; researchCapped: boolean }[];
  cappedPlayers: { playerId: string; displayName: string | null; count: number; capped: boolean }[];
  abandonedSessions: { sessionId: string; cardsDealt: number; startedAt: string; status: 'suspicious' | 'bounce' | 'anonymous' }[];
  recentResearchAnswers: { playerId: string; sessionId: string; cardId: string; correct: boolean; createdAt: string }[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SignalBadge({ signal }: { signal: string }) {
  const isCritical = signal.includes('CRITICAL');
  const isWarning = signal.includes('WARNING') || signal.includes('possible');
  const isOk = signal.includes('No anomalies');
  const color = isOk ? 'text-[#00ff41] border-[rgba(0,255,65,0.3)]'
    : (isCritical || isWarning) ? 'text-[#ff3333] border-[rgba(255,51,51,0.3)]'
    : 'text-[#ffaa00] border-[rgba(255,170,0,0.3)]';
  return (
    <div className={`term-border ${color} px-3 py-2 text-xs font-mono`}>
      {isCritical ? '🚨 ' : isWarning ? '⚠ ' : isOk ? '✓ ' : '● '}{signal}
    </div>
  );
}

export default function ResearchHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/research-health');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHealth(); }, []);

  const lastResearchAnswer = data?.recentResearchAnswers?.[0]?.createdAt;
  const pipelineAlive = data && data.counts.researchAnswersLast24h > 0;
  const pipelineDead = data && data.counts.researchAnswersLast24h === 0;

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4 mt-8">
        {/* Header */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,170,255,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aaff] text-xs tracking-widest">RESEARCH_HEALTH</span>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="text-[#00aaff] text-xs font-mono hover:text-[#66ccff] disabled:text-[#003355] transition-colors"
              >
                {loading ? 'CHECKING...' : 'REFRESH'}
              </button>
              <Link href="/admin" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← BACK</Link>
            </div>
          </div>

          {error && (
            <div className="px-3 py-3 text-[#ff3333] text-xs font-mono">ERROR: {error}</div>
          )}

          {data && (
            <div className="px-3 py-4 space-y-4">
              {/* Pipeline Status — the one thing you need to see */}
              <div className={`term-border px-4 py-3 text-center ${
                pipelineAlive ? 'border-[rgba(0,255,65,0.4)]' : 'border-[rgba(255,51,51,0.5)]'
              }`}>
                <div className={`text-lg font-black font-mono ${pipelineAlive ? 'text-[#00ff41]' : 'text-[#ff3333]'}`}>
                  {pipelineAlive ? 'PIPELINE ALIVE' : 'NO ANSWERS IN 24H'}
                </div>
                <div className="text-[10px] font-mono text-[#003a0e] mt-1">
                  {lastResearchAnswer
                    ? `Last research answer: ${timeAgo(lastResearchAnswer)}`
                    : 'No recent research answers found'}
                </div>
              </div>

              {/* Signals */}
              <div className="space-y-2">
                <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">DIAGNOSTIC SIGNALS</div>
                {data.signals.map((s, i) => <SignalBadge key={i} signal={s} />)}
              </div>

              {/* Answer Counts */}
              <div className="space-y-2">
                <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">ANSWER FLOW</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'ALL TIME', value: data.counts.totalResearchAnswersEver },
                    { label: 'LAST 7D', value: data.counts.researchAnswersLast7d },
                    { label: 'LAST 24H', value: data.counts.researchAnswersLast24h, highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="term-border px-2 py-2 text-center">
                      <div className={`text-xl font-black font-mono ${
                        highlight ? (value > 0 ? 'text-[#00ff41]' : 'text-[#ff3333]') : 'text-[#00aa28]'
                      }`}>{value}</div>
                      <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Answers by mode — shows if other modes work but research doesn't */}
              {Object.keys(data.counts.answersByModeLast24h).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">ANSWERS BY MODE (24H)</div>
                  <div className="term-border px-3 py-2 space-y-1">
                    {Object.entries(data.counts.answersByModeLast24h)
                      .sort(([,a], [,b]) => b - a)
                      .map(([mode, count]) => (
                        <div key={mode} className="flex justify-between text-xs font-mono">
                          <span className={mode === 'research' ? 'text-[#00aaff]' : 'text-[#00aa28]'}>{mode}</span>
                          <span className={`font-bold ${
                            mode === 'research' ? (count > 0 ? 'text-[#00ff41]' : 'text-[#ff3333]') : 'text-[#00aa28]'
                          }`}>{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Abandoned Sessions — the definitive broken pipeline signal */}
              {data.abandonedSessions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[#ffaa00] text-[10px] font-mono tracking-widest">
                    CARDS DEALT BUT 0 ANSWERS ({data.abandonedSessions.length})
                  </div>
                  <div className="term-border border-[rgba(255,170,0,0.3)] px-3 py-2 space-y-1">
                    {data.abandonedSessions.map((s) => (
                      <div key={s.sessionId} className="flex items-center gap-2 text-xs font-mono">
                        <span className={`font-bold shrink-0 ${s.status === 'suspicious' ? 'text-[#ff3333]' : 'text-[#ffaa00]'}`}>
                          {s.cardsDealt} cards
                        </span>
                        <span className="text-[#003a0e] truncate flex-1">{s.sessionId.slice(0, 12)}...</span>
                        <span className={`text-[10px] shrink-0 ${
                          s.status === 'suspicious' ? 'text-[#ff3333]' : 'text-[#003a0e]'
                        }`}>
                          {s.status === 'suspicious' ? 'ACTIVE PLAYER' : s.status === 'bounce' ? 'bounce' : 'anon'}
                        </span>
                        <span className="text-[#003a0e] text-[10px] shrink-0">{timeAgo(s.startedAt)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[#003a0e] text-[10px] font-mono px-1">
                    ACTIVE PLAYER = player has answers elsewhere but none here (possible bug). bounce/anon = likely left without answering.
                  </div>
                </div>
              )}

              {/* Recent Auth Users */}
              <div className="space-y-2">
                <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">
                  RECENT SIGN-INS ({data.recentAuthUsers.length})
                </div>
                {data.recentAuthUsers.length === 0 ? (
                  <div className="text-[#003a0e] text-xs font-mono px-1">No sign-ins in last 7 days</div>
                ) : (
                  <div className="term-border px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
                    {data.recentAuthUsers.map((u) => (
                      <div key={u.authId} className="flex justify-between text-xs font-mono gap-2">
                        <span className="text-[#00aa28] truncate flex-1">{u.email}</span>
                        <span className="text-[#003a0e] text-[10px] shrink-0">{timeAgo(u.lastSignIn)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Player Activity — what are recent players actually doing? */}
              {data.playerActivity.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">
                    PLAYER ACTIVITY ({data.playerActivity.length} recent)
                  </div>
                  <div className="term-border px-3 py-2 space-y-1.5 max-h-56 overflow-y-auto">
                    {data.playerActivity.map((p) => {
                      const totalAnswers = Object.values(p.modes).reduce((s, n) => s + n, 0);
                      const hasResearch = (p.modes['research'] ?? 0) > 0;
                      const hasFreeplay = (p.modes['freeplay'] ?? 0) > 0;
                      const hasNothing = totalAnswers === 0;
                      return (
                        <div key={p.playerId} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-[#00aa28] truncate flex-1 min-w-0">
                            {p.displayName ?? p.playerId.slice(0, 8)}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            {hasResearch && (
                              <span className="text-[#00aaff] text-[10px]">R:{p.modes['research']}</span>
                            )}
                            {hasFreeplay && (
                              <span className="text-[#00aa28] text-[10px]">F:{p.modes['freeplay']}</span>
                            )}
                            {p.modes['expert'] && (
                              <span className="text-[#ffaa00] text-[10px]">E:{p.modes['expert']}</span>
                            )}
                            {p.modes['daily'] && (
                              <span className="text-[#00aa28] text-[10px]">D:{p.modes['daily']}</span>
                            )}
                            {hasNothing && (
                              <span className="text-[#003a0e] text-[10px]">no activity</span>
                            )}
                            {p.researchCapped && (
                              <span className="text-[#ff3333] text-[10px]">CAPPED</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[#003a0e] text-[10px] font-mono px-1">
                    R=research F=freeplay E=expert D=daily. Players with &quot;no activity&quot; signed in and left.
                  </div>
                </div>
              )}

              {/* Capped Players */}
              {data.cappedPlayers.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[#ffaa00] text-[10px] font-mono tracking-widest">
                    LIFETIME CAP HIT ({data.cappedPlayers.length})
                  </div>
                  <div className="term-border border-[rgba(255,170,0,0.3)] px-3 py-2 space-y-1">
                    {data.cappedPlayers.map((p) => (
                      <div key={p.playerId} className="flex justify-between text-xs font-mono gap-2">
                        <span className="text-[#00aa28] truncate flex-1">{p.displayName ?? p.playerId.slice(0, 8)}</span>
                        <span className="text-[#ffaa00] font-bold shrink-0">{p.count}/30</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[#003a0e] text-[10px] font-mono px-1">
                    These players have reached the 30-answer lifetime research cap. New answers are silently dropped.
                  </div>
                </div>
              )}

              {/* Recent Research Answers */}
              <div className="space-y-2">
                <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">
                  RECENT RESEARCH ANSWERS ({data.recentResearchAnswers.length})
                </div>
                {data.recentResearchAnswers.length === 0 ? (
                  <div className="term-border border-[rgba(255,51,51,0.3)] px-3 py-3 text-[#ff3333] text-xs font-mono text-center">
                    NO RESEARCH ANSWERS IN LAST 24 HOURS
                  </div>
                ) : (
                  <div className="term-border px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                    {data.recentResearchAnswers.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className={`shrink-0 ${a.correct ? 'text-[#00ff41]' : 'text-[#ff3333]'}`}>
                          {a.correct ? '✓' : '✗'}
                        </span>
                        <span className="text-[#00aa28] truncate flex-1">{a.cardId.slice(0, 12)}</span>
                        <span className="text-[#003a0e] text-[10px] shrink-0">{timeAgo(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checked At */}
              <div className="text-[#003a0e] text-[10px] font-mono text-center">
                Checked: {new Date(data.checkedAt).toLocaleString()}
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="px-3 py-8 text-[#00aaff] text-xs font-mono text-center">
              RUNNING DIAGNOSTICS...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
